import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';
import type { KairoSession, Project } from '../../types';
import { bridgeToImports, parseAiPlan } from '../../utils/aiBridge';
import { applyImportedPlan } from '../../utils/importPlan';
import { buildTodayState } from '../../utils/todayPlan';

export type KairoState = { projects: Project[]; sessions: KairoSession[] };

export interface KairoStore {
  load(userId: string): Promise<KairoState>;
  saveProjects(userId: string, projects: Project[]): Promise<void>;
}

export interface ConnectorDeps {
  store: KairoStore;
  /** Returns the user id for a valid bearer token, or null. */
  authenticate(request: Request): Promise<string | null>;
  /** Where OAuth metadata lives, advertised on 401 (MCP authorization spec). */
  resourceMetadataUrl?: string;
  now?: () => Date;
}

const INSTRUCTIONS = `Kairo is a Pomodoro study planner. One "round" is one 25-minute focus session.
Before planning, call get_study_profile and size tasks using the estimate multiplier it returns.
Only add what the student asked for. Never claim work was completed; Kairo records that from the timer.
Dates are YYYY-MM-DD. Prefer add_subtasks over add_plan when extending an existing task.`;

const DAY = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');
const text = (value: unknown) => ({ content: [{ type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] });
const fail = (message: string) => ({ isError: true as const, content: [{ type: 'text' as const, text: message }] });
const today = (now: Date) => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

const findProject = (projects: Project[], name: string) =>
  projects.find(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());

export const createKairoServer = (deps: ConnectorDeps, userId: string): McpServer => {
  const now = () => deps.now?.() ?? new Date();
  const server = new McpServer({ name: 'kairo', version: '0.1.0' }, { instructions: INSTRUCTIONS });

  server.registerTool('get_today', {
    title: "Today's study plan",
    description: "Returns today's planned study blocks, rounds done today, and pace status per project.",
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const { projects, sessions } = await deps.store.load(userId);
    const state = buildTodayState({ projects, sessions, today: today(now()) });
    return text({
      date: today(now()),
      roundsDoneToday: state.roundsToday,
      plannedToday: state.plannedToday,
      exam: state.exam ?? null,
      blocks: state.blocks.map(b => ({ project: b.projectName, task: b.taskName, rounds: b.rounds, reason: b.reason })),
      projects: state.projects.map(p => ({ name: p.name, deadline: p.deadline ?? null, doneRounds: p.doneRounds, remainingRounds: p.remainingRounds, pace: p.pace ?? null })),
    });
  });

  server.registerTool('get_study_profile', {
    title: 'Study profile',
    description: 'How this student actually studies: estimate multiplier (actual vs estimated rounds), average rounds per day, and recent daily rounds.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const { projects, sessions } = await deps.store.load(userId);
    const state = buildTodayState({ projects, sessions, today: today(now()) });
    const avg = state.recentDailyRounds.reduce((s, r) => s + r, 0) / Math.max(1, state.recentDailyRounds.length);
    return text({
      estimateMultiplier: state.multiplier,
      averageRoundsPerDay14d: Math.round(avg * 10) / 10,
      recentDailyRounds: state.recentDailyRounds,
      dailyGoal: state.goal,
    });
  });

  server.registerTool('list_projects', {
    title: 'List projects and tasks',
    description: 'Lists projects with deadlines and each task with rounds done and planned.',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async () => {
    const { projects } = await deps.store.load(userId);
    return text(projects.map(p => ({
      name: p.name,
      deadline: p.deadline ?? null,
      tasks: p.tasks.map(t => ({ name: t.name, completed: t.completed, plannedRounds: t.targetRounds ?? 1, minutesSpent: t.timeSpent, subtasks: (t.subTasks ?? []).map(s => s.name) })),
    })));
  });

  server.registerTool('add_plan', {
    title: 'Add a study plan',
    description: 'Adds projects with tasks to Kairo. A project with the same name gets the new tasks appended. Rounds are 25-minute sessions (1-12 per task).',
    inputSchema: {
      projects: z.array(z.object({
        name: z.string().min(1).max(80),
        deadline: DAY.optional(),
        tasks: z.array(z.object({
          name: z.string().min(1).max(120),
          rounds: z.number().int().min(1).max(12),
          subtasks: z.array(z.string().max(120)).max(6).optional(),
        })).min(1).max(40),
      })).min(1).max(6),
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async input => {
    const parsed = parseAiPlan(JSON.stringify(input));
    if (!parsed.plan) return fail(`Invalid plan: ${parsed.errors.join('; ')}`);
    const { projects } = await deps.store.load(userId);
    let next = projects;
    let tasksAdded = 0;
    for (const imported of bridgeToImports(parsed.plan, projects)) {
      next = applyImportedPlan(next, imported).projects;
      tasksAdded += imported.tasks.length;
    }
    await deps.store.saveProjects(userId, next);
    return text(`Added ${tasksAdded} task(s) across ${parsed.plan.projects.length} project(s).`);
  });

  server.registerTool('add_subtasks', {
    title: 'Add subtasks to a task',
    description: 'Adds subtasks to an existing task. Names must match an existing project and task (case-insensitive).',
    inputSchema: { project: z.string().min(1), task: z.string().min(1), subtasks: z.array(z.string().min(1).max(120)).min(1).max(6) },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  }, async ({ project, task, subtasks }) => {
    const { projects } = await deps.store.load(userId);
    const p = findProject(projects, project);
    const t = p?.tasks.find(x => x.name.trim().toLowerCase() === task.trim().toLowerCase());
    if (!p || !t) return fail(`No task "${task}" in project "${project}". Call list_projects to see names.`);
    t.subTasks = [...(t.subTasks ?? []), ...subtasks.map((name, i) => ({ id: `mcp-${Date.now()}-${i}`, name, completed: false }))].slice(0, 50);
    await deps.store.saveProjects(userId, projects);
    return text(`Added ${subtasks.length} subtask(s) to "${t.name}".`);
  });

  server.registerTool('set_deadline', {
    title: 'Set a project deadline',
    description: 'Sets or changes the exam/deadline date for a project.',
    inputSchema: { project: z.string().min(1), deadline: DAY },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  }, async ({ project, deadline }) => {
    const { projects } = await deps.store.load(userId);
    const p = findProject(projects, project);
    if (!p) return fail(`No project "${project}". Call list_projects to see names.`);
    if (Number.isNaN(Date.parse(deadline))) return fail('That is not a real date.');
    p.deadline = deadline;
    await deps.store.saveProjects(userId, projects);
    return text(`Deadline for "${p.name}" is now ${deadline}.`);
  });

  return server;
};

/** One stateless MCP request. Works on Cloudflare Workers, Deno, Bun and Node 22 (Web standard Request/Response). */
export const handleMcpRequest = async (request: Request, deps: ConnectorDeps): Promise<Response> => {
  const userId = await deps.authenticate(request);
  if (!userId) {
    const challenge = deps.resourceMetadataUrl ? `Bearer resource_metadata="${deps.resourceMetadataUrl}"` : 'Bearer';
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'content-type': 'application/json', 'www-authenticate': challenge } });
  }
  const server = createKairoServer(deps, userId);
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
};

export const memoryStore = (seed: Record<string, KairoState> = {}): KairoStore & { data: Map<string, KairoState> } => {
  const data = new Map<string, KairoState>(Object.entries(seed));
  return {
    data,
    async load(userId) { return structuredClone(data.get(userId) ?? { projects: [], sessions: [] }); },
    async saveProjects(userId, projects) {
      const current = data.get(userId) ?? { projects: [], sessions: [] };
      data.set(userId, { ...current, projects: structuredClone(projects) });
    },
  };
};
