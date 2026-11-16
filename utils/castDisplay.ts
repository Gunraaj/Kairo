import { useSyncExternalStore } from 'react';
import type { AudioSettings, SessionType } from '../types';

/**
 * The TV view: a second screen that mirrors the timer (and optionally plays the sound).
 * Reaches it two ways: the Presentation API (Chrome casts the page to a Chromecast or
 * smart TV), or a plain window on another screen, linked with a BroadcastChannel.
 */

export type DisplayTimer = { sessionType: SessionType; label: string; target: string; timeLeft: number; total: number; isActive: boolean };
export type DisplayExtras = { theme: 'light' | 'dark'; palette: string; audio: AudioSettings | null };
export type DisplayState = DisplayTimer & DisplayExtras;

export const DISPLAY_PARAM = 'display';
export const DISPLAY_VALUE = 'tv';
const CHANNEL = 'kairo-display';

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

/** Messages arrive from another device or window, so every field is checked before use. */
export const normalizeDisplayState = (value: unknown): DisplayState | null => {
  if (!value || typeof value !== 'object') return null;
  const s = value as Record<string, unknown>;
  if (s.type !== 'state') return null;
  const total = num(s.total, 1, 24 * 3600, 25 * 60);
  return {
    sessionType: pick(s.sessionType, SESSION_TYPES, 'focus'),
    label: text(s.label, 40),
    target: text(s.target, 160),
    timeLeft: Math.round(num(s.timeLeft, 0, total, total)),
    total,
    isActive: s.isActive === true,
    theme: s.theme === 'light' ? 'light' : 'dark',
    palette: /^[a-z-]{1,24}$/.test(String(s.palette)) ? String(s.palette) : '',
    audio: normalizeAudio(s.audio),
  };
};

export const displayUrl = () => `${window.location.origin}/?${DISPLAY_PARAM}=${DISPLAY_VALUE}`;
export const isDisplayPage = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(DISPLAY_PARAM) === DISPLAY_VALUE;

/* ---------- sender side (the main app) ---------- */

type Presentation = { send: (data: string) => void; terminate: () => void; state: string; addEventListener: (type: string, fn: () => void) => void };
type PresentationRequestCtor = new (urls: string[]) => { start: () => Promise<Presentation> };
const PresentationRequestApi = (): PresentationRequestCtor | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { PresentationRequest?: PresentationRequestCtor }).PresentationRequest;

export const canCast = () => Boolean(PresentationRequestApi());

let timer: DisplayTimer | null = null;
let extras: DisplayExtras = { theme: 'dark', palette: '', audio: null };
let channel: BroadcastChannel | null = null;
const connections = new Set<Presentation>();
let windowOpen = false;
const listeners = new Set<() => void>();
let status = { casting: false };

const setStatus = () => {
  const casting = connections.size > 0 || windowOpen;
  if (casting === status.casting) return;
  status = { casting };
  listeners.forEach(fn => fn());
};

const message = () => (timer ? JSON.stringify({ type: 'state', ...timer, ...extras }) : null);

const broadcast = () => {
  const data = message();
  if (!data) return;
  channel?.postMessage(data);
  connections.forEach(c => { if (c.state === 'connected') { try { c.send(data); } catch { /* closed */ } } });
};

const ensureChannel = () => {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = event => {
    if (event.data === 'hello') { windowOpen = true; setStatus(); broadcast(); }
    if (event.data === 'bye') { windowOpen = false; setStatus(); }
  };
};

export const publishTimer = (next: DisplayTimer) => { timer = next; ensureChannel(); broadcast(); };
export const publishExtras = (next: DisplayExtras) => { extras = next; ensureChannel(); broadcast(); };

/** Opens Chrome's cast picker and shows the TV view on the chosen screen. */
export const startCast = async (): Promise<void> => {
  const Request = PresentationRequestApi();
  if (!Request) throw new Error('Casting is not supported in this browser. Use "Open TV window" instead.');
  const connection = await new Request([displayUrl()]).start();
  connections.add(connection);
  connection.addEventListener('connect', () => { setStatus(); broadcast(); });
  const drop = () => { connections.delete(connection); setStatus(); };
  connection.addEventListener('close', drop);
  connection.addEventListener('terminate', drop);
  setStatus();
  broadcast();
};

/** A plain window: drag it to a TV, projector or second monitor, or cast that tab. */
export const openTvWindow = () => {
  ensureChannel();
  window.open(displayUrl(), 'kairo-tv', 'popup,width=1280,height=720');
};

export const stopCast = () => {
  connections.forEach(c => { try { c.terminate(); } catch { /* already gone */ } });
  connections.clear();
  channel?.postMessage('close');
  windowOpen = false;
  setStatus();
};

const subscribe = (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn); };
export const useCastStatus = () => useSyncExternalStore(subscribe, () => status, () => status);

/* ---------- receiver side (the TV view) ---------- */

type ReceiverConnection = { addEventListener: (type: 'message', fn: (event: MessageEvent) => void) => void };
type Receiver = { connectionList: Promise<{ connections: ReceiverConnection[]; addEventListener: (type: 'connectionavailable', fn: (event: { connection: ReceiverConnection }) => void) => void }> };

export const isCastReceiver = () =>
  typeof navigator !== 'undefined' && Boolean((navigator as unknown as { presentation?: { receiver?: Receiver } }).presentation?.receiver);

/** Listens for timer updates from the main app. Returns a cleanup function. */
export const listenForDisplay = (onState: (state: DisplayState) => void, onClose: () => void): (() => void) => {
  const handle = (data: unknown) => {
    if (data === 'close') { onClose(); return; }
    try {
      const state = normalizeDisplayState(typeof data === 'string' ? JSON.parse(data) : data);
      if (state) onState(state);
    } catch { /* ignore malformed messages */ }
  };

  const receiver = (navigator as unknown as { presentation?: { receiver?: Receiver } }).presentation?.receiver;
  if (receiver) {
    const attach = (c: ReceiverConnection) => c.addEventListener('message', event => handle(event.data));
    void receiver.connectionList.then(list => {
      list.connections.forEach(attach);
      list.addEventListener('connectionavailable', event => attach(event.connection));
    });
  }

  let bc: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = event => handle(event.data);
    bc.postMessage('hello');
  }
  const bye = () => bc?.postMessage('bye');
  window.addEventListener('pagehide', bye);
  return () => { window.removeEventListener('pagehide', bye); bye(); bc?.close(); };
};
