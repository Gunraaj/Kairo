import React from 'react';
import { formatDurationCompact } from '../utils/subtaskTime';
import { NumberField } from './NumberField';

interface PlanPopoverProps {
  kind: 'task' | 'subtask';
  /** Planned number of sessions (rounds). */
  target: number;
  /** Minutes per session. */
  length: number;
  doneRounds: number;
  focusedMinutes: number;
  /** The user's default session length, marked with a star. */
  defaultLength: number;
  finish: { finishTimeFormatted: string; hoursFormatted: string };
  totalChips: number[];
  onTarget: (sessions: number) => void;
  onLength: (minutes: number) => void;
  onClose: () => void;
  align?: { count: number; estimated: number; onAlign: () => void };
}

const SESSION_PRESETS = [1, 2, 3, 4, 5, 6, 8, 10];
const LENGTH_PRESETS = [15, 20, 25, 30, 45, 50, 60];

const totalLabel = (mins: number) => (mins < 60 ? `${mins}m` : mins % 60 === 0 ? `${mins / 60}h` : `${mins / 60}h`);

export const PlanPopover: React.FC<PlanPopoverProps> = ({
  kind, target, length, doneRounds, focusedMinutes, defaultLength, finish, totalChips, onTarget, onLength, onClose, align,
}) => {
  const planned = target * length;
  const percent = Math.min(100, Math.round((doneRounds / Math.max(1, target)) * 100));
  const noun = kind === 'task' ? 'task' : 'subtask';

  return (
    <div className={`k-pomo-popover ${kind === 'subtask' ? 'k-subtask-popover' : ''}`} onClick={e => e.stopPropagation()}>
      <div className="k-pomo-pop-head">
        <div className="k-pomo-pop-title">
          <span className="k-pomo-pop-icon">🍅</span>
          <b>Plan this {noun}</b>
        </div>
        <button type="button" className="k-pomo-pop-close" onClick={onClose} aria-label="Close">✕</button>
      </div>

      <div className="k-plan-summary" aria-live="polite">
        <div className="k-plan-summary-main">
          <b>{target}</b> session{target === 1 ? '' : 's'} × <b>{length} min</b> = <b>{formatDurationCompact(planned)}</b>
        </div>
        <small title="Estimated from your session and break settings">
          Done around {finish.finishTimeFormatted} · {finish.hoursFormatted} including breaks
        </small>
      </div>

      <div className="k-plan-progress">
        <div className="k-plan-progress-bar" role="img" aria-label={`${doneRounds} of ${target} sessions done`}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <small>{doneRounds} of {target} done{focusedMinutes > 0 ? ` · ${formatDurationCompact(focusedMinutes)} focused` : ''}</small>
      </div>

      <div className="k-pomo-pop-section">
        <div className="k-pomo-pop-label-row">
          <span className="k-pomo-pop-title-sm">1. How many sessions?</span>
        </div>
        <div className="k-pomo-stepper-wrap">
          <div className="k-pomo-stepper">
            <button type="button" className="k-pomo-stepper-btn" onClick={() => onTarget(Math.max(1, target - 1))} aria-label="Fewer sessions">−</button>
            <span className="k-pomo-stepper-val" aria-live="polite">{target}</span>
            <button type="button" className="k-pomo-stepper-btn" onClick={() => onTarget(Math.min(48, target + 1))} aria-label="More sessions">+</button>
          </div>
          <label className="k-plan-type">
            <span>or type</span>
            <NumberField value={target} min={1} max={48} width={40} ariaLabel="Number of sessions" onCommit={onTarget} />
          </label>
          <div className="k-pomo-quick-chips">
            {SESSION_PRESETS.map(n => (
              <button key={n} type="button" className={`k-pomo-chip ${target === n ? 'active' : ''}`} onClick={() => onTarget(n)}>{n}</button>
            ))}
          </div>
        </div>
        <div className="k-pomo-time-calc-chips">
          <span className="k-pomo-sublabel">Or set a total time (rounded up to whole sessions)</span>
          <label className="k-plan-type">
            <span>type minutes</span>
            <NumberField value={planned} min={1} max={999} unit="min" width={40} ariaLabel="Total time in minutes" onCommit={mins => onTarget(Math.min(48, Math.max(1, Math.ceil(mins / length))))} />
          </label>
          <div className="k-pomo-quick-chips">
            {totalChips.map(mins => {
              const sessions = Math.max(1, Math.ceil(mins / length));
              return (
                <button
                  key={mins}
                  type="button"
                  className={`k-pomo-chip k-chip-duration ${target === sessions ? 'active' : ''}`}
                  onClick={() => onTarget(sessions)}
                  title={`About ${totalLabel(mins)} = ${sessions} session${sessions === 1 ? '' : 's'} of ${length} min`}
                >
                  {totalLabel(mins)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="k-pomo-pop-section">
        <div className="k-pomo-pop-label-row">
          <span className="k-pomo-pop-title-sm">2. How long is each session?</span>
          <span className="k-pomo-pop-hint">★ = your default</span>
        </div>
        <label className="k-plan-type">
          <span>or type</span>
          <NumberField value={length} min={1} max={180} unit="min" width={40} ariaLabel="Minutes per session" onCommit={onLength} />
        </label>
        <div className="k-pomo-time-chips">
          {LENGTH_PRESETS.map(mins => (
            <button key={mins} type="button" className={`k-pomo-chip ${length === mins ? 'active' : ''}`} onClick={() => onLength(mins)}>
              {mins}m{mins === defaultLength ? ' ★' : ''}
            </button>
          ))}
        </div>
      </div>

      {align && (
        <button
          type="button"
          className="k-pomo-auto-subs-btn"
          onClick={align.onAlign}
          title="Set the sessions from the estimated time of each subtask"
        >
          <span>⚡ Match my {align.count} subtask{align.count === 1 ? '' : 's'}</span>
          {align.estimated > 0 && <small>({align.estimated}m planned in subtasks)</small>}
        </button>
      )}
    </div>
  );
};
