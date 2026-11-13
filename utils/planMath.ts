/**
 * Deterministic planning maths for the re-planning loop. Pure functions, no I/O.
 * Dates are local calendar days as 'YYYY-MM-DD'. A round is one Pomodoro.
 */

export const toDayKey = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dayNumber = (key: string): number => {
  const [y, m, d] = key.split('-').map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
};

const keyFromNumber = (n: number): string => new Date(n * 86_400_000).toISOString().slice(0, 10);

/** Whole days from `from` to `to` (0 when equal, negative when `to` is earlier). */
export const daysBetween = (from: string, to: string): number => dayNumber(to) - dayNumber(from);

const median = (values: number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

/**
 * How much longer (or shorter) this person takes than estimated.
 * Median of actual/estimated over finished tasks (robust to one runaway task),
 * shrunk toward 1 so a couple of samples cannot swing the plan, clamped to [0.5, 2.5].
 */
export const estimateMultiplier = (
  finished: Array<{ estimatedRounds: number; actualRounds: number }>,
  priorWeight = 3,
): number => {
  const ratios = finished
    .filter(t => t.estimatedRounds > 0 && t.actualRounds > 0)
    .map(t => t.actualRounds / t.estimatedRounds);
  if (ratios.length === 0) return 1;
  const shrunk = (priorWeight + ratios.length * median(ratios)) / (priorWeight + ratios.length);
  return Math.round(Math.min(2.5, Math.max(0.5, shrunk)) * 100) / 100;
};

export const applyMultiplier = (rounds: number, multiplier: number): number =>
  Math.max(1, Math.round(rounds * multiplier));

export type PaceStatus = 'done' | 'on-track' | 'behind' | 'at-risk' | 'infeasible';

export type Pace = {
  status: PaceStatus;
  daysLeft: number;
  /** Rounds per day needed from today to finish before the deadline day. */
  requiredPerDay: number;
  /** Recency-weighted rounds per day actually achieved. */
  actualPerDay: number;
  /** Days of work left at the actual pace; null when there is no pace yet. */
  projectedDays: number | null;
  /** Positive = spare days, negative = days short. Null when unknown. */
  slackDays: number | null;
};

/**
 * `recentDailyRounds`: completed rounds per day, oldest first, ending yesterday or
 * today, zeros included for days off (7 to 14 entries is ideal).
 * The deadline day itself is not a working day.
 */
export const paceStatus = (input: {
  remainingRounds: number;
  today: string;
  deadline: string;
  recentDailyRounds: number[];
  dailyCap?: number;
}): Pace => {
  const dailyCap = input.dailyCap ?? 12;
  const daysLeft = Math.max(1, daysBetween(input.today, input.deadline));
  const requiredPerDay = input.remainingRounds / daysLeft;

  const history = input.recentDailyRounds;
  let weightSum = 0;
  let weighted = 0;
  history.forEach((rounds, index) => {
    const weight = 0.8 ** (history.length - 1 - index);
    weightSum += weight;
    weighted += weight * Math.max(0, rounds);
  });
  const actualPerDay = weightSum ? weighted / weightSum : 0;
  const projectedDays = actualPerDay > 0 ? Math.ceil(input.remainingRounds / actualPerDay) : null;
  const slackDays = projectedDays === null ? null : daysLeft - projectedDays;

  let status: PaceStatus;
  if (input.remainingRounds <= 0) status = 'done';
  else if (requiredPerDay > dailyCap) status = 'infeasible';
  else if (history.length === 0 || actualPerDay >= requiredPerDay * 0.9) status = 'on-track';
  else if (actualPerDay >= requiredPerDay * 0.6) status = 'behind';
  else status = 'at-risk';

  const round2 = (n: number) => Math.round(n * 100) / 100;
  return { status, daysLeft, requiredPerDay: round2(requiredPerDay), actualPerDay: round2(actualPerDay), projectedDays, slackDays };
};

export type ScheduledBlock = { date: string; taskId: string; rounds: number };

/**
 * Spreads remaining rounds evenly over the working days before the deadline,
 * keeping task order and each task as contiguous as possible. Earlier days get
 * the remainder so slack sits at the end. Rounds that cannot fit under the daily
 * cap are reported as `overflowRounds` (the plan is then infeasible as given).
 */
export const spreadRounds = (input: {
  tasks: Array<{ id: string; rounds: number }>;
  today: string;
  deadline: string;
  dailyCap?: number;
  /** Weekdays with no study, 0 = Sunday. */
  restWeekdays?: number[];
}): { blocks: ScheduledBlock[]; perDay: Record<string, number>; overflowRounds: number } => {
  const dailyCap = Math.max(1, Math.floor(input.dailyCap ?? 8));
  const rest = new Set(input.restWeekdays ?? []);
  const start = dayNumber(input.today);
  const end = Math.max(start + 1, dayNumber(input.deadline));
  let days: number[] = [];
  for (let n = start; n < end; n += 1) {
    if (!rest.has(new Date(n * 86_400_000).getUTCDay())) days.push(n);
  }
  if (days.length === 0) days = [start];

  const tasks = input.tasks
    .map(t => ({ id: t.id, rounds: Math.max(0, Math.round(t.rounds)) }))
    .filter(t => t.rounds > 0);
  const total = tasks.reduce((sum, t) => sum + t.rounds, 0);
  const base = Math.floor(total / days.length);
  const extra = total % days.length;
  const capacity = days.map((_, i) => Math.min(dailyCap, base + (i < extra ? 1 : 0)));
  // Rounds cut off by the cap on early days move to later days that still have room.
  let spill = total - capacity.reduce((sum, c) => sum + c, 0);
  for (let i = 0; i < capacity.length && spill > 0; i += 1) {
    const room = dailyCap - capacity[i]!;
    const take = Math.min(room, spill);
    capacity[i]! += take;
    spill -= take;
  }

  const blocks: ScheduledBlock[] = [];
  const perDay: Record<string, number> = {};
  let dayIndex = 0;
  for (const task of tasks) {
    let left = task.rounds;
    while (left > 0 && dayIndex < days.length) {
      if (capacity[dayIndex] === 0) { dayIndex += 1; continue; }
      const take = Math.min(left, capacity[dayIndex]!);
      const date = keyFromNumber(days[dayIndex]!);
      blocks.push({ date, taskId: task.id, rounds: take });
      perDay[date] = (perDay[date] ?? 0) + take;
      capacity[dayIndex]! -= take;
      left -= take;
    }
  }
  return { blocks, perDay, overflowRounds: spill };
};
