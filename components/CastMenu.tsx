import React, { useEffect, useRef, useState } from 'react';
import { openTvView, stopCast, useCastStatus } from '../utils/castDisplay';

type Props = { soundOnTv: boolean; onSoundOnTv: (on: boolean) => void; onMessage: (text: string) => void };

/** "TV" button: cast the timer (and optionally the sound) to a TV or second screen. */
export const CastMenu: React.FC<Props> = ({ soundOnTv, onSoundOnTv, onMessage }) => {
  const [open, setOpen] = useState(false);
  const { casting } = useCastStatus();
  const box = useRef<HTMLDivElement>(null);

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
        className={`k-zen-pill-btn ${casting ? 'is-active' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Show the timer on a TV"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 11.5a2.5 2.5 0 012.5 2.5M2 8.5A5.5 5.5 0 017.5 14M2 5.5V3.5a1 1 0 011-1h10a1 1 0 011 1v9a1 1 0 01-1 1h-3.5" />
        </svg>
        <span className="k-pill-label">{casting ? 'On TV' : 'TV'}</span>
      </button>
      {open && (
        <div className="k-cast-menu" role="dialog" aria-label="Show on TV">
          <p className="k-cast-title">Show the timer on a TV</p>
          <button type="button" className="k-btn k-btn-primary" onClick={() => { openTvView(); setOpen(false); onMessage('TV view opened in a new tab. Cast that tab to your TV.'); }}>Open TV view</button>
          <ol className="k-cast-steps">
            <li>Click <b>Open TV view</b>. A new tab opens with a big timer.</li>
            <li>In that tab, open the browser menu (⋮) and choose <b>Cast…</b>. In Chrome it is under <b>Cast, save and share</b>. In Edge: <b>More tools → Cast media to device</b>.</li>
            <li>Pick your TV, then click the timer once for full screen and sound.</li>
          </ol>
          <label className="k-cast-check">
            <input type="checkbox" checked={soundOnTv} onChange={e => onSoundOnTv(e.target.checked)} />
            <span>Play focus sound on the TV instead of here</span>
          </label>
          {'brave' in navigator && <p className="k-settings-hint"><b>Brave:</b> casting is off by default. Turn on <b>Media Router</b> in brave://settings/extensions, relaunch, then the Cast option appears in the menu.</p>}
          <p className="k-settings-hint">Works with Chromecast and Google TV on the same Wi-Fi. No Chromecast? Drag the TV tab to a TV plugged in by HDMI, press Win+K (Miracast), or use AirPlay on a Mac.</p>
          {casting && <button type="button" className="k-link-btn" onClick={() => { stopCast(); setOpen(false); }}>Stop showing on TV</button>}
        </div>
      )}
    </div>
  );
};
