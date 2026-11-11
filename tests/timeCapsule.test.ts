import assert from 'node:assert/strict';
import test from 'node:test';
import { checkUnlockableCapsules } from '../utils/timeCapsule.ts';
import type { TimeCapsule } from '../types.ts';

test('checkUnlockableCapsules unlocks rounds-based capsule when target met', () => {
  const capsule: TimeCapsule = {
    id: 'c1',
    createdAt: new Date().toISOString(),
    message: 'Great focus today',
    treat: 'Hot matcha',
    triggerType: 'rounds',
    targetRounds: 4,
    completedRoundsAtCreation: 2,
    isUnlocked: false,
  };

  // Only 3 completed -> not unlocked yet
  const res1 = checkUnlockableCapsules([capsule], 5);
  assert.equal(res1.unlockable.length, 0);

  // 6 completed -> 4 rounds gained -> unlocked!
  const res2 = checkUnlockableCapsules([capsule], 6);
  assert.equal(res2.unlockable.length, 1);
  assert.equal(res2.unlockable[0].id, 'c1');
  assert.equal(res2.unlockable[0].isUnlocked, true);
});

test('checkUnlockableCapsules unlocks tomorrow-based capsule on a new date', () => {
  const yesterday = new Date(Date.now() - 25 * 3600 * 1000).toISOString();
  const capsule: TimeCapsule = {
    id: 'c2',
    createdAt: yesterday,
    message: 'Morning reflection',
    treat: 'Pour-over coffee',
    triggerType: 'tomorrow',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  const res = checkUnlockableCapsules([capsule], 0);
  assert.equal(res.unlockable.length, 1);
  assert.equal(res.unlockable[0].id, 'c2');
});

test('checkUnlockableCapsules: time trigger rolls over to tomorrow when targetTime <= creation time', () => {
  // Capsule created at 16:30 today with targetTime 10:00 (10:00 AM)
  const created = new Date('2026-11-11T16:30:00');
  const capsule: TimeCapsule = {
    id: 'c-rollover',
    createdAt: created.toISOString(),
    message: 'Tomorrow study treat',
    treat: 'Matcha latte',
    triggerType: 'time',
    targetTime: '10:00',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  // 1. Immediately at 16:31 today: should NOT unlock
  const checkToday = checkUnlockableCapsules([capsule], 0, new Date('2026-11-11T16:31:00'));
  assert.equal(checkToday.unlockable.length, 0);
  assert.equal(checkToday.remaining.length, 1);

  // 2. Late night at 23:59 today: should NOT unlock
  const checkLate = checkUnlockableCapsules([capsule], 0, new Date('2026-11-11T23:59:00'));
  assert.equal(checkLate.unlockable.length, 0);

  // 3. Tomorrow morning at 09:59: should NOT unlock
  const checkEarlyMorning = checkUnlockableCapsules([capsule], 0, new Date('2026-11-12T09:59:00'));
  assert.equal(checkEarlyMorning.unlockable.length, 0);

  // 4. Tomorrow morning at 10:01: UNLOCKS!
  const checkUnlock = checkUnlockableCapsules([capsule], 0, new Date('2026-11-12T10:01:00'));
  assert.equal(checkUnlock.unlockable.length, 1);
  assert.equal(checkUnlock.unlockable[0].id, 'c-rollover');
  assert.equal(checkUnlock.unlockable[0].isUnlocked, true);
});

test('checkUnlockableCapsules: time trigger unlocks on same day when targetTime > creation time', () => {
  // Capsule created at 09:00 today with targetTime 17:00 (5:00 PM today)
  const created = new Date('2026-11-11T09:00:00');
  const capsule: TimeCapsule = {
    id: 'c-sameday',
    createdAt: created.toISOString(),
    message: 'Evening reward',
    treat: 'Walk in park',
    triggerType: 'time',
    targetTime: '17:00',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  // 1. At 12:00 today: locked
  const midDay = checkUnlockableCapsules([capsule], 0, new Date('2026-11-11T12:00:00'));
  assert.equal(midDay.unlockable.length, 0);

  // 2. At 17:01 today: unlocked
  const evening = checkUnlockableCapsules([capsule], 0, new Date('2026-11-11T17:01:00'));
  assert.equal(evening.unlockable.length, 1);
  assert.equal(evening.unlockable[0].id, 'c-sameday');
});

test('checkUnlockableCapsules: rejects malformed targetTime gracefully without crashing', () => {
  const capsule: TimeCapsule = {
    id: 'c-invalid',
    createdAt: new Date().toISOString(),
    message: 'Test',
    treat: 'Tea',
    triggerType: 'time',
    targetTime: 'invalid-time',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };
  const res = checkUnlockableCapsules([capsule], 0);
  assert.equal(res.unlockable.length, 0);
  assert.equal(res.remaining.length, 1);
});
