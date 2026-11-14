import type { KairoSession, Project } from '../types';
import type { ImportedPlan } from './importPlan';
import { conform, extractJson, type JsonSchema } from './structuredAi';
import { buildTodayState } from './todayPlan';

export type BridgePlan = {
  projects: Array<{
    name: string;
    deadline?: string;
    tasks: Array<{ name: string; rounds: number; subtasks?: string[] }>;
  }>;
};

export const BRIDGE_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    projects: {
      type: 'array',
      minItems: 1,
      maxItems: 6,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 80 },
          deadline: { type: 'string', maxLength: 10 },
          tasks: {
            type: 'array',
            minItems: 1,
            maxItems: 40,
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', maxLength: 120 },
                rounds: { type: 'integer', minimum: 1, maximum: 12 },
                subtasks: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 120 } },
              },
              required: ['name', 'rounds'],
            },
          },
        },
        required: ['name', 'tasks'],
      },
    },
  },
  required: ['projects'],
};

const MAX_CONTEXT_CHARS = 6000;
const MAX_LINK_CHARS = 20_000;
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

const SCHEMA_EXAMPLE = `{
  "projects": [
    {
      "name": "Linear Algebra midterm",
      "deadline": "2026-12-05",
      "tasks": [
        { "name": "Vector spaces and span", "rounds": 2, "subtasks": ["Definitions", "Worked examples"] }
      ]
    }
  ]
}`;

/**
 * The text a student pastes into ChatGPT, Claude, Gemini or a local model.
 * It carries only aggregate numbers and task names, never keys, emails or raw history.
 */
export const buildAiContext = (input: { projects: Project[]; sessions: KairoSession[]; today?: string }): string => {
  const state = buildTodayState({ projects: input.projects, sessions: input.sessions, today: input.today });
  const avg = state.recentDailyRounds.reduce((sum, r) => sum + r, 0) / Math.max(1, state.recentDailyRounds.length);

  const lines: string[] = [
    'You are helping me plan study sessions for Kairo, a Pomodoro planner. One "round" is one 25-minute focus session.',
    'Make a realistic plan from what I tell you after this block. Then reply with ONLY one JSON code block in exactly this shape (no other text), so I can paste it back into Kairo:',
    '```json',
    SCHEMA_EXAMPLE,
    '```',
    'Rules: 1-12 rounds per task; deadline is YYYY-MM-DD and optional; at most 6 subtasks per task; order tasks so prerequisites come first.',
    '',
    'About me (from my Kairo history):',
    `- Average focus per day over the last 14 days: ${avg.toFixed(1)} rounds.`,
    state.multiplier === 1
      ? '- I have no finished tasks yet, so use normal estimates.'
      : `- My finished tasks took ${state.multiplier}x my estimates. Size new tasks with that in mind.`,
  ];

  const open = state.projects.filter(p => p.remainingRounds > 0);
  if (open.length > 0) {
    lines.push('', 'What I already have in Kairo:');
    for (const plan of open) {
      const project = input.projects.find(p => p.id === plan.projectId);
      const remaining = (project?.tasks ?? []).filter(t => !t.completed).slice(0, 12).map(t => t.name);
      lines.push(`- ${plan.name}${plan.deadline ? ` (due ${plan.deadline})` : ''}: ${plan.doneRounds}/${plan.totalRounds} rounds done. Open: ${remaining.join('; ') || 'none'}`);
      if (plan.pace && plan.pace.status !== 'on-track') lines.push(`  Pace: ${plan.pace.status}; needs ${plan.pace.requiredPerDay} rounds/day, doing ${plan.pace.actualPerDay}.`);
    }
  }
  lines.push('', 'What I want to plan: [describe your exam, topics or syllabus here, and the date]');

  const text = lines.join('\n');
  return text.length <= MAX_CONTEXT_CHARS ? text : `${text.slice(0, MAX_CONTEXT_CHARS - 40)}\n...[trimmed]\n`;
};

/** Validates whatever the chatbot returned. Never trusts the text beyond the schema. */
export const parseAiPlan = (text: string): { plan: BridgePlan | null; errors: string[] } => {
  let parsed: unknown;
  try {
    parsed = extractJson(text);
  } catch {
    return { plan: null, errors: ['No JSON found. Ask the AI to reply with only the JSON code block.'] };
  }
  if (Array.isArray(parsed)) parsed = { projects: parsed };
  const result = conform(parsed, BRIDGE_SCHEMA);
  if (result.errors.length > 0) return { plan: null, errors: result.errors.slice(0, 6) };

  const plan = result.value as BridgePlan;
  for (const project of plan.projects) {
    if (project.deadline !== undefined && (!DAY_KEY.test(project.deadline) || Number.isNaN(Date.parse(project.deadline)))) {
      delete project.deadline;
    }
    project.name = project.name.trim() || 'Imported plan';
    project.tasks = project.tasks.filter(t => t.name.trim()).map(t => ({ ...t, name: t.name.trim() }));
  }
  plan.projects = plan.projects.filter(p => p.tasks.length > 0);
  return plan.projects.length > 0 ? { plan, errors: [] } : { plan: null, errors: ['The plan has no tasks.'] };
};

/** Maps a validated plan to import payloads, merging into existing projects with the same name. */
export const bridgeToImports = (plan: BridgePlan, existing: Project[]): ImportedPlan[] =>
  plan.projects.map(project => {
    const match = existing.find(p => p.name.trim().toLowerCase() === project.name.trim().toLowerCase());
    return {
      projectName: project.name,
      targetProjectId: match?.id,
      deadline: project.deadline,
      tasks: project.tasks.map((t, i) => ({
        name: t.name,
        targetRounds: t.rounds,
        subTasks: (t.subtasks ?? []).filter(s => s.trim()).map((s, j) => ({ id: `b-${i}-${j}`, name: s.trim(), completed: false })),
      })),
    };
  });

const toBase64Url = (text: string): string => {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const fromBase64Url = (value: string): string => {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return new TextDecoder().decode(Uint8Array.from(binary, c => c.charCodeAt(0)));
};

/** `#import=...` fragment. A fragment is never sent to a server. */
export const encodePlanLink = (plan: BridgePlan): string | null => {
  const encoded = toBase64Url(JSON.stringify(plan));
  return encoded.length <= MAX_LINK_CHARS ? `#import=${encoded}` : null;
};

export const decodePlanLink = (hash: string): { plan: BridgePlan | null; errors: string[] } => {
  const match = /^#import=([A-Za-z0-9_-]+)$/.exec(hash);
  if (!match || match[1]!.length > MAX_LINK_CHARS) return { plan: null, errors: ['Not a Kairo plan link.'] };
  try {
    return parseAiPlan(fromBase64Url(match[1]!));
  } catch {
    return { plan: null, errors: ['The plan link is damaged.'] };
  }
};
