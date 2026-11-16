import React, { useEffect, useRef, useState } from 'react';
import { closeSecondScreen, openSecondScreen, useSecondScreenStatus } from '../utils/castDisplay';

type Props = { onTvMode: () => void };

/** "TV" button: show the timer on a TV, by casting this tab or on a second screen. */
export const CastMenu: React.FC<Props> = ({ onTvMode }) => {
  const [open, setOpen] = useState(false);
  const { secondTab } = useSecondScreenStatus();
  const box = useRef<HTMLDivElement>(null);
  const brave = typeof navigator !== 'undefined' && 'brave' in navigator;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);

  return (
    <div className="k-cast" ref={box}>
      <button
        type="button"
        className={`k-zen-pill-btn ${secondTab ? 'is-active' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Show the timer on a TV"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 11.5a2.5 2.5 0 012.5 2.5M2 8.5A5.5 5.5 0 017.5 14M2 5.5V3.5a1 1 0 011-1h10a1 1 0 011 1v9a1 1 0 01-1 1h-3.5" />
        </svg>
        <span className="k-pill-label">TV</span>
      </button>
      {open && (
        <div className="k-cast-menu" role="dialog" aria-label="Show on TV">
          <p className="k-cast-title">Show the timer on a TV</p>
          <button type="button" className="k-btn k-btn-primary" onClick={() => { setOpen(false); onTvMode(); }}>Start TV mode</button>
          <p className="k-settings-hint">Shows a big timer in this tab. Then cast this tab from the browser menu (⋮ → <b>Cast…</b>) to a Chromecast or Google TV on the same Wi-Fi. Timer and sound stay exactly in sync.</p>
          {brave && <p className="k-settings-hint"><b>Brave:</b> turn on <b>Media Router</b> in brave://settings/extensions and relaunch, or the Cast option is missing.</p>}
          <hr className="k-cast-sep" />
          <button type="button" className="k-btn" onClick={() => { setOpen(false); openSecondScreen(); }}>Open on a second screen</button>
          <p className="k-settings-hint">For a TV plugged in by HDMI, Miracast (Win+K) or AirPlay: opens a new tab you can drag to that screen. Sound plays from this tab.</p>
          {secondTab && <button type="button" className="k-link-btn" onClick={() => { closeSecondScreen(); setOpen(false); }}>Close the second screen</button>}
        </div>
      )}
    </div>
  );
};
