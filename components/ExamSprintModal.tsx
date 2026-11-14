import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import type { Project } from '../types';
import { buildSprint, PHASE_ADVICE, TECHNIQUE_TIPS, type ExamPhase } from '../utils/examMode';
import { taskRounds } from '../utils/todayPlan';

interface ExamSprintModalProps {
  project: Project;
  phase: Exclude<ExamPhase, 'normal'>;
  daysLeft: number;
  onStart: (taskId: string) => void;
  onClose: () => void;
}

const HOURS = [1, 2, 3, 4, 6];
const time = (d: Date) => d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

export const ExamSprintModal: React.FC<ExamSprintModalProps> = ({ project, phase, daysLeft, onStart, onClose }) => {
  const [hours, setHours] = useState(2);
  const [protectSleep, setProtectSleep] = useState(phase !== 'exam-day');
  const advice = PHASE_ADVICE[phase];

  const sprint = useMemo(() => {
    const start = new Date();
    const bedtime = new Date(start);
    bedtime.setHours(22, 0, 0, 0);
    const tasks = project.tasks
      .filter(t => !t.completed)
      .map(t => {
        const { target, done } = taskRounds(t);
        return { id: t.id, name: t.name, rounds: Math.max(0, target - done) };
      });
    return buildSprint({
      tasks,
      minutes: hours * 60,
      start,
      stopBy: protectSleep && bedtime.getTime() > start.getTime() ? bedtime : undefined,
    });
  }, [project, hours, protectSleep]);

  const first = sprint.blocks.find(b => b.kind === 'focus');

  return (
    <Modal titleId="sprint-title" onClose={onClose} className="k-aibridge">
      <header className="k-modal-header">
        <div>
          <h2 id="sprint-title">{advice.title}: {project.name}</h2>
          <p className="k-modal-sub">{daysLeft <= 0 ? 'Exam today.' : `${daysLeft} day${daysLeft === 1 ? '' : 's'} to go.`} {advice.advice}</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>
      <div className="k-modal-body k-aibridge-body">
        <div>
          <p className="k-onboarding-note" id="sprint-hours-label">How long can you study right now?</p>
          <div className="k-faq-tabs" role="group" aria-labelledby="sprint-hours-label">
            {HOURS.map(h => (
              <button key={h} type="button" className={`k-faq-tab ${hours === h ? 'is-active' : ''}`} aria-pressed={hours === h} onClick={() => setHours(h)}>{h} h</button>
            ))}
          </div>
        </div>
        <label className="k-sprint-check">
          <input type="checkbox" checked={protectSleep} onChange={e => setProtectSleep(e.target.checked)} />
          <span>Stop by 10 pm to protect sleep</span>
        </label>

        {sprint.rounds === 0 ? (
          <p className="k-onboarding-note">Nothing to schedule in that time. Pick more hours or turn off the 10 pm limit.</p>
        ) : (
          <>
            <p className="k-onboarding-note">{sprint.rounds} round{sprint.rounds === 1 ? '' : 's'}, finishing about {time(sprint.endsAt)}. Topics are mixed on purpose: it helps you remember more than finishing one topic at a time.</p>
            <ol className="k-sprint-list">
              {sprint.blocks.map((block, i) => (
                <li key={i} className={`k-sprint-row is-${block.kind}`}>
                  <span className="k-today-rounds">{time(block.start)}</span>
                  {block.kind === 'focus' ? (
                    <span><b>{block.taskName}</b> <span className={`k-sprint-tag is-${block.technique}`}>{TECHNIQUE_TIPS[block.technique!].label}</span></span>
                  ) : (
                    <span className="k-sprint-break">{block.kind === 'long-break' ? 'Long break: walk, water, no phone' : 'Break'}</span>
                  )}
                </li>
              ))}
            </ol>
            {sprint.uncovered.length > 0 && (
              <p className="k-today-warn">Not reached in this sprint: {sprint.uncovered.slice(0, 4).join(', ')}{sprint.uncovered.length > 4 ? '...' : ''}. Put the most valuable topics first in your plan.</p>
            )}
            <dl className="k-sprint-legend">
              {(Object.keys(TECHNIQUE_TIPS) as Array<keyof typeof TECHNIQUE_TIPS>).map(key => (
                <div key={key}><dt>{TECHNIQUE_TIPS[key].label}</dt><dd>{TECHNIQUE_TIPS[key].tip}</dd></div>
              ))}
            </dl>
          </>
        )}

        <div className="k-onboarding-actions">
          <button type="button" className="k-btn k-btn-primary" disabled={!first} onClick={() => { if (first?.taskId) onStart(first.taskId); onClose(); }}>
            Start first block
          </button>
          <button type="button" className="k-btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </Modal>
  );
};
