import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import type { Project } from '../types';
import { proposeReplan, ReplanUnavailableError, type ReplanOp } from '../utils/replan';
import type { ProjectPlan } from '../utils/todayPlan';

interface ReplanModalProps {
  project: Project;
  plan: ProjectPlan;
  multiplier: number;
  onApply: (projectId: string, ops: ReplanOp[]) => void;
  onClose: () => void;
}

const describe = (op: ReplanOp): string => {
  switch (op.kind) {
    case 'set_rounds': return `Change "${op.taskName}" to ${op.rounds} round${op.rounds === 1 ? '' : 's'}`;
    case 'drop': return `Drop "${op.taskName}"`;
    case 'split': return `Split "${op.taskName}" into ${op.parts.map(p => `${p.name} (${p.rounds})`).join(', ')}`;
    case 'reorder': return `Move "${op.taskName}" to position ${op.position}`;
  }
};

export const ReplanModal: React.FC<ReplanModalProps> = ({ project, plan, multiplier, onApply, onClose }) => {
  const [state, setState] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const [ops, setOps] = useState<ReplanOp[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState('');

  useEffect(() => {
    let cancelled = false;
    proposeReplan({ project, plan, multiplier })
      .then(result => {
        if (cancelled) return;
        setOps(result);
        setPicked(new Set(result.map((_, i) => i)));
        setState('ready');
      })
      .catch(err => {
        if (cancelled) return;
        setMessage(err instanceof ReplanUnavailableError ? err.message : 'Something went wrong.');
        setState('unavailable');
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (index: number) => setPicked(prev => {
    const next = new Set(prev);
    if (next.has(index)) next.delete(index); else next.add(index);
    return next;
  });

  return (
    <Modal titleId="replan-title" onClose={onClose} className="k-aibridge">
      <header className="k-modal-header">
        <div>
          <h2 id="replan-title">Re-plan {project.name}</h2>
          <p className="k-modal-sub">Your AI suggests changes. Nothing changes until you apply.</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M4 4l8 8M12 4l-8 8" /></svg>
        </button>
      </header>
      <div className="k-modal-body k-aibridge-body">
        {state === 'loading' && <p className="k-onboarding-note" role="status">Thinking about your plan...</p>}

        {state === 'unavailable' && (
          <>
            <p className="k-onboarding-note">
              No AI is available right now ({message}). Kairo already spreads your remaining rounds evenly each day. To catch up you can move the deadline, drop topics, or set up an AI in Settings (a local model is free).
            </p>
            <p className="k-onboarding-note">You can also use <b>Use my AI</b> to re-plan with ChatGPT, Claude or Gemini.</p>
          </>
        )}

        {state === 'ready' && ops.length === 0 && (
          <p className="k-onboarding-note">The AI found nothing to change. If you still feel behind, try moving the deadline.</p>
        )}

        {state === 'ready' && ops.length > 0 && (
          <>
            <ul className="k-replan-list">
              {ops.map((op, index) => (
                <li key={`${op.taskId}-${op.kind}`}>
                  <label>
                    <input type="checkbox" checked={picked.has(index)} onChange={() => toggle(index)} />
                    <span><b>{describe(op)}</b><small>{op.reason}</small></span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="k-onboarding-actions">
              <button
                type="button"
                className="k-btn k-btn-primary"
                disabled={picked.size === 0}
                onClick={() => { onApply(project.id, ops.filter((_, i) => picked.has(i))); onClose(); }}
              >
                Apply {picked.size} change{picked.size === 1 ? '' : 's'}
              </button>
              <button type="button" className="k-btn" onClick={onClose}>Keep my plan</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
