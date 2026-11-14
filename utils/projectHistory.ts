import type { KairoSession, Project } from '../types';
import { toDayKey } from './planMath';
import { taskRounds } from './todayPlan';

export type ProjectHistory = {
  totalMinutes: number;
  sessionCount: number;
  activeDays: number;
  firstDay?: string;
  lastDay?: string;
  /** Focus minutes per day, oldest first, ending today. */
  daily: Array<{ date: string; minutes: number }>;
  tasks: Array<{ id: string; name: string; minutes: number; sessions: number; doneRounds: number; targetRounds: number; completed: boolean }>;
  recent: Array<{ id: string; date: string; taskName: string; minutes: number; intention?: string }>;
};

/** Per-project tracker. Sessions are matched to the project through their task id (tasks that were deleted drop out). */
export const buildProjectHistory = (input: { project: Project; sessions: KairoSession[]; today?: string; days?: number }): ProjectHistory => {
  const today = input.today ?? toDayKey(new Date());
  const days = input.days ?? 30;
  const taskIds = new Map(input.project.tasks.map(t => [t.id, t]));
  const mine = input.sessions
    .filter(s => s.type === 'focus' && s.completed && s.taskId && taskIds.has(s.taskId) && Number.isFinite(s.duration) && !Number.isNaN(new Date(s.date).getTime()))
    .sort((a, b) => b.date.localeCompare(a.date));

  const byDay = new Map<string, number>();
  const byTask = new Map<string, { minutes: number; sessions: number }>();
  for (const s of mine) {
    const key = toDayKey(new Date(s.date));
    byDay.set(key, (byDay.get(key) ?? 0) + s.duration);
    const t = byTask.get(s.taskId!) ?? { minutes: 0, sessions: 0 };
    t.minutes += s.duration; t.sessions += 1;
    byTask.set(s.taskId!, t);
  }

  const [y, m, d] = today.split('-').map(Number);
  const daily: ProjectHistory['daily'] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const key = toDayKey(new Date(y!, m! - 1, d! - back));
    daily.push({ date: key, minutes: byDay.get(key) ?? 0 });
  }
  const dayKeys = [...byDay.keys()].sort();

  return {
    totalMinutes: mine.reduce((sum, s) => sum + s.duration, 0),
    sessionCount: mine.length,
    activeDays: byDay.size,
    firstDay: dayKeys[0],
    lastDay: dayKeys[dayKeys.length - 1],
    daily,
    tasks: input.project.tasks.map(t => {
      const stats = byTask.get(t.id) ?? { minutes: 0, sessions: 0 };
      const rounds = taskRounds(t);
      return { id: t.id, name: t.name, minutes: stats.minutes, sessions: stats.sessions, doneRounds: Math.min(rounds.done, rounds.target), targetRounds: rounds.target, completed: t.completed };
    }),
    recent: mine.slice(0, 10).map(s => ({ id: s.id, date: s.date, taskName: taskIds.get(s.taskId!)!.name, minutes: s.duration, intention: s.intention })),
  };
};
