import React, { useEffect, useRef, useState } from 'react';
import { useAudioEngine } from '../hooks/useAudioEngine';
import { startKeepAwake } from '../utils/keepAwake';
import { isAlertSoundId, playAlertSound } from '../utils/alertSounds';
import type { AudioSettings } from '../types';
import { displayRoom, listenForDisplay, secondsLeft, useDisplayState, type AmbientLayer, type DisplayState } from '../utils/castDisplay';

const SILENT: AudioSettings = {
  isPlaying: false, engineEnabled: true, mode: 'noise', ambientPreset: 'none', baseFrequency: 200, beatFrequency: 10,
  waveType: 'sine', noiseType: 'brown', binauralVolume: 0.25, noiseVolume: 0.5, masterVolume: 0.7,
};

type Layer = { el: HTMLAudioElement | null; source: AudioBufferSourceNode | null; gain: GainNode | null; volume: number; gone: boolean };

let ambientContext: AudioContext | null = null;
const getAmbientContext = () => {
  // 22.05 kHz halves the memory of decoded loops, which matters on a Chromecast.
  if (!ambientContext) {
    try { ambientContext = new AudioContext({ sampleRate: 22050 }); } catch { ambientContext = new AudioContext(); }
  }
  return ambientContext;
};

/**
 * Web Audio route for one loop. Inside the DashCast frame, Chrome can refuse <audio>.play()
 * while still allowing Web Audio (which the focus tone uses), so this is the fallback.
 */
const startBufferLoop = async (url: string, layer: Layer) => {
  const context = getAmbientContext();
  const data = await (await fetch(url, { mode: 'cors', credentials: 'omit' })).arrayBuffer();
  const buffer = await context.decodeAudioData(data);
  if (layer.gone) return;
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  const gain = context.createGain();
  gain.gain.value = layer.volume;
  source.connect(gain).connect(context.destination);
  source.start();
  layer.source = source;
  layer.gain = gain;
  await context.resume().catch(() => undefined);
};

const stopLayer = (layer: Layer) => {
  layer.gone = true;
  if (layer.el) { layer.el.pause(); layer.el.src = ''; }
  try { layer.source?.stop(); } catch { /* not started */ }
  layer.source?.disconnect();
  layer.gain?.disconnect();
};

/** Plays Sound Studio layers on the TV. URLs were already checked against Kairo's sound library. */
const useAmbientPlayers = (layers: AmbientLayer[], enabled: boolean) => {
  const players = useRef(new Map<string, Layer>());
  useEffect(() => {
    const wanted = new Map(enabled ? layers.map(l => [l.url, l.volume]) : []);
    players.current.forEach((layer, url) => {
      if (!wanted.has(url)) { stopLayer(layer); players.current.delete(url); }
    });
    wanted.forEach((volume, url) => {
      const existing = players.current.get(url);
      if (existing) {
        existing.volume = volume;
        if (existing.el) existing.el.volume = volume;
        if (existing.gain) existing.gain.gain.value = volume;
        return;
      }
      const el = new Audio(url);
      const layer: Layer = { el, source: null, gain: null, volume, gone: false };
      players.current.set(url, layer);
      el.loop = true;
      el.volume = volume;
      el.play().catch(() => {
        // Blocked: drop the element and play the same file through Web Audio instead.
        el.src = '';
        layer.el = null;
        if (!layer.gone) void startBufferLoop(url, layer).catch(() => undefined);
      });
    });
  }, [layers, enabled]);
  useEffect(() => {
    const current = players.current;
    return () => { current.forEach(stopLayer); current.clear(); };
  }, []);
  return () => {
    void ambientContext?.resume().catch(() => undefined);
    players.current.forEach(layer => { void layer.el?.play().catch(() => undefined); });
  };
};

const SESSION_LABEL = { focus: 'Focus', shortBreak: 'Short break', longBreak: 'Long break' } as const;

const format = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

const useNow = () => {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 200); return () => window.clearInterval(id); }, []);
  return now;
};

/** Three rows (label / dial / details) so the dial sits at the exact centre of the screen. */
const Dial: React.FC<{ state: DisplayState | null; now: number; children?: React.ReactNode; waiting: string }> = ({ state, now, children, waiting }) => {
  if (!state) {
    return (
      <>
        <div className="k-tv-top" />
        <p className="k-tv-waiting">{waiting}</p>
        <div className="k-tv-bottom">{children}</div>
      </>
    );
  }
  const left = secondsLeft(state, now);
  const progress = 1 - left / state.total;
  const r = 46;
  const circumference = 2 * Math.PI * r;
  return (
    <>
      <div className="k-tv-top"><p className="k-tv-label">{state.label || SESSION_LABEL[state.sessionType]}</p></div>
      <div className="k-tv-dial">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r={r} className="k-tv-track" />
          <circle cx="50" cy="50" r={r} className="k-tv-progress" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - progress)} />
        </svg>
        <time className="k-tv-time">{format(left)}</time>
      </div>
      <div className="k-tv-bottom">
        <p className="k-tv-target">{state.target}{!state.isActive && ' · Paused'}</p>
        {children}
      </div>
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
  useEffect(() => startKeepAwake(), []);
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
      <Dial state={state} now={now} waiting="Getting the timer ready…">
        <div className="k-tv-controls">
          <button type="button" className="k-btn" onClick={onToggleTimer}>{state?.isActive ? 'Pause' : 'Start'}</button>
          <button type="button" className="k-btn" onClick={onExit}>Exit TV mode</button>
        </div>
      </Dial>
    </div>
  );
};

/** The TV page (/tv). On a Chromecast it is driven over the relay and plays sound itself. */
export const TvDisplay: React.FC = () => {
  const [state, setState] = useState<DisplayState | null>(null);
  const now = useNow();
  const onChromecast = useRef(displayRoom() !== null).current;
  const [soundBlocked, setSoundBlocked] = useState(false);

  useEffect(() => startKeepAwake(), []);
  useEffect(() => listenForDisplay(setState, () => window.close(), (id, volume, repeats) => { if (isAlertSoundId(id)) playAlertSound(id, { volume, repeats }); }), []);
  useEffect(() => {
    if (!state) return;
    const root = document.documentElement;
    root.setAttribute('data-theme', state.theme);
    if (state.palette) root.setAttribute('data-palette', state.palette);
  }, [state]);
  useEffect(() => { if (state) document.title = `${format(secondsLeft(state, now))} · Kairo`; }, [state, now]);

  const audio = state?.audio?.isPlaying ? state.audio : null;
  const engine = useAudioEngine(audio ?? SILENT);
  const ambient = state?.ambient ?? [];
  const playAmbient = useAmbientPlayers(ambient, onChromecast);
  const wantsSound = Boolean(audio) || ambient.length > 0;

  const resume = engine.resume;
  useEffect(() => {
    if (!wantsSound) { setSoundBlocked(false); return; }
    // Cast devices allow sound without a tap. A normal browser keeps audio suspended until a
    // click (the resume promise never settles), so offer a button if it has not started soon.
    let started = false;
    void resume().then(() => { started = true; setSoundBlocked(false); });
    const probe = window.setTimeout(() => { if (!started) setSoundBlocked(true); }, 1500);
    return () => window.clearTimeout(probe);
  }, [wantsSound, resume]);

  return (
    <main
      className={`k-tv ${state?.isActive ? 'is-running' : 'is-paused'}`}
      data-sound={wantsSound ? `${audio ? 'tone+' : ''}${ambient.length}` : 'off'}
      onClick={() => {
        void resume().then(() => setSoundBlocked(false));
        playAmbient();
        if (!onChromecast && !document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => undefined);
      }}
    >
      <Dial state={state} now={now} waiting={onChromecast ? 'Connecting to Kairo…' : 'Waiting for Kairo… Keep Kairo open in another tab.'}>
        {soundBlocked && <p className="k-tv-footnote">Click anywhere to turn on sound.</p>}
        {!onChromecast && <p className="k-tv-footnote">Click for full screen. Sound plays from the Kairo tab.</p>}
      </Dial>
    </main>
  );
};
