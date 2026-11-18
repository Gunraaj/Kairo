import { useSyncExternalStore } from 'react';
import type { AudioSettings, SessionType } from '../types';
import { isTrustedAmbientUrl } from './embed';
import { isAlertSoundId, playAlertSound } from './alertSounds';
import { openRelay, randomRoom, ROOM_PATTERN, type Relay } from './tvRelay';

/**
 * Showing the timer on a TV, all free:
 *  1. Cast to Chromecast: Kairo asks the Chromecast to open DashCast, a free public Cast app
 *     (app id 84912283, used by Home Assistant) that loads a web page on the TV. It loads
 *     Kairo's /tv page, which the Chromecast renders itself (full quality, its own sound) and
 *     keeps in sync with this tab over Supabase Realtime, in a room with an unguessable id.
 *  2. TV mode in this tab, then the browser's own "Cast tab" (mirroring).
 *  3. A second tab for a screen plugged in by HDMI / Miracast / AirPlay (BroadcastChannel).
 * A dedicated Cast receiver would need Google's paid developer registration, so it is not used.
 */

export type AmbientLayer = { url: string; volume: number };
export type DisplayTimer = {
  sessionType: SessionType;
  label: string;
  target: string;
  timeLeft: number;
  total: number;
  isActive: boolean;
  /** Epoch ms when the running session ends, on this device's clock; null while paused. */
  endsAt: number | null;
};
export type DisplayExtras = { theme: 'light' | 'dark'; palette: string };
export type DisplaySound = { audio: AudioSettings | null; ambient: AmbientLayer[] };
export type DisplayState = DisplayTimer & DisplayExtras & DisplaySound;

export const DISPLAY_PATH = '/tv';
const CHANNEL = 'kairo-display';
const DASHCAST_APP_ID = '84912283';
const DASHCAST_NAMESPACE = 'urn:x-cast:com.madmod.dashcast';
const CAST_SDK = 'https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1';

const SESSION_TYPES: SessionType[] = ['focus', 'shortBreak', 'longBreak'];
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const num = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');

const normalizeAudio = (value: unknown): AudioSettings | null => {
  if (!value || typeof value !== 'object') return null;
  const a = value as Record<string, unknown>;
  return {
    isPlaying: a.isPlaying === true,
    engineEnabled: a.engineEnabled !== false,
    mode: pick(a.mode, ['binaural', 'isochronic', 'noise'] as const, 'noise'),
    ambientPreset: pick(a.ambientPreset, ['none', 'rain', 'ocean', 'cafe', 'fireplace'] as const, 'none'),
    baseFrequency: num(a.baseFrequency, 40, 1000, 200),
    beatFrequency: num(a.beatFrequency, 0.5, 40, 10),
    waveType: pick(a.waveType, ['sine', 'triangle'] as const, 'sine'),
    noiseType: pick(a.noiseType, ['pink', 'brown', 'white'] as const, 'brown'),
    binauralVolume: num(a.binauralVolume, 0, 1, 0.25),
    noiseVolume: num(a.noiseVolume, 0, 1, 0.5),
    masterVolume: num(a.masterVolume, 0, 1, 0.7),
  };
};

const normalizeAmbient = (value: unknown): AmbientLayer[] =>
  (Array.isArray(value) ? value : [])
    .filter((l): l is { url: string; volume: unknown } => Boolean(l) && typeof (l as { url?: unknown }).url === 'string' && isTrustedAmbientUrl((l as { url: string }).url))
    .slice(0, 12)
    .map(l => ({ url: l.url, volume: num(l.volume, 0, 1, 0.5) }));

/**
 * Messages arrive from another tab or device, so every field is checked before use.
 * The end time is rebuilt on this device from `remainingMs`, so clocks never need to agree.
 */
export const normalizeDisplayState = (value: unknown, now = Date.now()): DisplayState | null => {
  if (!value || typeof value !== 'object') return null;
  const s = value as Record<string, unknown>;
  if (s.type !== 'state') return null;
  const total = num(s.total, 1, 24 * 3600, 25 * 60);
  const isActive = s.isActive === true;
  const remainingMs = typeof s.remainingMs === 'number' && Number.isFinite(s.remainingMs) ? num(s.remainingMs, 0, total * 1000, 0) : null;
  return {
    sessionType: pick(s.sessionType, SESSION_TYPES, 'focus'),
    label: text(s.label, 40),
    target: text(s.target, 160),
    timeLeft: Math.round(num(s.timeLeft, 0, total, total)),
    total,
    isActive,
    endsAt: isActive && remainingMs !== null ? now + remainingMs : null,
    theme: s.theme === 'light' ? 'light' : 'dark',
    palette: /^[a-z-]{1,24}$/.test(String(s.palette)) ? String(s.palette) : '',
    audio: normalizeAudio(s.audio),
    ambient: normalizeAmbient(s.ambient),
  };
};

/** Seconds left, counted from the end time so every screen shows the same number. */
export const secondsLeft = (state: DisplayTimer, now = Date.now()) =>
  state.isActive && state.endsAt ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : state.timeLeft;

export const isDisplayPage = () =>
  typeof window !== 'undefined'
  && (window.location.pathname === DISPLAY_PATH || new URLSearchParams(window.location.search).get('display') === 'tv');

export const displayRoom = () => {
  const room = new URLSearchParams(window.location.search).get('room') ?? '';
  return ROOM_PATTERN.test(room) ? room : null;
};

/* ---------- sender side (the main app) ---------- */

type Status = { secondTab: boolean; chromecast: 'off' | 'connecting' | 'on'; soundOnTv: boolean };

let timer: DisplayTimer | null = null;
let extras: DisplayExtras = { theme: 'dark', palette: '' };
let sound: DisplaySound = { audio: null, ambient: [] };
let wantSoundOnTv = (() => { try { return localStorage.getItem('kairo_sound_on_tv') !== '0'; } catch { return true; } })();
let latest: DisplayState | null = null;
let channel: BroadcastChannel | null = null;
let relay: Relay | null = null;
let relayKey = '';
let relaySentAt = 0;
const stateListeners = new Set<() => void>();
const statusListeners = new Set<() => void>();
let status: Status = { secondTab: false, chromecast: 'off', soundOnTv: false };

const setStatus = (patch: Partial<Omit<Status, 'soundOnTv'>>) => {
  const next = { ...status, ...patch };
  next.soundOnTv = next.chromecast === 'on' && wantSoundOnTv;
  if (next.secondTab === status.secondTab && next.chromecast === status.chromecast && next.soundOnTv === status.soundOnTv) return;
  status = next;
  statusListeners.forEach(fn => fn());
};

/** The message sent to other screens. Sound is included only when it should play on the TV. */
const wireMessage = (now = Date.now()) => {
  if (!latest) return null;
  const { endsAt, audio, ambient, ...rest } = latest;
  return {
    type: 'state',
    ...rest,
    remainingMs: latest.isActive && endsAt ? Math.max(0, endsAt - now) : null,
    audio: status.soundOnTv ? audio : null,
    ambient: status.soundOnTv ? ambient : [],
  };
};

/** Relay sends only on real changes plus a slow heartbeat; the TV counts down on its own. */
const sendRelay = (force = false) => {
  const message = wireMessage();
  if (!relay || !message) return;
  const key = JSON.stringify({ ...message, timeLeft: message.isActive ? 0 : message.timeLeft, remainingMs: undefined, end: latest?.endsAt ? Math.round(latest.endsAt / 1000) : 0 });
  const now = Date.now();
  if (!force && key === relayKey && now - relaySentAt < 10000) return;
  relayKey = key;
  relaySentAt = now;
  relay.send('state', message);
};

const broadcast = () => {
  latest = timer ? { ...timer, ...extras, ...sound } : null;
  stateListeners.forEach(fn => fn());
  const message = wireMessage();
  if (message) channel?.postMessage(JSON.stringify({ ...message, audio: null, ambient: [] }));
  sendRelay();
};

const ensureChannel = () => {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = event => {
    if (event.data === 'hello') { setStatus({ secondTab: true }); broadcast(); }
    if (event.data === 'bye') setStatus({ secondTab: false });
  };
};

if (typeof window !== 'undefined') window.setInterval(() => sendRelay(), 2000);

export const publishTimer = (next: DisplayTimer) => { timer = next; ensureChannel(); broadcast(); };
export const publishExtras = (next: DisplayExtras) => { extras = next; ensureChannel(); broadcast(); };
export const publishAudio = (audio: AudioSettings) => { sound = { ...sound, audio }; broadcast(); };
export const publishAmbient = (ambient: AmbientLayer[]) => { sound = { ...sound, ambient }; broadcast(); };

export const getSoundOnTvPreference = () => wantSoundOnTv;
export const setSoundOnTvPreference = (on: boolean) => {
  wantSoundOnTv = on;
  try { localStorage.setItem('kairo_sound_on_tv', on ? '1' : '0'); } catch { /* storage unavailable */ }
  setStatus({});
  sendRelay(true);
};

/** Rings the end-of-session alarm here, and on the Chromecast too when sound plays on the TV. */
export const ringAlert = (id: string, volume: number, repeats: number) => {
  if (!isAlertSoundId(id)) return;
  playAlertSound(id, { volume, repeats });
  if (status.soundOnTv) relay?.send('cue', { id, volume, repeats });
};

/** Live state for TV mode inside this tab. */
export const useDisplayState = () =>
  useSyncExternalStore(fn => { stateListeners.add(fn); return () => stateListeners.delete(fn); }, () => latest, () => latest);

export const useCastStatus = () =>
  useSyncExternalStore(fn => { statusListeners.add(fn); return () => statusListeners.delete(fn); }, () => status, () => status);

/** Opens the TV view in a new normal tab, for a second screen. */
export const openSecondScreen = () => {
  ensureChannel();
  window.open(`${window.location.origin}${DISPLAY_PATH}`, '_blank', 'noopener');
};

export const closeSecondScreen = () => {
  channel?.postMessage('close');
  setStatus({ secondTab: false });
};

/* ---------- Chromecast (DashCast) ---------- */

type CastContext = {
  setOptions: (options: object) => void;
  requestSession: () => Promise<unknown>;
  getCurrentSession: () => { sendMessage: (namespace: string, message: object) => Promise<unknown> } | null;
  endCurrentSession: (stopCasting: boolean) => void;
  addEventListener: (type: string, fn: (event: { sessionState: string }) => void) => void;
};
type CastGlobals = {
  cast?: { framework?: { CastContext: { getInstance: () => CastContext }; CastContextEventType: { SESSION_STATE_CHANGED: string }; SessionState: { SESSION_ENDED: string } } };
  chrome?: { cast?: { AutoJoinPolicy: { ORIGIN_SCOPED: string } } };
  __onGCastApiAvailable?: (available: boolean) => void;
};

let sdkPromise: Promise<CastContext> | null = null;
let room: string | null = null;
let fullPage = false;

const loadCastSdk = (): Promise<CastContext> => {
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<CastContext>((resolve, reject) => {
    const w = window as unknown as CastGlobals;
    const fail = (message: string) => { sdkPromise = null; reject(new Error(message)); };
    const timeout = window.setTimeout(() => fail('Casting is not available in this browser. Use Chrome or Edge (in Brave, turn on Media Router first).'), 10000);
    w.__onGCastApiAvailable = available => {
      window.clearTimeout(timeout);
      const framework = w.cast?.framework;
      if (!available || !framework || !w.chrome?.cast) { fail('Casting is not available in this browser. Use Chrome or Edge (in Brave, turn on Media Router first).'); return; }
      const context = framework.CastContext.getInstance();
      context.setOptions({ receiverApplicationId: DASHCAST_APP_ID, autoJoinPolicy: w.chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED });
      context.addEventListener(framework.CastContextEventType.SESSION_STATE_CHANGED, event => {
        // In full-page mode the receiver navigates away, which can end the Cast session while the
        // TV keeps showing Kairo, so the relay stays up until the user presses Stop.
        if (event.sessionState === framework.SessionState.SESSION_ENDED && !fullPage) stopChromecast();
      });
      resolve(context);
    };
    const script = document.createElement('script');
    script.src = CAST_SDK;
    script.async = true;
    script.onerror = () => { window.clearTimeout(timeout); fail('Could not load Google Cast. Check your connection.'); };
    document.head.appendChild(script);
  });
  return sdkPromise;
};

/** Opens the Cast picker and shows the TV page on the chosen Chromecast. Returns false if cancelled. */
export const castToChromecast = async (asFullPage = false): Promise<boolean> => {
  const context = await loadCastSdk();
  setStatus({ chromecast: 'connecting' });
  try {
    if (!context.getCurrentSession()) await context.requestSession();
  } catch (error) {
    setStatus({ chromecast: room ? 'on' : 'off' });
    if (error === 'cancel') return false;
    throw new Error('Could not connect to the TV. Make sure it is on the same Wi-Fi.');
  }
  const session = context.getCurrentSession();
  if (!session) { setStatus({ chromecast: 'off' }); return false; }
  if (!room) {
    room = randomRoom();
    relay = openRelay(room, event => { if (event === 'hello') sendRelay(true); }, () => sendRelay(true));
  }
  fullPage = asFullPage;
  await session.sendMessage(DASHCAST_NAMESPACE, { url: `${window.location.origin}${DISPLAY_PATH}?room=${room}`, force: asFullPage, reload: false, reload_time: 0 });
  setStatus({ chromecast: 'on' });
  return true;
};

export const stopChromecast = () => {
  try { (window as unknown as CastGlobals).cast?.framework?.CastContext.getInstance().endCurrentSession(true); } catch { /* not connected */ }
  relay?.close();
  relay = null;
  room = null;
  relayKey = '';
  setStatus({ chromecast: 'off' });
};

/* ---------- receiver side (TV page) ---------- */

/** Listens for timer updates: from the Chromecast room if there is one, else from another tab. */
export const listenForDisplay = (onState: (state: DisplayState) => void, onClose: () => void, onCue?: (id: string, volume: number, repeats: number) => void): (() => void) => {
  const handle = (data: unknown) => {
    try {
      const state = normalizeDisplayState(typeof data === 'string' ? JSON.parse(data) : data);
      if (state) onState(state);
    } catch { /* ignore malformed messages */ }
  };

  const tvRoom = displayRoom();
  if (tvRoom) {
    const tvRelay = openRelay(tvRoom, (event, payload) => {
      if (event === 'state') handle(payload);
      if (event === 'cue' && payload && typeof payload === 'object') {
        const cue = payload as { id?: unknown; volume?: unknown; repeats?: unknown };
        if (isAlertSoundId(cue.id)) onCue?.(cue.id, num(cue.volume, 0, 1, 0.8), num(cue.repeats, 1, 3, 1));
      }
    }, () => tvRelay.send('hello', {}));
    return () => tvRelay.close();
  }

  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const bc = new BroadcastChannel(CHANNEL);
  bc.onmessage = event => { if (event.data === 'close') onClose(); else handle(event.data); };
  bc.postMessage('hello');
  const bye = () => bc.postMessage('bye');
  window.addEventListener('pagehide', bye);
  return () => { window.removeEventListener('pagehide', bye); bye(); bc.close(); };
};
