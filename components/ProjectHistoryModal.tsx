import React, { useMemo } from 'react';
import { Modal } from './Modal';
import type { KairoSession, Project } from '../types';
import { buildProjectHistory } from '../utils/projectHistory';
import { formatDurationCompact } from '../utils/subtaskTime';

interface ProjectHistoryModalProps {
  project: Project;
  sessions: KairoSession[];
  onClose: () => void;
}

const dayLabel = (iso: string) => new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });

export const ProjectHistoryModal: React.FC<ProjectHistoryModalProps> = ({ project, sessions, onClose }) => {
  const history = useMemo(() => buildProjectHistory({ project, sessions }), [project, sessions]);
  const peak = Math.max(30, ...history.daily.map(d => d.minutes));
  const finished = history.tasks.filter(t => t.completed).length;

  return (
    <Modal titleId="history-title" onClose={onClose} className="k-aibridge">
      <header className="k-modal-header">
        <div>
          <h2 id="history-title">{project.name}: history</h2>
          <p className="k-modal-sub">What you actually did on this project, from your focus sessions.</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>
      <div className="k-modal-body k-aibridge-body">
        <div className="k-history-stats">
          <div><b>{formatDurationCompact(history.totalMinutes)}</b><small>focused</small></div>
          <div><b>{history.sessionCount}</b><small>sessions</small></div>
          <div><b>{history.activeDays}</b><small>active days</small></div>
          <div><b>{finished}/{history.tasks.length}</b><small>tasks done</small></div>
        </div>

        {history.sessionCount === 0 ? (
          <p className="k-onboarding-note">No focus sessions on this project yet. Start one from Today and your history will build here.</p>
        ) : (
          <>
            <p className="k-onboarding-note">
              {history.firstDay && history.lastDay ? `From ${dayLabel(history.firstDay)} to ${dayLabel(history.lastDay)}. ` : ''}Last 30 days:
            </p>
            <div className="k-history-bars" role="img" aria-label="Focus minutes per day over the last 30 days">
              {history.daily.map(day => (
                <span key={day.date} title={`${dayLabel(day.date)}: ${day.minutes} min`} style={{ height: `${Math.max(2, Math.round((day.minutes / peak) * 100))}%` }} className={day.minutes > 0 ? 'has-time' : ''} />
              ))}
            </div>
          </>
        )}

        <h3 className="k-today-projects-title">Tasks</h3>
        <ul className="k-history-tasks">
          {history.tasks.map(task => (
            <li key={task.id}>
              <div>
                <b>{task.completed ? '✓ ' : ''}{task.name}</b>
                <small>{task.doneRounds}/{task.targetRounds} sessions{task.minutes > 0 ? ` · ${formatDurationCompact(task.minutes)} in ${task.sessions} session${task.sessions === 1 ? '' : 's'}` : ''}</small>
              </div>
              <div className="k-plan-progress-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, Math.round((task.doneRounds / Math.max(1, task.targetRounds)) * 100))}%` }} /></div>
            </li>
          ))}
        </ul>

        {history.recent.length > 0 && (
          <>
            <h3 className="k-today-projects-title">Recent sessions</h3>
            <ul className="k-history-recent">
              {history.recent.map(item => (
                <li key={item.id}>
                  <span className="k-today-rounds">{dayLabel(item.date)}</span>
                  <span><b>{item.taskName}</b>{item.intention ? <small> · {item.intention}</small> : null}</span>
                  <span className="k-today-rounds">{item.minutes} min</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Modal>
  );
};
