import type { FocusTarget, SessionType } from '../types';

export const TIMER_STORAGE_KEY = 'kairo_active_timer';
const MAX_TIMER_SECONDS = 10_800;

export type TimerSnapshot = {
  version: 1;
  id: string;
  sessionType: SessionType;
  timeLeft: number;
  isActive: boolean;
  deadline: number | null;
  startedAt: number | null;
  sessionDuration: number | null;
  target: FocusTarget | null;
  intention?: string;
  lastSavedAt?: number;
};

type StorageReader = Pick<Storage, 'getItem' | 'setItem'> & Partial<Pick<Storage, 'removeItem'>>;

const optionalFiniteNumber = (value: unknown): value is number | null | undefined =>
  value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value));

const optionalString = (value: unknown, maxLength = 250): value is string | undefined =>
  value === undefined || (typeof value === 'string' && value.length <= maxLength);

const isTarget = (value: unknown): value is FocusTarget | null => {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const target = value as Partial<FocusTarget>;
  return typeof target.id === 'string'
    && target.id.length <= 128
    && typeof target.name === 'string'
    && target.name.length <= 160
    && (target.kind === 'task' || target.kind === 'project');
};

export const parseTimerSnapshot = (raw: string | null): TimerSnapshot | null => {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const snapshot = value as Partial<TimerSnapshot>;
    if (
      snapshot.version !== 1
      || typeof snapshot.id !== 'string'
      || snapshot.id.length > 128
      || !['focus', 'shortBreak', 'longBreak'].includes(snapshot.sessionType ?? '')
      || typeof snapshot.timeLeft !== 'number'
      || !Number.isFinite(snapshot.timeLeft)
      || snapshot.timeLeft < 0
      || snapshot.timeLeft > MAX_TIMER_SECONDS
      || typeof snapshot.isActive !== 'boolean'
      || !optionalFiniteNumber(snapshot.deadline)
      || !optionalFiniteNumber(snapshot.startedAt)
      || !optionalFiniteNumber(snapshot.sessionDuration)
      || (typeof snapshot.sessionDuration === 'number' && (snapshot.sessionDuration < 0 || snapshot.sessionDuration > MAX_TIMER_SECONDS))
      || (typeof snapshot.deadline === 'number' && typeof snapshot.startedAt === 'number' && snapshot.deadline < snapshot.startedAt)
      || !optionalFiniteNumber(snapshot.lastSavedAt)
      || !optionalString(snapshot.intention)
      || !isTarget(snapshot.target)
    ) return null;
    return snapshot as TimerSnapshot;
  } catch {
    return null;
  }
};

export const remainingSeconds = (snapshot: TimerSnapshot, now = Date.now()) =>
  snapshot.isActive && snapshot.deadline
    ? Math.min(MAX_TIMER_SECONDS, Math.max(0, Math.ceil((snapshot.deadline - now) / 1000)))
    : snapshot.timeLeft;

export const calculateElapsedSeconds = (snapshot: TimerSnapshot, now = Date.now()): number => {
  const total = snapshot.sessionDuration ?? snapshot.timeLeft;
  if (snapshot.isActive && snapshot.deadline && snapshot.startedAt) {
    const effectiveEnd = Math.min(now, snapshot.deadline);
    const elapsed = Math.floor((effectiveEnd - snapshot.startedAt) / 1000);
    return Math.max(0, Math.min(total, elapsed));
  }
  const elapsed = total - snapshot.timeLeft;
  return Math.max(0, Math.min(total, elapsed));
};

export const isInterruptedSnapshot = (snapshot: TimerSnapshot, now = Date.now()): boolean => {
  if (snapshot.sessionType !== 'focus') return false;
  if (!snapshot.startedAt) return false;
  const elapsed = calculateElapsedSeconds(snapshot, now);
  return elapsed >= 60;
};

export const readTimerSnapshot = (storage: StorageReader = window.localStorage) =>
  parseTimerSnapshot(storage.getItem(TIMER_STORAGE_KEY));

export const writeTimerSnapshot = (
  snapshot: TimerSnapshot,
  storage: StorageReader = window.localStorage,
) => {
  try {
    storage.setItem(TIMER_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
};

export const clearTimerSnapshot = (storage: StorageReader = window.localStorage) => {
  try {
    if (typeof storage.removeItem === 'function') {
      storage.removeItem(TIMER_STORAGE_KEY);
    } else {
      storage.setItem(TIMER_STORAGE_KEY, '');
    }
  } catch {
    // Ignore storage issues
  }
};
