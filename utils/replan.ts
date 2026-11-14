import type { Project, Task } from '../types';
import { generateStructured, type JsonSchema, type StructuredDeps } from './structuredAi';
import { taskRounds, type ProjectPlan } from './todayPlan';

export type ReplanOp =
  | { kind: 'set_rounds'; taskId: string; taskName: string; rounds: number; reason: string }
  | { kind: 'drop'; taskId: string; taskName: string; reason: string }
  | { kind: 'split'; taskId: string; taskName: string; parts: Array<{ name: string; rounds: number }>; reason: string }
  | { kind: 'reorder'; taskId: string; taskName: string; position: number; reason: string };

export const REPLAN_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    changes: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['set_rounds', 'drop', 'split', 'reorder'] },
          task: { type: 'string', maxLength: 160 },
          rounds: { type: 'integer', minimum: 1, maximum: 12 },
          position: { type: 'integer', minimum: 1, maximum: 60 },
          parts: {
            type: 'array',
            maxItems: 4,
            items: {
              type: 'object',
              properties: { name: { type: 'string', maxLength: 120 }, rounds: { type: 'integer', minimum: 1, maximum: 12 } },
              required: ['name', 'rounds'],
            },
          },
          reason: { type: 'string', maxLength: 160 },
        },
        required: ['kind', 'task', 'reason'],
      },
    },
  },
  required: ['changes'],
};

const SYSTEM = `You help a student catch up on a study plan without burning out.
You are given their remaining tasks (in order) and pace numbers computed by the app. Propose at most 6 changes that make the plan fit before the deadline while keeping prerequisites first:
- set_rounds: change the rounds for one task (re-estimate).
- drop: remove a task that is optional or low value. Never drop a task already started.
- split: break a big task into 2-4 smaller tasks (only if not started).
- reorder: move a task to a 1-based position in the remaining list.
Use the exact task names given. Give a one-line reason for each. If the plan already fits, return no changes. Do not invent new topics.`;

const findTask = (project: Project, name: string): Task | undefined => {
  const wanted = name.trim().toLowerCase();
  return project.tasks.find(t => !t.completed && t.name.trim().toLowerCase() === wanted);
};

/** Maps raw model output to ops that refer to real, not-yet-finished tasks. Unknown or unsafe ops are dropped. */
export const resolveReplanOps = (project: Project, raw: Array<Record<string, any>>): ReplanOp[] => {
  const ops: ReplanOp[] = [];
  const used = new Set<string>();
  for (const change of raw) {
    const task = findTask(project, String(change.task ?? ''));
    if (!task || used.has(task.id)) continue;
    const base = { taskId: task.id, taskName: task.name, reason: String(change.reason ?? '').slice(0, 160) };
    const started = (task.timeSpent || 0) > 0;
    if (change.kind === 'set_rounds' && Number.isFinite(change.rounds)) {
      const floor = Math.max(1, taskRounds(task).done);
      const rounds = Math.min(12, Math.max(floor, Math.round(change.rounds)));
      if (rounds === taskRounds(task).target) continue;
      ops.push({ kind: 'set_rounds', ...base, rounds });
    } else if (change.kind === 'drop' && !started) {
      ops.push({ kind: 'drop', ...base });
    } else if (change.kind === 'split' && !started && Array.isArray(change.parts) && change.parts.length >= 2) {
      ops.push({ kind: 'split', ...base, parts: change.parts.slice(0, 4).map((p: any) => ({ name: String(p.name).slice(0, 120), rounds: Math.min(12, Math.max(1, Math.round(p.rounds))) })) });
    } else if (change.kind === 'reorder' && Number.isFinite(change.position)) {
      ops.push({ kind: 'reorder', ...base, position: Math.max(1, Math.round(change.position)) });
    } else {
      continue;
    }
    used.add(task.id);
  }
  return ops;
};

/** Pure: returns a new project with the chosen ops applied. */
export const applyReplanOps = (project: Project, ops: ReplanOp[], newId: () => string = () => crypto.randomUUID()): Project => {
  const tasks = [...project.tasks];
  for (const op of ops) {
    const index = tasks.findIndex(t => t.id === op.taskId);
    if (index < 0) continue;
    const task = tasks[index]!;
    if (op.kind === 'set_rounds') {
      tasks[index] = { ...task, targetRounds: op.rounds, estimatedRounds: task.estimatedRounds ?? task.targetRounds };
    } else if (op.kind === 'drop') {
      if ((task.timeSpent || 0) === 0) tasks.splice(index, 1);
    } else if (op.kind === 'split') {
      if ((task.timeSpent || 0) > 0) continue;
      const parts: Task[] = op.parts.map((part, i) => ({
        id: newId(), name: part.name, completed: false, timeSpent: 0, status: 'todo',
        targetRounds: part.rounds, estimatedRounds: part.rounds,
        subTasks: i === 0 ? task.subTasks : undefined,
      }));
      tasks.splice(index, 1, ...parts);
    } else if (op.kind === 'reorder') {
      tasks.splice(index, 1);
      const open = tasks.map((t, i) => ({ t, i })).filter(x => !x.t.completed);
      const target = open[Math.min(op.position, open.length + 1) - 1];
      tasks.splice(target ? target.i : tasks.length, 0, task);
    }
  }
  return { ...project, tasks };
};

export class ReplanUnavailableError extends Error {}

/** Asks the configured AI for changes. Throws ReplanUnavailableError when no AI is usable. */
export const proposeReplan = async (
  input: { project: Project; plan: ProjectPlan; multiplier: number },
  deps: StructuredDeps = {},
): Promise<ReplanOp[]> => {
  const { project, plan, multiplier } = input;
  const open = project.tasks.filter(t => !t.completed);
  const lines = open.map((t, i) => {
    const { target, done } = taskRounds(t);
    return `${i + 1}. ${t.name} - ${done}/${target} rounds done${(t.timeSpent || 0) > 0 ? ' (started)' : ''}`;
  });
  const pace = plan.pace;
  const prompt = [
    `Project: ${project.name}`,
    `Deadline: ${project.deadline ?? 'none'}${pace ? ` (${pace.daysLeft} days left)` : ''}`,
    pace ? `Needs ${pace.requiredPerDay} rounds/day; the student does ${pace.actualPerDay}/day. Status: ${pace.status}.` : '',
    `The student's tasks take ${multiplier}x their estimates.`,
    `Rounds still to do: ${plan.remainingRounds}.`,
    pace ? `About ${Math.floor(plan.capPerDay * pace.daysLeft)} rounds realistically fit before the deadline (${plan.capPerDay}/day). ${plan.remainingRounds > plan.capPerDay * pace.daysLeft ? `You must cut about ${Math.ceil(plan.remainingRounds - plan.capPerDay * pace.daysLeft)} rounds: lower rounds, drop optional tasks, and say in a reason if the deadline should move.` : 'The plan can fit; only suggest changes that reduce risk.'}` : '',
    'Remaining tasks in order:',
    ...lines,
  ].filter(Boolean).join('\n');

  try {
    const result = await generateStructured<{ changes: Array<Record<string, any>> }>(
      { schemaName: 'replan', schema: REPLAN_SCHEMA, system: SYSTEM, prompt, maxTokens: 1800 },
      deps,
    );
    return resolveReplanOps(project, result.changes);
  } catch (err) {
    throw new ReplanUnavailableError(err instanceof Error ? err.message : 'AI is not available.');
  }
};
