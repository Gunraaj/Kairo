import React, { useMemo, useState } from 'react';
import type { KairoSession } from '../types';
import { Modal } from './Modal';
import { downloadIcsFile } from '../utils/calendarExport';
import {
  calculateFocusStats,
  intensityLevel,
  type YearCell,
  type YearWeek,
} from '../utils/analytics';

interface AnalyticsModalProps {
  sessions: KairoSession[];
  onClose: () => void;
}

const YearHeatmap: React.FC<{
  weeks: YearWeek[];
  selectedDay?: YearCell | null;
  onSelectDay?: (day: YearCell) => void;
}> = ({ weeks, selectedDay, onSelectDay }) => {
  const [hovered, setHovered] = React.useState<YearCell | null>(null);

  const tip = hovered && !hovered.inFuture
    ? `${hovered.date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${hovered.mins} min (Click to inspect)`
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
          <div className="k-year-grid" role="grid" aria-label="Focus activity over the past year">
            {weeks.map((week, wi) => (
              <div key={wi} className="k-year-col" role="row">
                {week.days.map((day, di) => {
                  if (!day || day.inFuture) {
                    return (
                      <div
                        key={di}
                        className={`k-year-cell l0 ${day?.inFuture ? 'future' : ''}`}
                        role="gridcell"
                        aria-hidden="true"
                      />
                    );
                  }
                  const isSelected = selectedDay && selectedDay.key === day.key;
                  const label = `${day.date.toDateString()}: ${day.mins} minute${day.mins === 1 ? '' : 's'} focused. Click to inspect.`;
                  return (
                    <button
                      key={di}
                      type="button"
                      className={`k-year-cell l${intensityLevel(day.mins)} ${isSelected ? 'is-selected' : ''}`}
                      onClick={() => onSelectDay?.(day)}
                      onMouseEnter={() => setHovered(day)}
                      onMouseLeave={() => setHovered(null)}
                      onFocus={() => setHovered(day)}
                      onBlur={() => setHovered(null)}
                      role="gridcell"
                      aria-label={label}
                      title={label}
                    />
                  );
                })}
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
  const [selectedDay, setSelectedDay] = useState<YearCell | null>(null);

  const selectedDaySessions = useMemo(() => {
    if (!selectedDay) return [];
    return sessions.filter(s => {
      if (s.type !== 'focus' || !s.completed) return false;
      const sd = new Date(s.date);
      return (
        sd.getFullYear() === selectedDay.date.getFullYear() &&
        sd.getMonth() === selectedDay.date.getMonth() &&
        sd.getDate() === selectedDay.date.getDate()
      );
    });
  }, [selectedDay, sessions]);

  const stats = useMemo(() => calculateFocusStats(sessions), [sessions]);

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
            <span className="k-progress-section-note">
              {stats.sessionCount} {stats.sessionCount === 1 ? 'session' : 'sessions'} · past year
            </span>
          </h3>
          <YearHeatmap
            weeks={stats.year.weeks}
            selectedDay={selectedDay}
            onSelectDay={setSelectedDay}
          />
          {selectedDay && (
            <div className="k-day-inspect-card">
              <div className="k-day-inspect-head">
                <div>
                  <b>{selectedDay.date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</b>
                  <span className="k-day-inspect-badge">{selectedDay.mins} min focused</span>
                </div>
                <button
                  type="button"
                  className="k-day-inspect-close"
                  onClick={() => setSelectedDay(null)}
                  aria-label="Close day details"
                >
                  ✕
                </button>
              </div>
              {selectedDaySessions.length > 0 ? (
                <ul className="k-day-session-list">
                  {selectedDaySessions.map(s => (
                    <li key={s.id} className="k-day-session-item">
                      <div className="k-day-session-info">
                        <span className="k-day-session-name">{s.taskName || 'Quick Focus'}</span>
                        {s.intention && <span className="k-day-session-intention">&ldquo;{s.intention}&rdquo;</span>}
                      </div>
                      <span className="k-day-session-time">{s.duration}m</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="k-day-session-empty">No completed focus sessions recorded on this day.</p>
              )}
            </div>
          )}
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

        {stats.recentIntentions.length > 0 && (
          <section className="k-progress-section">
            <h3 className="k-progress-section-title">
              Recent intentions
              <span className="k-progress-section-note">What you promised yourself</span>
            </h3>
            <ul className="k-intentions">
              {stats.recentIntentions.map(row => (
                <li key={row.id}>
                  <blockquote>&ldquo;{row.intention}&rdquo;</blockquote>
                  <div className="k-intention-meta">
                    <span>{row.task}</span>
                    <span aria-hidden="true">·</span>
                    <span>{row.mins} min</span>
                    <span aria-hidden="true">·</span>
                    <span>{new Date(row.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

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
      <footer className="k-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          className="k-btn"
          onClick={() => downloadIcsFile(sessions)}
          title="Export completed sessions to Apple Calendar, Google Calendar, or Outlook"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <rect x="2" y="3" width="12" height="10" rx="2" />
            <path d="M5 1v3M11 1v3M2 7h12" />
          </svg>
          <span>Export Calendar (.ics)</span>
        </button>
        <button type="button" className="k-btn k-btn-primary" onClick={onClose}>
          Close
        </button>
      </footer>
    </Modal>
  );
};
