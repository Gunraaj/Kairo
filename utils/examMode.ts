export type ExamPhase = 'normal' | 'crunch' | 'final-days' | 'eve' | 'exam-day';

export type Technique = 'recall' | 'practice' | 'fix';

export const TECHNIQUE_TIPS: Record<Technique, { label: string; tip: string }> = {
  recall: { label: 'Recall', tip: 'Close your notes. Write or say everything you remember about the topic, then check what you missed.' },
  practice: { label: 'Practice', tip: 'Do past-paper questions or problems under time pressure. Check each answer straight away.' },
  fix: { label: 'Fix mistakes', tip: 'Go through only what you got wrong or forgot. Redo it from memory.' },
};

/** Days left until the exam day (0 = the exam is today). */
export const examPhase = (daysLeft: number): ExamPhase => {
  if (daysLeft <= 0) return 'exam-day';
  if (daysLeft === 1) return 'eve';
  if (daysLeft <= 3) return 'final-days';
  if (daysLeft <= 7) return 'crunch';
  return 'normal';
};

export const PHASE_ADVICE: Record<Exclude<ExamPhase, 'normal'>, { title: string; advice: string }> = {
  crunch: {
    title: 'Crunch week',
    advice: 'Cover the highest-weight topics first. Test yourself instead of rereading, and mix topics within a session.',
  },
  'final-days': {
    title: 'Final days',
    advice: 'No new topics now. Use past questions and your mistake list, and protect your sleep.',
  },
  eve: {
    title: 'Exam tomorrow',
    advice: 'One light pass over your mistake list, then stop. Rest is part of the plan.',
  },
  'exam-day': {
    title: 'Exam day',
    advice: 'Skim only. Eat, drink water, and arrive early.',
  },
};

export type SprintTask = { id: string; name: string; rounds: number };

export type SprintBlock = {
  kind: 'focus' | 'break' | 'long-break';
  start: Date;
  end: Date;
  taskId?: string;
  taskName?: string;
  technique?: Technique;
};

export type Sprint = {
  blocks: SprintBlock[];
  rounds: number;
  covered: string[];
  uncovered: string[];
  endsAt: Date;
};

const MINUTE = 60_000;

/**
 * Builds a timed study sprint. Topics are interleaved (two rounds per visit, then the next
 * topic) because mixing beats blocking. Each topic's visits cycle recall -> practice ->
 * fix mistakes, so there is no passive rereading. A long break follows every fourth round.
 * `stopBy` (a time of day today) trims the sprint so late-night sessions do not eat sleep.
 */
export const buildSprint = (input: {
  tasks: SprintTask[];
  minutes: number;
  start?: Date;
  focusMinutes?: number;
  stopBy?: Date;
}): Sprint => {
  const focus = input.focusMinutes ?? 25;
  const start = input.start ?? new Date();
  const limit = input.stopBy ? Math.min(input.stopBy.getTime(), start.getTime() + input.minutes * MINUTE) : start.getTime() + input.minutes * MINUTE;

  const queue = input.tasks.filter(t => t.rounds > 0).map(t => ({ ...t, left: t.rounds, visits: 0 }));
  const blocks: SprintBlock[] = [];
  const done = new Map<string, number>();
  let clock = start.getTime();
  let rounds = 0;
  let index = 0;
  let streak = 0;

  while (queue.some(t => t.left > 0)) {
    let task = queue[index % queue.length]!;
    let guard = 0;
    while (task.left === 0 && guard++ < queue.length) { index += 1; task = queue[index % queue.length]!; }
    if (task.left === 0) break;
    if (clock + focus * MINUTE > limit) break;

    const technique: Technique = (['recall', 'practice', 'fix'] as const)[Math.min(task.visits, 2)]!;
    blocks.push({ kind: 'focus', start: new Date(clock), end: new Date(clock + focus * MINUTE), taskId: task.id, taskName: task.name, technique });
    clock += focus * MINUTE;
    task.left -= 1;
    rounds += 1;
    streak += 1;
    done.set(task.id, (done.get(task.id) ?? 0) + 1);
    if (streak === 2 || task.left === 0) { streak = 0; task.visits += 1; index += 1; }

    const more = queue.some(t => t.left > 0);
    const longBreak = rounds % 4 === 0;
    const breakMinutes = longBreak ? 15 : 5;
    if (more && clock + (breakMinutes + focus) * MINUTE <= limit) {
      blocks.push({ kind: longBreak ? 'long-break' : 'break', start: new Date(clock), end: new Date(clock + breakMinutes * MINUTE) });
      clock += breakMinutes * MINUTE;
    }
  }

  return {
    blocks,
    rounds,
    covered: input.tasks.filter(t => done.has(t.id)).map(t => t.name),
    uncovered: input.tasks.filter(t => t.rounds > 0 && !done.has(t.id)).map(t => t.name),
    endsAt: new Date(blocks.length ? blocks[blocks.length - 1]!.end : start),
  };
};
