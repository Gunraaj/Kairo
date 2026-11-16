import { useSyncExternalStore } from 'react';
import type { SessionType } from '../types';

/**
 * The TV view. Two ways to reach a TV, both free:
 *  1. TV mode in this tab, then the browser's own "Cast tab" (Chromecast / Google TV).
 *     The TV shows exactly this tab, so the timer and every sound are the real ones.
 *  2. A second tab for a screen plugged in by HDMI / Miracast / AirPlay, kept in sync over a
 *     BroadcastChannel. It counts down to the same end time, so it never drifts.
 * Chrome cannot render a normal web page on a Chromecast through the Presentation API, and a
 * real Cast button needs a paid Google Cast developer registration, so neither is used.
 */

export type DisplayTimer = {
  sessionType: SessionType;
  label: string;
  target: string;
  timeLeft: number;
  total: number;
  isActive: boolean;
  /** Epoch ms when the running session ends; null while paused. */
  endsAt: number | null;
};
export type DisplayExtras = { theme: 'light' | 'dark'; palette: string };
export type DisplayState = DisplayTimer & DisplayExtras;

export const DISPLAY_PARAM = 'display';
export const DISPLAY_VALUE = 'tv';
const CHANNEL = 'kairo-display';

const SESSION_TYPES: SessionType[] = ['focus', 'shortBreak', 'longBreak'];
const num = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
const text = (value: unknown, max: number) => (typeof value === 'string' ? value.slice(0, max) : '');

/** Messages arrive from another tab, so every field is checked before use. */
export const normalizeDisplayState = (value: unknown, now = Date.now()): DisplayState | null => {
  if (!value || typeof value !== 'object') return null;
  const s = value as Record<string, unknown>;
  if (s.type !== 'state') return null;
  const total = num(s.total, 1, 24 * 3600, 25 * 60);
  const isActive = s.isActive === true;
  const endsAt = isActive && typeof s.endsAt === 'number' && Math.abs(s.endsAt - now) < 24 * 3600 * 1000 ? s.endsAt : null;
  return {
    sessionType: SESSION_TYPES.includes(s.sessionType as SessionType) ? (s.sessionType as SessionType) : 'focus',
    label: text(s.label, 40),
    target: text(s.target, 160),
    timeLeft: Math.round(num(s.timeLeft, 0, total, total)),
    total,
    isActive,
    endsAt,
    theme: s.theme === 'light' ? 'light' : 'dark',
    palette: /^[a-z-]{1,24}$/.test(String(s.palette)) ? String(s.palette) : '',
  };
};

/** Seconds left, counted from the shared end time so every screen shows the same number. */
export const secondsLeft = (state: DisplayTimer, now = Date.now()) =>
  state.isActive && state.endsAt ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : state.timeLeft;

export const displayUrl = () => `${window.location.origin}/?${DISPLAY_PARAM}=${DISPLAY_VALUE}`;
export const isDisplayPage = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get(DISPLAY_PARAM) === DISPLAY_VALUE;

/* ---------- sender side (the main app) ---------- */

let timer: DisplayTimer | null = null;
let extras: DisplayExtras = { theme: 'dark', palette: '' };
let latest: DisplayState | null = null;
let channel: BroadcastChannel | null = null;
let secondTabOpen = false;
const stateListeners = new Set<() => void>();
const statusListeners = new Set<() => void>();
let status = { secondTab: false };

const setSecondTab = (open: boolean) => {
  if (open === secondTabOpen) return;
  secondTabOpen = open;
  status = { secondTab: open };
  statusListeners.forEach(fn => fn());
};

const broadcast = () => {
  latest = timer ? { ...timer, ...extras } : null;
  stateListeners.forEach(fn => fn());
  if (latest) channel?.postMessage(JSON.stringify({ type: 'state', ...latest }));
};

const ensureChannel = () => {
  if (channel || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = event => {
    if (event.data === 'hello') { setSecondTab(true); broadcast(); }
    if (event.data === 'bye') setSecondTab(false);
  };
};

export const publishTimer = (next: DisplayTimer) => { timer = next; ensureChannel(); broadcast(); };
export const publishExtras = (next: DisplayExtras) => { extras = next; ensureChannel(); broadcast(); };

/** Live state for TV mode inside this tab. */
export const useDisplayState = () =>
  useSyncExternalStore(fn => { stateListeners.add(fn); return () => stateListeners.delete(fn); }, () => latest, () => latest);

/** Opens the TV view in a new normal tab, for a second screen. */
export const openSecondScreen = () => {
  ensureChannel();
  window.open(displayUrl(), '_blank', 'noopener');
};

export const closeSecondScreen = () => {
  channel?.postMessage('close');
  setSecondTab(false);
};

export const useSecondScreenStatus = () =>
  useSyncExternalStore(fn => { statusListeners.add(fn); return () => statusListeners.delete(fn); }, () => status, () => status);

/* ---------- receiver side (the second-screen tab) ---------- */

/** Listens for timer updates from the main app. Returns a cleanup function. */
export const listenForDisplay = (onState: (state: DisplayState) => void, onClose: () => void): (() => void) => {
  if (typeof BroadcastChannel === 'undefined') return () => undefined;
  const bc = new BroadcastChannel(CHANNEL);
  bc.onmessage = event => {
    if (event.data === 'close') { onClose(); return; }
    try {
      const state = normalizeDisplayState(typeof event.data === 'string' ? JSON.parse(event.data) : event.data);
      if (state) onState(state);
    } catch { /* ignore malformed messages */ }
  };
  bc.postMessage('hello');
  const bye = () => bc.postMessage('bye');
  window.addEventListener('pagehide', bye);
  return () => { window.removeEventListener('pagehide', bye); bye(); bc.close(); };
};
