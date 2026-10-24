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
