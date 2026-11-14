import React from 'react';
import { Modal } from './Modal';

export const WelcomeModal: React.FC<{
  onClose: () => void;
  onOpenScience?: () => void;
  onOpenSettings?: () => void;
}> = ({ onClose, onOpenScience, onOpenSettings }) => (
  <Modal titleId="welcome-title" onClose={onClose} className="welcome-dialog">
    <>
      <header className="k-modal-header">
        <div>
          <h2 id="welcome-title">Welcome to Kairo</h2>
          <p className="k-modal-sub">Make space for one thing.</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Dismiss welcome">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>
      <div className="k-modal-body">
        {(() => {
          const steps: Array<[string, React.ReactNode]> = [
            ['Quick Start', 'Start focusing immediately with Quick Focus, or add a project & task in the sidebar to organize your goals.'],
            ['Task Target Dots (●○○○)', 'The circles next to each task are estimated 25-minute Pomodoro rounds. Click them anytime to set your target (2, 4, 6, 8 rounds). As you complete sessions, the dots fill in solid red.'],
            ['Tune Your Pace', <>Drag the dial for any duration up to 60 minutes, then press <kbd>Space</kbd> or the red button. <kbd>S</kbd> skip · <kbd>R</kbd> reset · <kbd>E</kbd> extend +5m.</>],
            ['Atmospheric Sound Studio', 'Layer ambient rain, campfire, or real-time binaural brainwave frequencies using the Sound Studio toggle at top right.'],
            ['Track Your Evidence', 'Every completed session banks focus minutes and fills your year-at-a-glance focus heatmap in Progress. 100% private & local.'],
          ];
          return (
            <ol className="k-welcome-list">
              {steps.map(([title, body], i) => (
                <li key={i}>
                  <div className="k-welcome-text">
                    <b>{title}</b>
                    <span>{body}</span>
                  </div>
                </li>
              ))}
            </ol>
          );
        })()}
      </div>
      <footer className="k-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onOpenScience && (
            <button
              type="button"
              className="k-btn"
              onClick={onOpenScience}
              style={{ fontSize: 12 }}
            >
              📚 Read the Science
            </button>
          )}
          {onOpenSettings && (
            <button
              type="button"
              className="k-btn"
              onClick={onOpenSettings}
              style={{ fontSize: 12 }}
              title="Import an existing JSON snapshot or configure cloud sync"
            >
              📥 Import Backup / Cloud Sync
            </button>
          )}
        </div>
        <button className="k-btn k-btn-primary" onClick={onClose}>
          Start focusing
        </button>
      </footer>
    </>
  </Modal>
);
