import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAudioEngine } from '../hooks/useAudioEngine';
import type { AudioSettings } from '../types';
import { isCastReceiver, listenForDisplay, type DisplayState } from '../utils/castDisplay';

const SILENT: AudioSettings = {
  isPlaying: false, engineEnabled: true, mode: 'noise', ambientPreset: 'none', baseFrequency: 200, beatFrequency: 10,
  waveType: 'sine', noiseType: 'brown', binauralVolume: 0.25, noiseVolume: 0.5, masterVolume: 0.7,
};

const SESSION_LABEL = { focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' } as const;

const format = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

/** Full-screen timer for a TV or second screen. Driven entirely by messages from the main app. */
export const TvDisplay: React.FC = () => {
  const [state, setState] = useState<DisplayState | null>(null);
  const receivedAt = useRef(Date.now());
  const [now, setNow] = useState(Date.now());
  const receiver = useMemo(isCastReceiver, []);
  const [soundOn, setSoundOn] = useState(receiver);

  useEffect(() => listenForDisplay(next => { receivedAt.current = Date.now(); setState(next); }, () => window.close()), []);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(id); }, []);

  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    root.setAttribute('data-theme', state.theme);
    if (state.palette) root.setAttribute('data-palette', state.palette);
    document.title = `${format(state.timeLeft)} · Kairo`;
  }, [state]);

  const audio = state?.audio ?? null;
  const engine = useAudioEngine(audio && soundOn ? audio : SILENT);
  useEffect(() => { if (receiver && audio?.isPlaying) void engine.resume().catch(() => setSoundOn(false)); }, [receiver, audio?.isPlaying, engine]);

  if (!state) {
    return (
      <main className="k-tv">
        <p className="k-tv-waiting">Waiting for Kairo… Start or open the timer on your laptop or phone.</p>
      </main>
    );
  }

  const elapsed = state.isActive ? Math.floor((now - receivedAt.current) / 1000) : 0;
  const left = Math.max(0, state.timeLeft - elapsed);
  const progress = 1 - left / state.total;
  const r = 46;
  const circumference = 2 * Math.PI * r;

  return (
    <main className={`k-tv ${state.isActive ? 'is-running' : 'is-paused'}`}>
      <p className="k-tv-label">{state.label || SESSION_LABEL[state.sessionType]}</p>
      <div className="k-tv-dial">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} className="k-tv-track" />
          <circle cx="50" cy="50" r={r} className="k-tv-progress" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
        </svg>
        <time className="k-tv-time" aria-live="off">{format(left)}</time>
      </div>
      <p className="k-tv-target">{state.target}{!state.isActive && ' · Paused'}</p>
      {audio?.isPlaying && !soundOn && (
        <button type="button" className="k-btn k-tv-sound" onClick={() => { setSoundOn(true); void engine.resume(); }}>Play sound on this screen</button>
      )}
    </main>
  );
};
