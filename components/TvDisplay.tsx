import React, { useEffect, useState } from 'react';
import { listenForDisplay, secondsLeft, useDisplayState, type DisplayState } from '../utils/castDisplay';

const SESSION_LABEL = { focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' } as const;

const format = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

const useNow = () => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 200); return () => window.clearInterval(id); }, []);
  return now;
};

const Dial: React.FC<{ state: DisplayState | null; now: number; children?: React.ReactNode; waiting: string }> = ({ state, now, children, waiting }) => {
  if (!state) return <p className="k-tv-waiting">{waiting}</p>;
  const left = secondsLeft(state, now);
  const progress = 1 - left / state.total;
  const r = 46;
  const circumference = 2 * Math.PI * r;
  return (
    <>
      <p className="k-tv-label">{state.label || SESSION_LABEL[state.sessionType]}</p>
      <div className="k-tv-dial">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} className="k-tv-track" />
          <circle cx="50" cy="50" r={r} className="k-tv-progress" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
        </svg>
        <time className="k-tv-time">{format(left)}</time>
      </div>
      <p className="k-tv-target">{state.target}{!state.isActive && ' · Paused'}</p>
      {children}
    </>
  );
};

/**
 * TV mode inside the main tab: cast this tab and the TV shows the real timer with the real sound.
 * The app keeps running underneath, so nothing can drift.
 */
export const TvMode: React.FC<{ onExit: () => void; onToggleTimer: () => void }> = ({ onExit, onToggleTimer }) => {
  const state = useDisplayState();
  const now = useNow();
  const [hint, setHint] = useState(true);
  useEffect(() => { const id = window.setTimeout(() => setHint(false), 20000); return () => window.clearTimeout(id); }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExit();
      if (event.key === ' ') { event.preventDefault(); event.stopPropagation(); onToggleTimer(); }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onExit, onToggleTimer]);

  return (
    <div className={`k-tv k-tv-overlay ${state?.isActive ? 'is-running' : 'is-paused'}`} role="dialog" aria-label="TV mode">
      {hint && (
        <div className="k-tv-hint" role="note">
          <b>Now cast this tab to your TV</b>
          <span>Open the browser menu (⋮) → <b>Cast…</b> (Chrome: <b>Cast, save and share → Cast…</b>; Edge: <b>More tools → Cast media to device</b>) → pick your TV. The sound goes to the TV too.</span>
          <button type="button" className="k-link-btn" onClick={() => setHint(false)}>Got it</button>
        </div>
      )}
      <Dial state={state} now={now} waiting="Getting the timer ready…" />
      <div className="k-tv-controls">
        <button type="button" className="k-btn" onClick={onToggleTimer}>{state?.isActive ? 'Pause' : 'Start'}</button>
        <button type="button" className="k-btn" onClick={onExit}>Exit TV mode</button>
      </div>
    </div>
  );
};

/** The second-screen tab (?display=tv). Driven by messages from the main tab. */
export const TvDisplay: React.FC = () => {
  const [state, setState] = useState<DisplayState | null>(null);
  const now = useNow();

  useEffect(() => listenForDisplay(setState, () => window.close()), []);
  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    root.setAttribute('data-theme', state.theme);
    if (state.palette) root.setAttribute('data-palette', state.palette);
  }, [state]);
  useEffect(() => { if (state) document.title = `${format(secondsLeft(state, now))} · Kairo`; }, [state, now]);

  return (
    <main
      className={`k-tv ${state?.isActive ? 'is-running' : 'is-paused'}`}
      onClick={() => { if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => undefined); }}
    >
      <Dial state={state} now={now} waiting="Waiting for Kairo… Keep Kairo open in another tab." />
      <p className="k-tv-footnote">Click for full screen. Sound plays from the Kairo tab.</p>
    </main>
  );
};
