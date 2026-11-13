import assert from 'node:assert/strict';
import test from 'node:test';
import { applyMultiplier, daysBetween, estimateMultiplier, paceStatus, spreadRounds, toDayKey } from '../utils/planMath.ts';

test('day helpers', () => {
  assert.equal(toDayKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(daysBetween('2026-02-27', '2026-03-02'), 3);
  assert.equal(daysBetween('2026-03-02', '2026-03-02'), 0);
});

test('estimateMultiplier is robust, shrunk toward 1 and clamped', () => {
  assert.equal(estimateMultiplier([]), 1);
  assert.equal(estimateMultiplier([{ estimatedRounds: 0, actualRounds: 3 }]), 1);
  // one sample of 2x only moves a little: (3 + 1*2) / 4
  assert.equal(estimateMultiplier([{ estimatedRounds: 2, actualRounds: 4 }]), 1.25);
  // median ignores the runaway task: ratios 1.5, 1.5, 10 -> median 1.5 -> (3 + 4.5) / 6
  const samples = [{ estimatedRounds: 2, actualRounds: 3 }, { estimatedRounds: 4, actualRounds: 6 }, { estimatedRounds: 1, actualRounds: 10 }];
  assert.equal(estimateMultiplier(samples), 1.25);
  const slow = Array.from({ length: 50 }, () => ({ estimatedRounds: 1, actualRounds: 9 }));
  assert.equal(estimateMultiplier(slow), 2.5);
  assert.equal(applyMultiplier(3, 1.25), 4);
  assert.equal(applyMultiplier(1, 0.5), 1);
});

test('paceStatus classifies pace against the deadline', () => {
  const base = { today: '2026-03-01', deadline: '2026-03-11' };
  const onTrack = paceStatus({ ...base, remainingRounds: 20, recentDailyRounds: [2, 2, 2, 2] });
  assert.equal(onTrack.daysLeft, 10);
  assert.equal(onTrack.requiredPerDay, 2);
  assert.equal(onTrack.status, 'on-track');
  assert.equal(onTrack.slackDays, 0);

  assert.equal(paceStatus({ ...base, remainingRounds: 20, recentDailyRounds: [1.5, 1.5, 1.5] }).status, 'behind');
  const atRisk = paceStatus({ ...base, remainingRounds: 20, recentDailyRounds: [1, 0, 1, 0] });
  assert.equal(atRisk.status, 'at-risk');
  assert.ok(atRisk.slackDays! < 0);
  assert.equal(paceStatus({ ...base, remainingRounds: 200, recentDailyRounds: [5] }).status, 'infeasible');
  assert.equal(paceStatus({ ...base, remainingRounds: 0, recentDailyRounds: [] }).status, 'done');

  const fresh = paceStatus({ ...base, remainingRounds: 20, recentDailyRounds: [] });
  assert.equal(fresh.status, 'on-track');
  assert.equal(fresh.projectedDays, null);
  // recent days count more: a strong finish beats a strong start
  const rising = paceStatus({ ...base, remainingRounds: 20, recentDailyRounds: [0, 0, 3, 3] });
  const falling = paceStatus({ ...base, remainingRounds: 20, recentDailyRounds: [3, 3, 0, 0] });
  assert.ok(rising.actualPerDay > falling.actualPerDay);
  // past deadline never divides by zero
  assert.equal(paceStatus({ today: '2026-03-12', deadline: '2026-03-11', remainingRounds: 4, recentDailyRounds: [1] }).daysLeft, 1);
});

test('spreadRounds spreads evenly, keeps order, respects cap and rest days', () => {
  const plan = spreadRounds({
    tasks: [{ id: 'a', rounds: 5 }, { id: 'b', rounds: 3 }, { id: 'c', rounds: 0 }, { id: 'd', rounds: 2 }],
    today: '2026-03-02', // Monday
    deadline: '2026-03-06', // Friday, 4 working days
  });
  assert.equal(plan.overflowRounds, 0);
  assert.deepEqual(plan.perDay, { '2026-03-02': 3, '2026-03-03': 3, '2026-03-04': 2, '2026-03-05': 2 });
  assert.deepEqual(plan.blocks.map(b => `${b.date.slice(8)}:${b.taskId}${b.rounds}`), ['02:a3', '03:a2', '03:b1', '04:b2', '05:d2']);
  assert.equal(plan.blocks.reduce((sum, b) => sum + b.rounds, 0), 10);

  const rest = spreadRounds({ tasks: [{ id: 'a', rounds: 4 }], today: '2026-03-06', deadline: '2026-03-10', restWeekdays: [0, 6] });
  assert.deepEqual(Object.keys(rest.perDay), ['2026-03-06', '2026-03-09']);

  const tight = spreadRounds({ tasks: [{ id: 'a', rounds: 30 }], today: '2026-03-02', deadline: '2026-03-04', dailyCap: 8 });
  assert.equal(tight.overflowRounds, 14);
  assert.deepEqual(Object.values(tight.perDay), [8, 8]);

  const due = spreadRounds({ tasks: [{ id: 'a', rounds: 2 }], today: '2026-03-04', deadline: '2026-03-04' });
  assert.deepEqual(due.perDay, { '2026-03-04': 2 });
});
