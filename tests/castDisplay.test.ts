import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDisplayState, secondsLeft } from '../utils/castDisplay';

test('display messages are validated before the TV view uses them', () => {
  assert.equal(normalizeDisplayState(null), null);
  assert.equal(normalizeDisplayState({ type: 'other' }), null);
  const now = 1_000_000_000;
  const state = normalizeDisplayState({
    type: 'state', sessionType: 'evil', label: 'x'.repeat(99), target: '<img src=x>', timeLeft: 99999, total: 1500,
    isActive: 'yes', endsAt: now + 5000, theme: 'blue', palette: 'a;b',
  }, now);
  assert.ok(state);
  assert.equal(state.sessionType, 'focus');
  assert.equal(state.label.length, 40);
  assert.equal(state.timeLeft, 1500);
  assert.equal(state.isActive, false);
  assert.equal(state.endsAt, null);
  assert.equal(state.theme, 'dark');
  assert.equal(state.palette, '');
});

test('every screen counts down to the same end time', () => {
  const now = 1_000_000_000;
  const running = normalizeDisplayState({ type: 'state', sessionType: 'focus', timeLeft: 600, total: 1500, isActive: true, endsAt: now + 90_500 }, now);
  assert.ok(running);
  assert.equal(secondsLeft(running, now), 91);
  assert.equal(secondsLeft(running, now + 90_600), 0);
  const paused = normalizeDisplayState({ type: 'state', timeLeft: 600, total: 1500, isActive: false, endsAt: now + 90_500 }, now);
  assert.ok(paused);
  assert.equal(secondsLeft(paused, now + 5000), 600);
});
