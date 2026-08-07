import React, { useMemo } from 'react';
import type { KairoSession } from '../types';
import { Modal } from './Modal';

interface AnalyticsModalProps {
  sessions: KairoSession[];
  onClose: () => void;
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/* GitHub-style contribution grid: 53 weeks x 7 days = 371 cells. Each cell
   is a day, tinted by how many focus minutes landed there. The grid starts
   on the Sunday of the week 52 weeks ago and ends on today. */
const buildYearGrid = (focusSessions: KairoSession[]) => {
  const dayTotals = new Map<string, number>();
  focusSessions.forEach(s => {
    const d = new Date(s.date);
    d.setHours(0, 0, 0, 0);
    const key = dayKey(d);
    dayTotals.set(key, (dayTotals.get(key) ?? 0) + s.duration);
  });

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // End at the Saturday of the current week so the last column is complete
  const end = new Date(today);
  end.setDate(end.getDate() + (6 - end.getDay()));
  // Start 52 weeks before end, snapped to Sunday
  const start = new Date(end);
  start.setDate(end.getDate() - 52 * 7 + 1);
  start.setDate(start.getDate() - start.getDay());

  const weeks: Array<{
    days: Array<{ date: Date; mins: number; inFuture: boolean; key: string } | null>;
    monthLabel: string | null;
  }> = [];
  const cursor = new Date(start);
  let prevMonth = -1;
  while (cursor <= end) {
    const days: Array<{ date: Date; mins: number; inFuture: boolean; key: string } | null> = [];
    for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
      const d = new Date(cursor);
      const key = dayKey(d);
      const mins = dayTotals.get(key) ?? 0;
      days.push({ date: d, mins, inFuture: d > today, key });
      cursor.setDate(cursor.getDate() + 1);
    }
    // Month label appears on the first week where the month starts on a Sunday-or-later cell
    const firstOfMonth = days[0] && days[0].date.getDate() <= 7 && days[0].date.getMonth() !== prevMonth;
    const monthLabel = firstOfMonth ? MONTH_LABELS[days[0]!.date.getMonth()] : null;
    if (firstOfMonth) prevMonth = days[0]!.date.getMonth();
    weeks.push({ days, monthLabel });
  }

  return { weeks, dayTotals };
};

type YearCell = { date: Date; mins: number; inFuture: boolean; key: string } | null;
type YearWeek = { days: YearCell[]; monthLabel: string | null };

const intensityLevel = (mins: number): 0 | 1 | 2 | 3 | 4 => {
  if (mins <= 0) return 0;
  if (mins < 25) return 1;
  if (mins < 60) return 2;
  if (mins < 120) return 3;
  return 4;
};

const YearHeatmap: React.FC<{ weeks: YearWeek[] }> = ({ weeks }) => {
  const [hovered, setHovered] = React.useState<YearCell | null>(null);

  const tip = hovered && !hovered.inFuture
    ? `${hovered.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${hovered.mins} min`
    : hovered?.inFuture
      ? `${hovered.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} · not yet`
      : '';

  return (
    <div className="k-year">
      <div className="k-year-scroll">
        <div className="k-year-months">
          {weeks.map((w, i) => (
            <span key={i} className="k-year-month">{w.monthLabel ?? ''}</span>
          ))}
        </div>
        <div className="k-year-body">
          <div className="k-year-days">
            <span></span>
            <span>Mon</span>
            <span></span>
            <span>Wed</span>
            <span></span>
            <span>Fri</span>
            <span></span>
          </div>
          <div className="k-year-grid">
            {weeks.map((week, wi) => (
              <div key={wi} className="k-year-col">
                {week.days.map((day, di) => (
                  <div
                    key={di}
                    className={`k-year-cell l${day ? intensityLevel(day.mins) : 0} ${day?.inFuture ? 'future' : ''}`}
                    onMouseEnter={() => setHovered(day)}
                    onMouseLeave={() => setHovered(null)}
                    role={day ? 'img' : undefined}
                    aria-label={day ? `${day.date.toDateString()}: ${day.mins} minutes` : undefined}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="k-year-legend">
        <span className="k-year-tip" aria-live="polite">{tip}</span>
        <span className="k-year-scale-label">Less</span>
        <span className="k-year-cell l0" />
        <span className="k-year-cell l1" />
        <span className="k-year-cell l2" />
        <span className="k-year-cell l3" />
        <span className="k-year-cell l4" />
        <span className="k-year-scale-label">More</span>
      </div>
    </div>
  );
};

export const AnalyticsModal: React.FC<AnalyticsModalProps> = ({ sessions, onClose }) => {
  const stats = useMemo(() => {
    const focus = sessions.filter(s => s.type === 'focus' && s.completed);

    // Last 7 days, ending today
    const today = new Date();
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

    // Top tasks (all time)
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

    /* Year grid + streak. A streak breaks only after a full missed day so
       an unstarted today never reads as failure. Longest streak is over
       the same day-set. */
    const year = buildYearGrid(focus);

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
    // Longest streak: walk the last 371-day window in date order
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

    return { days, maxDay, topTasks, totalMins, sessionCount, avg, year, currentStreak, longestStreak, activeDays };
  }, [sessions]);

  const totalH = Math.floor(stats.totalMins / 60);
  const totalM = stats.totalMins % 60;

  return (
    <Modal titleId="analytics-title" onClose={onClose} className="analytics-dialog">
      <header className="k-modal-header">
        <div>
          <h2 id="analytics-title">Focus progress</h2>
          <p className="k-modal-sub">A record of your completed work</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close progress">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className="k-modal-body">
        <div className="k-progress-stats k-progress-stats-4">
          <div className="k-stat-tile">
            <div className="k-stat-tile-label">Total focus</div>
            <div className="k-stat-tile-value">
              {totalH}<span className="k-stat-tile-unit">h</span> {totalM}<span className="k-stat-tile-unit">m</span>
            </div>
          </div>
          <div className="k-stat-tile accent">
            <div className="k-stat-tile-label">Current streak</div>
            <div className="k-stat-tile-value">
              {stats.currentStreak}<span className="k-stat-tile-unit">{stats.currentStreak === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
          <div className="k-stat-tile">
            <div className="k-stat-tile-label">Best streak</div>
            <div className="k-stat-tile-value">
              {stats.longestStreak}<span className="k-stat-tile-unit">{stats.longestStreak === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
          <div className="k-stat-tile">
            <div className="k-stat-tile-label">Active days</div>
            <div className="k-stat-tile-value">{stats.activeDays}</div>
          </div>
        </div>

        <section className="k-progress-section">
          <h3 className="k-progress-section-title">
            Focus activity
            <span className="k-progress-section-note">{stats.sessionCount} sessions · past year</span>
          </h3>
          <YearHeatmap weeks={stats.year.weeks} />
        </section>

        <section className="k-progress-section">
          <h3 className="k-progress-section-title">
            Weekly activity
            <span className="k-progress-section-note">Last 7 days</span>
          </h3>
          <div className="k-weekly-chart" aria-label="Focus minutes over the last 7 days">
            {stats.days.map((d, i) => {
              const height = d.mins > 0 ? Math.max(6, (d.mins / stats.maxDay) * 100) : 0;
              return (
                <div key={i} className="k-weekly-col">
                  <div className="k-weekly-bar-wrap" title={`${d.label}: ${d.mins} min`}>
                    <div
                      className={`k-weekly-bar ${d.mins === 0 ? 'empty' : ''}`}
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <div className={`k-weekly-day ${d.isToday ? 'today' : ''}`}>{d.label}</div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="k-progress-section">
          <h3 className="k-progress-section-title">
            Top tasks
            <span className="k-progress-section-note">All time</span>
          </h3>
          {stats.topTasks.length > 0 ? (
            <div className="k-top-tasks">
              {stats.topTasks.map((task, i) => (
                <div key={i} className="k-top-task-row">
                  <span className="k-top-task-rank">{String(i + 1).padStart(2, '0')}</span>
                  <span className="k-top-task-name">{task.name}</span>
                  <span className="k-top-task-time">
                    {task.mins >= 60
                      ? `${Math.floor(task.mins / 60)}h ${task.mins % 60}m`
                      : `${task.mins} min`}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="k-empty-state">
              No focus sessions yet. Start one to begin your record.
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
};
