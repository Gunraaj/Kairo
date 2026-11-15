import type { KairoSession, Project } from '../types';
import type { BridgePlan } from './aiBridge';
import { parseOutlineOffline } from './documentBreakdown';
import { daysBetween, toDayKey } from './planMath';
import { generateStructured, type JsonSchema, type StructuredDeps } from './structuredAi';
import { buildTodayState } from './todayPlan';

export type InputKind = 'text' | 'topics' | 'date' | 'number' | 'choice' | 'multi';
export type Question = { message: string; input: InputKind; options: string[] };
export type ChatLine = { role: 'coach' | 'student'; text: string };

/* ------------------------------------------------------------------ */
/* Fixed questions: used with no AI, and for the first question always */
/* ------------------------------------------------------------------ */

export type SlotId = 'subject' | 'date' | 'topics' | 'weak' | 'hours' | 'papers' | 'extra';
export type Answers = Partial<Record<SlotId, string>>;

export const SCRIPT: Array<{ id: SlotId; question: (a: Partial<Record<SlotId, string>>) => Question }> = [
  { id: 'subject', question: () => ({ message: 'What are you preparing for? An exam name or subject is enough.', input: 'text', options: [] }) },
  { id: 'date', question: () => ({ message: 'When is it?', input: 'date', options: ['Tomorrow', 'In 3 days', 'In 1 week', 'In 2 weeks'] }) },
  { id: 'topics', question: () => ({ message: 'List the topics, or paste the syllabus. One per line or separated by commas.', input: 'topics', options: [] }) },
  { id: 'weak', question: a => ({ message: 'Which of these feel weakest? Pick any, or type.', input: 'multi', options: [...splitTopics(a.topics ?? '').slice(0, 6), 'None really'] }) },
  { id: 'hours', question: () => ({ message: 'How many hours a day can you study until then?', input: 'number', options: ['1', '2', '3', '4', '6'] }) },
  { id: 'papers', question: () => ({ message: 'Do you have past papers or practice questions?', input: 'choice', options: ['Yes', 'No'] }) },
];

export const scriptedNext = (answers: Partial<Record<SlotId, string>>): { id: SlotId; question: Question } | null => {
  for (const slot of SCRIPT) {
    if (answers[slot.id] === undefined) {
      const question = slot.question(answers);
      if (slot.id === 'weak' && question.options.length <= 1) continue;
      return { id: slot.id, question };
    }
  }
  return null;
};

/* ------------------------------------------------------------------ */
/* Parsing helpers                                                     */
/* ------------------------------------------------------------------ */

export const splitTopics = (text: string): string[] =>
  text
    .split(/[\n,;]+/)
    .map(t => t.replace(/^\s*(?:[-*•]|\d+[.)]|#+)\s*/, '').trim())
    .filter(t => t.length > 1 && !/^unit\s*\d+:?$/i.test(t))
    .slice(0, 40);

const addDays = (today: string, days: number): string => {
  const [y, m, d] = today.split('-').map(Number);
  return toDayKey(new Date(y!, m! - 1, d! + days));
};

/** "2026-12-01", "tomorrow", "in 3 days", "1 week", "2 weeks", "a month" -> YYYY-MM-DD, or undefined. */
export const parseWhen = (text: string, today: string): string | undefined => {
  const t = text.trim().toLowerCase();
  const iso = /(\d{4}-\d{2}-\d{2})/.exec(t);
  if (iso && !Number.isNaN(Date.parse(iso[1]!))) return iso[1];
  if (/\btoday\b/.test(t)) return today;
  if (/\btomorrow\b/.test(t)) return addDays(today, 1);
  const n = /(\d+|a|an|one|two|three)\s*(day|week|month)/.exec(t);
  if (n) {
    const words: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3 };
    const count = words[n[1]!] ?? Number(n[1]);
    const unit = n[2] === 'day' ? 1 : n[2] === 'week' ? 7 : 30;
    if (count > 0 && count < 400) return addDays(today, count * unit);
  }
  return undefined;
};

/** "3", "2-3 hours", "90 min", "1.5h" -> hours per day (0.5..16), or undefined. */
export const parseHours = (text: string): number | undefined => {
  const m = /(\d+(?:\.\d+)?)\s*(?:-\s*\d+(?:\.\d+)?)?\s*(min|minutes|m\b)?/i.exec(text);
  if (!m) return undefined;
  const value = m[2] ? Number(m[1]) / 60 : Number(m[1]);
  return Number.isFinite(value) && value > 0 ? Math.min(16, Math.max(0.5, value)) : undefined;
};

/* ------------------------------------------------------------------ */
/* Fitting a plan to the time the student really has                   */
/* ------------------------------------------------------------------ */

/** One round = 25 min focus + 5 min break. Keep 15% slack for real life. */
export const roundsAvailable = (input: { hoursPerDay: number; today: string; deadline?: string }): number => {
  const days = input.deadline ? Math.max(1, daysBetween(input.today, input.deadline)) : 14;
  return Math.max(1, Math.floor(Math.floor((input.hoursPerDay * 60) / 30) * days * 0.85));
};

export type FitResult = { plan: BridgePlan; total: number; available: number; scaledFrom?: number; overflow: number };

/** Shrinks rounds proportionally (never below 1 per task) until the plan fits. */
export const fitPlan = (plan: BridgePlan, available: number): FitResult => {
  const tasks = plan.projects.flatMap(p => p.tasks);
  const total = tasks.reduce((sum, t) => sum + t.rounds, 0);
  if (total <= available) return { plan, total, available, overflow: 0 };
  const factor = available / total;
  for (const t of tasks) t.rounds = Math.max(1, Math.floor(t.rounds * factor));
  let sum = tasks.reduce((s, t) => s + t.rounds, 0);
  while (sum > available) {
    const biggest = tasks.reduce((a, b) => (b.rounds > a.rounds ? b : a));
    if (biggest.rounds <= 1) break;
    biggest.rounds -= 1;
    sum -= 1;
  }
  return { plan, total: sum, available, scaledFrom: total, overflow: Math.max(0, sum - available) };
};

/* ------------------------------------------------------------------ */
/* Plan without AI                                                     */
/* ------------------------------------------------------------------ */

const TECHNIQUE_STEPS = ['Recall: write what you know, notes closed', 'Practice questions', 'Fix what you got wrong'];

export const planFromAnswers = (answers: Partial<Record<SlotId, string>>, today: string): FitResult & { hoursPerDay: number } => {
  const deadline = answers.date ? parseWhen(answers.date, today) : undefined;
  const hoursPerDay = parseHours(answers.hours ?? '') ?? 2;
  const raw = (answers.topics ?? '').trim();
  const looksLikeOutline = /^\s*(#|[-*•]|\d+[.)])/m.test(raw);
  const list = splitTopics(raw);

  let tasks: BridgePlan['projects'][number]['tasks'];
  if (looksLikeOutline || list.length <= 1) {
    const outline = parseOutlineOffline(raw || answers.subject || 'Exam', { archetype: 'study', deadline });
    tasks = outline.modules.flatMap(m => m.tasks).map(t => ({ name: t.name, rounds: t.targetRounds, subtasks: t.subTasks.map(s => s.name).slice(0, 6) }));
  } else {
    tasks = list.map(name => ({ name, rounds: 2, subtasks: [...TECHNIQUE_STEPS] }));
  }

  const weak = new Set(splitTopics(answers.weak ?? '').map(w => w.toLowerCase()).filter(w => w !== 'none really'));
  const isWeak = (name: string) => [...weak].some(w => name.toLowerCase().includes(w) || w.includes(name.toLowerCase()));
  tasks = tasks.map(t => (isWeak(t.name) ? { ...t, rounds: Math.min(12, t.rounds + 1) } : t));
  tasks = [...tasks.filter(t => isWeak(t.name)), ...tasks.filter(t => !isWeak(t.name))];

  if (/^y/i.test(answers.papers ?? '')) {
    tasks.push({ name: 'Timed past paper', rounds: 3, subtasks: ['Exam conditions, no notes', 'Mark it honestly'] });
    tasks.push({ name: 'Review past paper mistakes', rounds: 2, subtasks: ['Redo each wrong answer from memory'] });
  }
  tasks.push({ name: 'Final revision: mistake list and key formulas', rounds: 2, subtasks: ['Light pass only, then rest'] });

  const plan: BridgePlan = { projects: [{ name: (answers.subject ?? '').trim().slice(0, 80) || 'Exam plan', deadline, tasks: tasks.slice(0, 40) }] };
  return { ...fitPlan(plan, roundsAvailable({ hoursPerDay, today, deadline })), hoursPerDay };
};

/* ------------------------------------------------------------------ */
/* AI interviewer                                                      */
/* ------------------------------------------------------------------ */

export const studentProfile = (projects: Project[], sessions: KairoSession[], today: string): string => {
  const state = buildTodayState({ projects, sessions, today });
  const active = state.recentDailyRounds.filter(r => r > 0);
  const avg = active.length ? active.reduce((s, r) => s + r, 0) / state.recentDailyRounds.length : 0;
  const lines = [
    `Today is ${today}. One round = 25 min focus + 5 min break, so 1 hour is about 2 rounds.`,
    active.length >= 3
      ? `Their recent average is ${avg.toFixed(1)} rounds a day.`
      : 'They have little study history in Kairo yet.',
    state.multiplier !== 1 ? `Their tasks usually take ${state.multiplier}x the estimate.` : '',
    state.projects.length ? `Existing projects: ${state.projects.map(p => p.name + (p.deadline ? ` (due ${p.deadline})` : '')).slice(0, 5).join('; ')}.` : '',
  ];
  return lines.filter(Boolean).join('\n');
};

/** What Kairo already knows for sure, stated plainly for the model. */
export const factsText = (answers: Answers, today: string): string => {
  const deadline = answers.date ? parseWhen(answers.date, today) : undefined;
  const hours = parseHours(answers.hours ?? '');
  const weak = splitTopics(answers.weak ?? '').filter(w => !/^none/i.test(w));
  return [
    `Subject or exam: ${answers.subject?.trim() || 'not given'}`,
    `Exam date: ${deadline ? `${deadline} (${daysBetween(today, deadline)} days from today)` : answers.date?.trim() || 'not given'}`,
    `Topics: ${splitTopics(answers.topics ?? '').join('; ') || answers.topics?.trim() || 'not given'}`,
    `Weak topics: ${weak.length ? weak.join('; ') : 'none named'}`,
    `Hours per day: ${hours ?? 'not given (assume 2)'}`,
    `Past papers or practice questions: ${answers.papers?.trim() || 'not given'}`,
    answers.extra ? `Extra detail from the student: ${answers.extra.trim()}` : '',
  ].filter(Boolean).join('\n');
};

const FOLLOW_UP_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    ask: { type: 'boolean' },
    message: { type: 'string', maxLength: 240 },
    input: { type: 'string', enum: ['text', 'choice', 'multi'] },
    options: { type: 'array', maxItems: 6, items: { type: 'string', maxLength: 60 } },
  },
  required: ['ask', 'message', 'input', 'options'],
};

const FOLLOW_UP = `You are Kairo's study coach. The student already answered the basics (below).
Ask ONE follow-up question that would most change how their study time should be split. Good follow-ups: the exam format (MCQ, numericals, long answers, derivations), which topics carry the most marks, a topic they have not started at all, or whether some topics are lab or practical.
Never re-ask anything already known. Max 20 words. Offer 2-6 short tap options when natural; for "which topics" questions use only their own topic names and input "multi".
If nothing useful is left to ask, set ask=false.`;

/** One adaptive question chosen by the AI after the fixed basics. Returns null when it has nothing worth asking. */
export const aiFollowUp = async (input: { answers: Answers; profile: string; today: string }, deps: StructuredDeps = {}): Promise<Question | null> => {
  const r = await generateStructured<{ ask: boolean; message: string; input: 'text' | 'choice' | 'multi'; options: string[] }>({
    schemaName: 'follow_up',
    schema: FOLLOW_UP_SCHEMA,
    system: FOLLOW_UP,
    prompt: `${input.profile}\n\nWhat the student told Kairo:\n${factsText(input.answers, input.today)}\n\nYour one follow-up question, or ask=false.`,
    maxTokens: 300,
  }, deps);
  const message = r.message.trim();
  if (!r.ask || !message) return null;
  const known = [input.answers.subject, input.answers.date, input.answers.hours].filter(Boolean).map(s => s!.toLowerCase());
  if (/\b(when is|what date|how many hours|hours per day|past papers?)\b/i.test(message) && known.length >= 3) return null;
  const options = r.options.map(o => o.trim()).filter(o => o && !/^(text|choice|multi|topics|date|number)$/i.test(o));
  return { message, input: r.input, options: options.slice(0, 6) };
};

const PLAN_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    name: { type: 'string', maxLength: 80 },
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
        required: ['name', 'rounds', 'subtasks'],
      },
    },
  },
  required: ['name', 'tasks'],
};

const PLANNER = `You write a study plan for Kairo. One round = 25 min focus + 5 min break.
- name: short project name (the exam or subject).
- tasks: in study order. One task per real topic from the student's list, using their words. Do not invent topics.
- Weak topics and high-mark topics get more rounds. Use the extra detail (exam format etc.) to shape subtasks.
- Each topic task gets 2-4 short subtasks that are active study, specific to that topic: recall with notes closed, practice questions or numericals, fix mistakes. No rereading.
- If they have past papers, add timed past paper tasks near the end. Always end with one short final revision task.
- Total rounds must fit the budget given.`;

export const aiBuildPlan = async (
  input: { answers: Answers; profile: string; today: string },
  deps: StructuredDeps = {},
): Promise<FitResult & { hoursPerDay: number }> => {
  const deadline = input.answers.date ? parseWhen(input.answers.date, input.today) : undefined;
  const hoursPerDay = parseHours(input.answers.hours ?? '') ?? 2;
  const budget = roundsAvailable({ hoursPerDay, today: input.today, deadline });
  const result = await generateStructured<{ name: string; tasks: Array<{ name: string; rounds: number; subtasks: string[] }> }>({
    schemaName: 'study_plan',
    schema: PLAN_SCHEMA,
    system: PLANNER,
    prompt: `${input.profile}\n\nWhat the student told Kairo:\n${factsText(input.answers, input.today)}\n\nBudget: at most ${budget} rounds in total.\n\nWrite the plan.`,
    maxTokens: 3500,
    timeoutMs: 180_000,
  }, deps);

  let tasks = result.tasks
    .map(t => ({ name: t.name.trim(), rounds: t.rounds, subtasks: t.subtasks.map(s => s.trim()).filter(Boolean) }))
    .filter(t => t.name);
  if (!tasks.length) throw new Error('The plan came back empty.');
  const weak = splitTopics(input.answers.weak ?? '').map(w => w.toLowerCase()).filter(w => !w.startsWith('none'));
  const isWeak = (name: string) => weak.some(w => name.toLowerCase().includes(w) || w.includes(name.toLowerCase()));
  tasks = [...tasks.filter(t => isWeak(t.name)), ...tasks.filter(t => !isWeak(t.name))];

  const name = result.name.trim() || input.answers.subject?.trim() || 'Exam plan';
  const plan: BridgePlan = { projects: [{ name: name.slice(0, 80), deadline, tasks }] };
  return { ...fitPlan(plan, budget), hoursPerDay };
};
