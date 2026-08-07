import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseTimerSnapshot,
  remainingSeconds,
  TIMER_STORAGE_KEY,
  writeTimerSnapshot,
  type TimerSnapshot,
} from '../utils/timerState.ts';

const snapshot: TimerSnapshot = {
  version: 1,
  id: 'timer_123',
  sessionType: 'focus',
  timeLeft: 1_500,
  isActive: true,
  deadline: 101_000,
  startedAt: 1_000,
  sessionDuration: 1_500,
  target: { id: 'task_123', name: 'Ship the hardening pass', kind: 'task' },
};

test('restores active timer time from its deadline', () => {
  assert.equal(remainingSeconds(snapshot, 99_250), 2);
  assert.equal(remainingSeconds({ ...snapshot, deadline: 98_000 }, 99_250), 0);
});

test('preserves paused timer time exactly', () => {
  assert.equal(remainingSeconds({ ...snapshot, isActive: false, timeLeft: 1_427 }, 999_999), 1_427);
});

test('rejects malformed or oversized timer snapshots', () => {
  assert.equal(parseTimerSnapshot('{"version":1,"id":"x"}'), null);
  assert.equal(parseTimerSnapshot(JSON.stringify({ ...snapshot, timeLeft: 99_999 })), null);
  assert.equal(parseTimerSnapshot(JSON.stringify({ ...snapshot, target: { kind: 'task' } })), null);
});

test('writes a versioned timer snapshot without throwing', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  assert.equal(writeTimerSnapshot(snapshot, storage), true);
  assert.deepEqual(parseTimerSnapshot(values.get(TIMER_STORAGE_KEY) ?? null), snapshot);
});
