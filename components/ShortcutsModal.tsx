import React from 'react';
import { Modal } from './Modal';

interface ShortcutsModalProps {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: 'Space', desc: 'Start or pause focus timer' },
  { key: 'S', desc: 'Skip break session' },
  { key: 'R', desc: 'Reset current timer' },
  { key: 'E', desc: 'Extend focus by +5 minutes' },
  { key: 'M', desc: 'Mute or unmute all sounds' },
  { key: 'F', desc: 'Toggle Zen fullscreen mode' },
  { key: '1 / 2 / 3', desc: 'Switch mode (Focus, Short break, Long break)' },
  { key: '← / →', desc: 'Nudge focus dial by 1 minute' },
  { key: '↑ / ↓', desc: 'Nudge focus dial by 5 minutes' },
  { key: '?', desc: 'Open keyboard shortcuts' },
  { key: 'Esc', desc: 'Close dialogs or cancel task edit' },
];

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({ onClose }) => {
  return (
    <Modal titleId="shortcuts-title" onClose={onClose} className="shortcuts-dialog">
      <header className="k-modal-header">
        <div>
          <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
          <p className="k-modal-sub">Navigate Kairo without lifting your hands from the keys</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close shortcuts">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className="k-modal-body">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {SHORTCUTS.map(item => (
            <div
              key={item.key}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 10px',
                borderRadius: 'var(--r-sm)',
                background: 'var(--washi-2)',
                border: '1px solid var(--stone-3)',
              }}
            >
              <span style={{ fontSize: 13, color: 'var(--sumi)' }}>{item.desc}</span>
              <kbd
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'var(--washi-card)',
                  color: 'var(--sumi-2)',
                  border: '1px solid var(--stone-2)',
                  fontWeight: 600,
                }}
              >
                {item.key}
              </kbd>
            </div>
          ))}
        </div>
      </div>

      <footer className="k-modal-footer">
        <button type="button" className="k-btn k-btn-primary" onClick={onClose}>
          Got it
        </button>
      </footer>
    </Modal>
  );
};
