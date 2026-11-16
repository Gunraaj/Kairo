import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDisplayState } from '../utils/castDisplay';

test('display messages are validated before the TV view uses them', () => {
  assert.equal(normalizeDisplayState(null), null);
  assert.equal(normalizeDisplayState({ type: 'other' }), null);
  const state = normalizeDisplayState({
    type: 'state', sessionType: 'evil', label: 'x'.repeat(99), target: '<img src=x>', timeLeft: 99999, total: 1500,
    isActive: 'yes', theme: 'blue', palette: 'a;b', audio: { mode: 'hack', masterVolume: 5, isPlaying: true },
  });
  assert.ok(state);
  assert.equal(state.sessionType, 'focus');
  assert.equal(state.label.length, 40);
  assert.equal(state.timeLeft, 1500);
  assert.equal(state.isActive, false);
  assert.equal(state.theme, 'dark');
  assert.equal(state.palette, '');
  assert.equal(state.audio?.mode, 'noise');
  assert.equal(state.audio?.masterVolume, 1);
  assert.equal(state.audio?.isPlaying, true);
});
