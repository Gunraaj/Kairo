import React, { useEffect, useRef, useState } from 'react';
import {
  castToChromecast, closeSecondScreen, getSoundOnTvPreference, openSecondScreen, setSoundOnTvPreference, stopChromecast, useCastStatus,
} from '../utils/castDisplay';

type Props = { onTvMode: () => void; onMessage: (text: string) => void };

/** "TV" button: Chromecast (best), cast this tab, or a second screen. */
export const CastMenu: React.FC<Props> = ({ onTvMode, onMessage }) => {
  const [open, setOpen] = useState(false);
  const [soundOnTv, setSoundOnTv] = useState(getSoundOnTvPreference);
  const [busy, setBusy] = useState(false);
  const { secondTab, chromecast } = useCastStatus();
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

  const cast = async (fullPage = false) => {
    setBusy(true);
    try {
      if (await castToChromecast(fullPage)) {
        onMessage(fullPage ? 'Sent to your TV in full-page mode.' : 'Casting to your TV. It can take a few seconds to appear.');
        setOpen(false);
      }
    } catch (error) {
      onMessage(error instanceof Error ? error.message : 'Could not cast.');
    } finally {
      setBusy(false);
    }
  };

  const live = chromecast === 'on';

  return (
    <div className="k-cast" ref={box}>
      <button
        type="button"
        className={`k-zen-pill-btn ${live || secondTab ? 'is-active' : ''}`}
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Show the timer on a TV"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M2 11.5a2.5 2.5 0 012.5 2.5M2 8.5A5.5 5.5 0 017.5 14M2 5.5V3.5a1 1 0 011-1h10a1 1 0 011 1v9a1 1 0 01-1 1h-3.5" />
        </svg>
        <span className="k-pill-label">{live ? 'On TV' : 'TV'}</span>
      </button>
      {open && (
        <div className="k-cast-menu" role="dialog" aria-label="Show on TV">
          <p className="k-cast-title">Show the timer on a TV</p>
          {live ? (
            <>
              <p className="k-settings-hint">Your timer is on the TV. Keep this tab open; it keeps the TV in sync.</p>
              <button type="button" className="k-btn" onClick={() => { stopChromecast(); setOpen(false); }}>Stop casting</button>
              <button type="button" className="k-link-btn" disabled={busy} onClick={() => void cast(true)}>TV stuck on the DashCast screen? Try full-page mode</button>
            </>
          ) : (
            <>
              <button type="button" className="k-btn k-btn-primary" disabled={busy || chromecast === 'connecting'} onClick={() => void cast()}>
                {busy ? 'Connecting…' : 'Cast to Chromecast'}
              </button>
              <p className="k-settings-hint">Best quality. The Chromecast or Google TV shows the big timer itself, on the same Wi-Fi. Works in Chrome and Edge.</p>
            </>
          )}
          <label className="k-cast-check">
            <input type="checkbox" checked={soundOnTv} onChange={e => { setSoundOnTv(e.target.checked); setSoundOnTvPreference(e.target.checked); }} />
            <span>Play sound on the TV (focus sound and Sound Studio go quiet here)</span>
          </label>
          {brave && <p className="k-settings-hint"><b>Brave:</b> turn on <b>Media Router</b> in brave://settings/extensions and relaunch, or casting will not work.</p>}
          <hr className="k-cast-sep" />
          <button type="button" className="k-btn" onClick={() => { setOpen(false); onTvMode(); }}>TV mode in this tab</button>
          <p className="k-settings-hint">Big timer here; then cast this tab from the browser menu (⋮ → Cast…). Use if Chromecast casting does not work.</p>
          <button type="button" className="k-btn" onClick={() => { setOpen(false); openSecondScreen(); }}>Open on a second screen</button>
          <p className="k-settings-hint">For a TV plugged in by HDMI, Miracast (Win+K) or AirPlay. Sound plays from this tab.</p>
          {secondTab && <button type="button" className="k-link-btn" onClick={() => { closeSecondScreen(); setOpen(false); }}>Close the second screen</button>}
        </div>
      )}
    </div>
  );
};
