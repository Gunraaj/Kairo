import type { KairoSession } from '../types';

export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const dayKey = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export type YearCell = { date: Date; mins: number; inFuture: boolean; key: string } | null;
export type YearWeek = { days: YearCell[]; monthLabel: string | null };

export const intensityLevel = (mins: number): 0 | 1 | 2 | 3 | 4 => {
  if (mins <= 0) return 0;
  if (mins < 25) return 1;
  if (mins < 60) return 2;
  if (mins < 120) return 3;
  return 4;
};

export const buildYearGrid = (focusSessions: KairoSession[], referenceDate: Date = new Date()) => {
  const dayTotals = new Map<string, number>();
  focusSessions.forEach(s => {
    const d = new Date(s.date);
    d.setHours(0, 0, 0, 0);
    const key = dayKey(d);
    dayTotals.set(key, (dayTotals.get(key) ?? 0) + s.duration);
  });

  const today = new Date(referenceDate);
  today.setHours(12, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));

  const start = new Date(end);
  start.setDate(end.getDate() - 52 * 7);
  start.setDate(start.getDate() - start.getDay());

  const weeks: YearWeek[] = [];
  const cursor = new Date(start);
  cursor.setHours(12, 0, 0, 0);
  let prevMonth = -1;
  while (cursor <= end) {
    const days: YearCell[] = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      const d = new Date(cursor);
      d.setHours(0, 0, 0, 0);
      const key = dayKey(d);
      const mins = dayTotals.get(key) ?? 0;
      days.push({ date: d, mins, inFuture: d > today, key });
      cursor.setDate(cursor.getDate() + 1);
    }
    const firstOfMonth = days[0] && days[0].date.getDate() <= 7 && days[0].date.getMonth() !== prevMonth;
    const monthLabel = firstOfMonth ? MONTH_LABELS[days[0]!.date.getMonth()] : null;
    if (firstOfMonth) prevMonth = days[0]!.date.getMonth();
    weeks.push({ days, monthLabel });
  }

  return { weeks, dayTotals };
};

export interface FocusAnalyticsStats {
  days: Array<{ label: string; mins: number; isToday: boolean }>;
  maxDay: number;
  topTasks: Array<{ name: string; mins: number }>;
  totalMins: number;
  sessionCount: number;
  avg: number;
  year: ReturnType<typeof buildYearGrid>;
  currentStreak: number;
  longestStreak: number;
  activeDays: number;
  recentIntentions: Array<{ id: string; date: string; intention: string; task: string; mins: number }>;
}

export const calculateFocusStats = (sessions: KairoSession[], referenceDate: Date = new Date()): FocusAnalyticsStats => {
  const focus = sessions.filter(s => s.type === 'focus' && s.completed);

  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const mins = focus
      .filter(s => {
        const sd = new Date(s.date);
        sd.setHours(0, 0, 0, 0);
        return sd.getTime() === d.getTime();
      })
      .reduce((acc, s) => acc + s.duration, 0);
    return { label: DAY_LABELS[d.getDay()], mins, isToday: i === 6 };
  });
  const maxDay = Math.max(...days.map(d => d.mins), 30);

  const byTask: Record<string, number> = {};
  focus.forEach(s => {
    const key = s.taskName || 'Unassigned';
    byTask[key] = (byTask[key] || 0) + s.duration;
  });
  const topTasks = Object.entries(byTask)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([name, mins]) => ({ name, mins }));

  const totalMins = focus.reduce((acc, s) => acc + s.duration, 0);
  const sessionCount = focus.length;
  const avg = sessionCount ? Math.round(totalMins / sessionCount) : 0;

  const year = buildYearGrid(focus, referenceDate);

  let currentStreak = 0;
  let longestStreak = 0;
  let runStreak = 0;
  const todayKey = dayKey(today);
  const cursor = new Date(today);
  if (!year.dayTotals.has(todayKey)) cursor.setDate(cursor.getDate() - 1);
  while (year.dayTotals.has(dayKey(cursor))) {
    currentStreak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const allDays = year.weeks.flatMap(w => w.days).filter((d): d is NonNullable<typeof d> => !!d);
  allDays.forEach(d => {
    if (year.dayTotals.has(d.key)) {
      runStreak += 1;
      if (runStreak > longestStreak) longestStreak = runStreak;
    } else {
      runStreak = 0;
    }
  });

  const activeDays = year.dayTotals.size;

  const recentIntentions = focus
    .filter(s => s.intention && s.intention.trim().length > 0)
    .slice(0, 6)
    .map(s => ({
      id: s.id,
      date: s.date,
      intention: s.intention as string,
      task: s.taskName ?? 'Unassigned',
      mins: s.duration,
    }));

  return {
    days,
    maxDay,
    topTasks,
    totalMins,
    sessionCount,
    avg,
    year,
    currentStreak,
    longestStreak,
    activeDays,
    recentIntentions,
  };
};
