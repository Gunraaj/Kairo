import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDisplayState, secondsLeft } from '../utils/castDisplay';
import { randomRoom, ROOM_PATTERN } from '../utils/tvRelay';

const SOUND = 'https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/nature/rain.mp3';

test('display messages are validated before the TV view uses them', () => {
  assert.equal(normalizeDisplayState(null), null);
  assert.equal(normalizeDisplayState({ type: 'other' }), null);
  const now = 1_000_000_000;
  const state = normalizeDisplayState({
    type: 'state', sessionType: 'evil', label: 'x'.repeat(99), target: '<img src=x>', timeLeft: 99999, total: 1500,
    isActive: 'yes', remainingMs: 5000, theme: 'blue', palette: 'a;b',
    audio: { mode: 'hack', masterVolume: 5, isPlaying: true },
    ambient: [{ url: SOUND, volume: 9 }, { url: 'https://evil.example/x.mp3', volume: 1 }, { url: 'javascript:alert(1)' }],
  }, now);
  assert.ok(state);
  assert.equal(state.sessionType, 'focus');
  assert.equal(state.label.length, 40);
  assert.equal(state.timeLeft, 1500);
  assert.equal(state.isActive, false);
  assert.equal(state.endsAt, null);
  assert.equal(state.theme, 'dark');
  assert.equal(state.palette, '');
  assert.equal(state.audio?.mode, 'noise');
  assert.equal(state.audio?.masterVolume, 1);
  assert.deepEqual(state.ambient, [{ url: SOUND, volume: 1 }]);
});

test('the TV rebuilds the end time on its own clock, so devices never drift apart', () => {
  const tvNow = 5_000_000;
  const running = normalizeDisplayState({ type: 'state', timeLeft: 600, total: 1500, isActive: true, remainingMs: 90_500 }, tvNow);
  assert.ok(running);
  assert.equal(running.endsAt, tvNow + 90_500);
  assert.equal(secondsLeft(running, tvNow), 91);
  assert.equal(secondsLeft(running, tvNow + 90_600), 0);
  const paused = normalizeDisplayState({ type: 'state', timeLeft: 600, total: 1500, isActive: false, remainingMs: 90_500 }, tvNow);
  assert.ok(paused);
  assert.equal(secondsLeft(paused, tvNow + 5000), 600);
});

test('rooms are random and unguessable', () => {
  const a = randomRoom();
  assert.match(a, ROOM_PATTERN);
  assert.notEqual(a, randomRoom());
  assert.ok(a.length >= 24);
});

test('volume slider maps perceived loudness to gain and back', async () => {
  const { toGain, toPosition } = await import('../components/soundStudio/VolumeSlider');
  assert.equal(toGain(0), 0);
  assert.equal(toGain(1), 1);
  assert.equal(toGain(0.5), 0.25);
  assert.equal(Math.round(toPosition(0.25) * 100), 50);
  assert.equal(toGain(2), 1);
  assert.equal(toPosition(-1), 0);
});
