import React, { useEffect, useRef, useState } from 'react';
import { canCast, openTvWindow, startCast, stopCast, useCastStatus } from '../utils/castDisplay';

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

  const cast = async () => {
    try {
      await startCast();
      setOpen(false);
      onMessage('Casting the timer to your TV');
    } catch (error) {
      const name = error instanceof DOMException ? error.name : '';
      if (name === 'AbortError' || name === 'NotAllowedError') return;
      onMessage(name === 'NotFoundError' ? 'No TV found. Make sure it is on the same Wi-Fi.' : 'Could not start casting.');
    }
  };

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
          {canCast() && (
            <button type="button" className="k-btn k-btn-primary" onClick={() => void cast()}>Cast to TV</button>
          )}
          <button type="button" className="k-btn" onClick={() => { openTvWindow(); setOpen(false); }}>Open TV window</button>
          <label className="k-cast-check">
            <input type="checkbox" checked={soundOnTv} onChange={e => onSoundOnTv(e.target.checked)} />
            <span>Play focus sound on the TV instead of here</span>
          </label>
          <p className="k-settings-hint">
            {canCast() ? 'Cast to TV works with Chromecast and Google TV on the same Wi-Fi. ' : 'This browser cannot cast directly. '}
            For other TVs, open the TV window and drag it to the TV (HDMI), press Win+K (Miracast), use AirPlay on a Mac, or use your browser's Cast tab.
          </p>
          {casting && <button type="button" className="k-link-btn" onClick={() => { stopCast(); setOpen(false); }}>Stop showing on TV</button>}
        </div>
      )}
    </div>
  );
};
