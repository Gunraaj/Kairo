import type { FocusTarget, SessionType } from '../types';

export const TIMER_STORAGE_KEY = 'kairo_active_timer';

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
};

type StorageReader = Pick<Storage, 'getItem' | 'setItem'>;

const optionalFiniteNumber = (value: unknown): value is number | null =>
  value === null || (typeof value === 'number' && Number.isFinite(value));

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
      || snapshot.timeLeft > 10_800
      || typeof snapshot.isActive !== 'boolean'
      || !optionalFiniteNumber(snapshot.deadline)
      || !optionalFiniteNumber(snapshot.startedAt)
      || !optionalFiniteNumber(snapshot.sessionDuration)
      || !isTarget(snapshot.target)
    ) return null;
    return snapshot as TimerSnapshot;
  } catch {
    return null;
  }
};

export const remainingSeconds = (snapshot: TimerSnapshot, now = Date.now()) =>
  snapshot.isActive && snapshot.deadline
    ? Math.max(0, Math.ceil((snapshot.deadline - now) / 1000))
    : snapshot.timeLeft;

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
