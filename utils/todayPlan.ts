import type { KairoSession, Project, Task } from '../types';
import { applyMultiplier, estimateMultiplier, paceStatus, spreadRounds, toDayKey, type Pace } from './planMath';

export const DEFAULT_DAILY_GOAL = 4;
const HISTORY_DAYS = 14;

export type TodayBlock = {
  projectId: string;
  projectName: string;
  taskId: string;
  taskName: string;
  /** Rounds still to do for this block today (already scaled by the student's estimate multiplier). */
  rounds: number;
  /** Why it is on the list. */
  reason: 'deadline' | 'up-next';
  deadline?: string;
};

export type ProjectPlan = {
  projectId: string;
  name: string;
  deadline?: string;
  totalRounds: number;
  doneRounds: number;
  remainingRounds: number;
  pace?: Pace;
  overflowRounds: number;
  capPerDay: number;
};

export type TodayState = {
  blocks: TodayBlock[];
  projects: ProjectPlan[];
  multiplier: number;
  roundsToday: number;
  plannedToday: number;
  goal: number;
  recentDailyRounds: number[];
  hasPlan: boolean;
};

export const taskRounds = (task: Task, defaultLength = 25): { target: number; done: number } => {
  const length = task.pomodoroLength || defaultLength;
  return { target: Math.max(1, task.targetRounds ?? 1), done: Math.floor((task.timeSpent || 0) / length) };
};

/** Completed focus time per day (in rounds of `roundMinutes`), oldest first, ending today. */
export const recentRounds = (sessions: KairoSession[], today: string, days = HISTORY_DAYS, roundMinutes = 25): number[] => {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    if (s.type !== 'focus' || !s.completed || !Number.isFinite(s.duration)) continue;
    const date = new Date(s.date);
    if (Number.isNaN(date.getTime())) continue;
    const key = toDayKey(date);
    totals.set(key, (totals.get(key) ?? 0) + s.duration / roundMinutes);
  }
  const [y, m, d] = today.split('-').map(Number);
  const out: number[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    out.push(Math.round((totals.get(toDayKey(new Date(y!, m! - 1, d! - back))) ?? 0) * 10) / 10);
  }
  return out;
};

export const buildTodayState = (input: {
  projects: Project[];
  sessions: KairoSession[];
  today?: string;
  dailyGoal?: number;
}): TodayState => {
  const today = input.today ?? toDayKey(new Date());
  const goal = Math.max(1, input.dailyGoal ?? DEFAULT_DAILY_GOAL);
  const recentDailyRounds = recentRounds(input.sessions, today);
  const roundsToday = recentDailyRounds[recentDailyRounds.length - 1] ?? 0;
  // No study at all yet means no pace data, not a pace of zero.
  // A couple of sessions is not a pace either: need at least 3 active days.
  const paceHistory = recentDailyRounds.filter(r => r > 0).length >= 3 ? recentDailyRounds : [];
  // Realistic daily capacity: the goal with some stretch, or 1.5x the student's best recent day.
  const capPerDay = Math.max(goal * 1.5, Math.ceil(Math.max(0, ...recentDailyRounds) * 1.5));

  const finished: Array<{ estimatedRounds: number; actualRounds: number }> = [];
  for (const project of input.projects) {
    for (const task of project.tasks) {
      const { target, done } = taskRounds(task);
      if (task.completed && done > 0) finished.push({ estimatedRounds: task.estimatedRounds ?? target, actualRounds: done });
    }
  }
  const multiplier = estimateMultiplier(finished);

  const plans: ProjectPlan[] = [];
  const blocks: TodayBlock[] = [];
  const upNext: TodayBlock[] = [];

  const ordered = [...input.projects].sort((a, b) => (a.deadline ?? '9999').localeCompare(b.deadline ?? '9999'));
  for (const project of ordered) {
    const open = project.tasks.filter(t => !t.completed);
    const rows = project.tasks.map(t => taskRounds(t));
    const totalRounds = rows.reduce((sum, r) => sum + r.target, 0);
    const doneRounds = rows.reduce((sum, r) => sum + Math.min(r.done, r.target), 0);
    const remaining = open.map(t => {
      const { target, done } = taskRounds(t);
      return { task: t, rounds: applyMultiplier(Math.max(0, target - done) || (done >= target ? 0 : 1), multiplier) };
    }).filter(r => r.rounds > 0);
    const remainingRounds = remaining.reduce((sum, r) => sum + r.rounds, 0);

    const plan: ProjectPlan = {
      projectId: project.id, name: project.name, deadline: project.deadline,
      totalRounds, doneRounds, remainingRounds, overflowRounds: 0, capPerDay,
    };

    if (project.deadline && remaining.length > 0) {
      plan.pace = paceStatus({ remainingRounds, today, deadline: project.deadline, recentDailyRounds: paceHistory, dailyCap: capPerDay });
      const spread = spreadRounds({
        tasks: remaining.map(r => ({ id: r.task.id, rounds: r.rounds })),
        today,
        deadline: project.deadline,
        dailyCap: capPerDay,
      });
      plan.overflowRounds = spread.overflowRounds;
      for (const block of spread.blocks.filter(b => b.date === today)) {
        const task = remaining.find(r => r.task.id === block.taskId)!.task;
        blocks.push({ projectId: project.id, projectName: project.name, taskId: task.id, taskName: task.name, rounds: block.rounds, reason: 'deadline', deadline: project.deadline });
      }
    } else if (!project.deadline) {
      for (const r of remaining) {
        upNext.push({ projectId: project.id, projectName: project.name, taskId: r.task.id, taskName: r.task.name, rounds: r.rounds, reason: 'up-next' });
      }
    }
    plans.push(plan);
  }

  const planned = blocks.reduce((sum, b) => sum + b.rounds, 0);
  let room = Math.max(0, goal - planned);
  for (const next of upNext) {
    if (room <= 0) break;
    const take = Math.min(room, next.rounds);
    blocks.push({ ...next, rounds: take });
    room -= take;
  }

  return {
    blocks,
    projects: plans,
    multiplier,
    roundsToday,
    plannedToday: blocks.reduce((sum, b) => sum + b.rounds, 0),
    goal,
    recentDailyRounds,
    hasPlan: plans.some(p => p.remainingRounds > 0),
  };
};
