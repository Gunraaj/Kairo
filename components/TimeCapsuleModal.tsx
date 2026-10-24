import React, { useState } from 'react';
import type { TimeCapsule } from '../types';
import { Modal } from './Modal';

interface TimeCapsuleModalProps {
  capsules: TimeCapsule[];
  onSaveCapsule: (capsule: {
    message: string;
    treat: string;
    triggerType: 'rounds' | 'time' | 'tomorrow';
    targetRounds?: number;
    targetTime?: string;
  }) => void;
  onClose: () => void;
  activeUnsealed?: TimeCapsule | null;
  onClaimTreat?: (id: string) => void;
  totalCompletedRounds: number;
}

const MESSAGE_PROMPTS = [
  'Be proud of this deep work. You tackled the hardest friction point.',
  'Trust the compound momentum. Rest now with absolute freedom.',
  'One thing accomplished deeply beats twenty shallow distractions.',
  'Deep focus completed. Breathe, hydrate, and celebrate.',
];

const TREAT_IDEAS = [
  'Pour-over coffee & silence',
  'Iced ceremonial matcha',
  '20m neighborhood walk',
  'Read 1 fiction chapter',
  'Dark chocolate & stretch',
];

export const TimeCapsuleModal: React.FC<TimeCapsuleModalProps> = ({
  capsules,
  onSaveCapsule,
  onClose,
  activeUnsealed,
  onClaimTreat,
  totalCompletedRounds,
}) => {
  const [tab, setTab] = useState<'create' | 'journal'>(activeUnsealed ? 'journal' : 'create');
  const [message, setMessage] = useState('');
  const [treat, setTreat] = useState('');
  const [triggerType, setTriggerType] = useState<'rounds' | 'tomorrow' | 'time'>('rounds');
  const [targetRounds, setTargetRounds] = useState(4);
  const [targetTime, setTargetTime] = useState('18:00');

  const handleSeal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !treat.trim()) return;

    onSaveCapsule({
      message: message.trim().slice(0, 200),
      treat: treat.trim().slice(0, 100),
      triggerType,
      targetRounds: triggerType === 'rounds' ? targetRounds : undefined,
      targetTime: triggerType === 'time' ? targetTime : undefined,
    });

    setMessage('');
    setTreat('');
    setTab('journal');
  };

  const lockedCapsules = capsules.filter(c => !c.isUnlocked);
  const unlockedCapsules = capsules.filter(c => c.isUnlocked);

  return (
    <Modal titleId="capsule-modal-title" onClose={onClose} className="capsule-dialog">
      <header className="k-modal-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <h2 id="capsule-modal-title">Time Capsule</h2>
            <span className="k-capsule-kanji">未来の手紙</span>
          </div>
          <p className="k-modal-sub">
            Seal a note and a future treat for yourself. It unlocks when your focus goal is achieved.
          </p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close capsule dialog">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      {/* Unsealed Banner / Active Celebration Ceremony */}
      {activeUnsealed && (
        <div className="k-capsule-unsealed-hero">
          <div className="k-capsule-unsealed-badge">
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1l1.8 4.7L14.5 7.5l-4.7 1.8L8 14l-1.8-4.7L1.5 7.5l4.7-1.8L8 1z" />
            </svg>
            <span>Capsule Unsealed & Earned</span>
          </div>
          <div className="k-capsule-unsealed-card">
            <span className="k-capsule-from-tag">MESSAGE FROM PAST YOU:</span>
            <blockquote className="k-capsule-quote">“{activeUnsealed.message}”</blockquote>
            <div className="k-capsule-treat-box">
              <span className="k-treat-label">YOUR REWARD TREAT:</span>
              <b className="k-treat-title">{activeUnsealed.treat}</b>
            </div>
            {onClaimTreat && (
              <button
                type="button"
                className="k-btn-hero"
                style={{ width: '100%', marginTop: 10, minHeight: 40 }}
                onClick={() => onClaimTreat(activeUnsealed.id)}
              >
                Claim Treat & Celebrate
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="k-capsule-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'create'}
          className={`k-capsule-tab ${tab === 'create' ? 'active' : ''}`}
          onClick={() => setTab('create')}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
            <path d="M2 5l6 4 6-4" />
          </svg>
          <span>Seal New Capsule</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'journal'}
          className={`k-capsule-tab ${tab === 'journal' ? 'active' : ''}`}
          onClick={() => setTab('journal')}
        >
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 2h8a2 2 0 012 2v10a1 1 0 01-1 1H4a2 2 0 01-2-2V3a1 1 0 011-1z" />
            <path d="M6 6h5M6 9h4" />
          </svg>
          <span>Journal ({lockedCapsules.length} sealed · {unlockedCapsules.length} earned)</span>
        </button>
      </div>

      <div className="k-modal-body custom-scrollbar">
        {tab === 'create' ? (
          <form id="capsule-create-form" onSubmit={handleSeal} className="k-capsule-form">
            {/* Note to Future Self */}
            <div className="k-capsule-field">
              <label htmlFor="capsule-msg">
                <span>Note to Future Self</span>
                <small>{message.length}/200</small>
              </label>
              <textarea
                id="capsule-msg"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="What reminder or encouragement does future-you need to hear?"
                maxLength={200}
                rows={2}
                required
              />
              <div className="k-capsule-chips">
                {MESSAGE_PROMPTS.map(p => (
                  <button
                    key={p}
                    type="button"
                    className="k-chip-subtle"
                    onClick={() => setMessage(p)}
                  >
                    “{p.slice(0, 34)}...”
                  </button>
                ))}
              </div>
            </div>

            {/* The Treat / Reward */}
            <div className="k-capsule-field">
              <label htmlFor="capsule-treat">
                <span>The Treat / Self-Reward</span>
                <small>{treat.length}/100</small>
              </label>
              <input
                id="capsule-treat"
                type="text"
                value={treat}
                onChange={e => setTreat(e.target.value)}
                placeholder="How will you celebrate? (e.g. Pour-over coffee, 20m walk, dark chocolate)"
                maxLength={100}
                required
              />
              <div className="k-capsule-chips">
                {TREAT_IDEAS.map(t => (
                  <button
                    key={t}
                    type="button"
                    className="k-chip-subtle"
                    onClick={() => setTreat(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Unlock Trigger */}
            <div className="k-capsule-field">
              <label>When should this capsule unlock?</label>
              <div className="k-trigger-options">
                <label className={`k-trigger-card ${triggerType === 'rounds' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="trigger"
                    checked={triggerType === 'rounds'}
                    onChange={() => setTriggerType('rounds')}
                  />
                  <div className="k-trigger-info">
                    <b>Focus Rounds Milestone</b>
                    <small>After {targetRounds} completed Pomodoros from now</small>
                  </div>
                  {triggerType === 'rounds' && (
                    <div className="k-round-selector" onClick={e => e.stopPropagation()}>
                      {[2, 4, 6, 8].map(n => (
                        <button
                          key={n}
                          type="button"
                          className={targetRounds === n ? 'active' : ''}
                          onClick={() => setTargetRounds(n)}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  )}
                </label>

                <label className={`k-trigger-card ${triggerType === 'tomorrow' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="trigger"
                    checked={triggerType === 'tomorrow'}
                    onChange={() => setTriggerType('tomorrow')}
                  />
                  <div className="k-trigger-info">
                    <b>Tomorrow Morning Kickoff</b>
                    <small>Delivered on your first focus session tomorrow</small>
                  </div>
                </label>

                <label className={`k-trigger-card ${triggerType === 'time' ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="trigger"
                    checked={triggerType === 'time'}
                    onChange={() => setTriggerType('time')}
                  />
                  <div className="k-trigger-info">
                    <b>Today at Scheduled Time</b>
                    <small>Unlocks at {targetTime}</small>
                  </div>
                  {triggerType === 'time' && (
                    <input
                      type="time"
                      value={targetTime}
                      onChange={e => setTargetTime(e.target.value)}
                      className="k-time-input"
                      onClick={e => e.stopPropagation()}
                    />
                  )}
                </label>
              </div>
            </div>
          </form>
        ) : (
          <div className="k-capsule-journal">
            {/* Locked Capsules */}
            <div className="k-journal-section">
              <span className="k-section-eyebrow">
                Sealed & Waiting ({lockedCapsules.length})
              </span>
              {lockedCapsules.length === 0 ? (
                <p className="k-journal-empty">No sealed capsules waiting. Create one to motivate your next session!</p>
              ) : (
                <div className="k-capsule-card-list">
                  {lockedCapsules.map(c => {
                    const roundsLeft = c.triggerType === 'rounds'
                      ? Math.max(0, (c.targetRounds ?? 4) - (totalCompletedRounds - c.completedRoundsAtCreation))
                      : null;
                    return (
                      <div key={c.id} className="k-capsule-locked-card">
                        <div className="k-capsule-lock-icon">
                          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="3" y="7" width="10" height="7" rx="1.5" />
                            <path d="M5 7V4.5a3 3 0 016 0V7" />
                          </svg>
                        </div>
                        <div className="k-capsule-locked-content">
                          <div className="k-capsule-condition">
                            {c.triggerType === 'rounds' && `Unlocks after ${roundsLeft} more completed Pomodoro${roundsLeft === 1 ? '' : 's'}`}
                            {c.triggerType === 'tomorrow' && 'Unlocks on your first session tomorrow morning'}
                            {c.triggerType === 'time' && `Unlocks today at ${c.targetTime}`}
                          </div>
                          <blockquote className="k-capsule-hidden-msg">
                            “{c.message}”
                          </blockquote>
                          <div className="k-locked-treat">
                            <span>Promised treat:</span> <b>{c.treat}</b>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Unlocked / Earned Treats */}
            {unlockedCapsules.length > 0 && (
              <div className="k-journal-section" style={{ marginTop: 18 }}>
                <span className="k-section-eyebrow">
                  Earned Treats & Notes ({unlockedCapsules.length})
                </span>
                <div className="k-capsule-card-list">
                  {unlockedCapsules.map(c => (
                    <div key={c.id} className="k-capsule-unsealed-card compact">
                      <blockquote className="k-capsule-quote">“{c.message}”</blockquote>
                      <div className="k-capsule-treat-box">
                        <span className="k-treat-label">EARNED REWARD:</span>
                        <b className="k-treat-title">{c.treat}</b>
                      </div>
                      <small className="k-unlocked-date">
                        Unsealed {new Date(c.unlockedAt || c.createdAt).toLocaleDateString()}
                      </small>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <footer className="k-modal-footer">
        {tab === 'create' ? (
          <>
            <button type="button" className="k-btn k-btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              form="capsule-create-form"
              className="k-btn-hero"
              disabled={!message.trim() || !treat.trim()}
              style={{ minHeight: 38 }}
            >
              Seal Capsule
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className="k-btn k-btn-secondary"
              onClick={() => setTab('create')}
            >
              + Seal Another Capsule
            </button>
            <button type="button" className="k-btn k-btn-primary" onClick={onClose}>
              Done
            </button>
          </>
        )}
      </footer>
    </Modal>
  );
};
