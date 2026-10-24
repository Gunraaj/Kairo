import assert from 'node:assert/strict';
import test from 'node:test';
import { workerTimer } from '../utils/workerTimer.ts';

test('workerTimer registers and cancels intervals cleanly', async () => {
  let count = 0;
  const id = workerTimer.setInterval(() => {
    count++;
  }, 20);

  assert.ok(typeof id === 'number');

  await new Promise(resolve => setTimeout(resolve, 60));
  workerTimer.clearInterval(id);

  const finalCount = count;
  assert.ok(finalCount >= 1, `Expected count >= 1, got ${finalCount}`);

  await new Promise(resolve => setTimeout(resolve, 50));
  assert.equal(count, finalCount, 'Interval should stop executing after clearInterval');
});
