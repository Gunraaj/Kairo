import assert from 'node:assert/strict';
import test from 'node:test';
import type { KairoSession, Project, Task } from '../types.ts';
import { buildTodayState, recentRounds } from '../utils/todayPlan.ts';
import { normalizeProjects } from '../data/validation.ts';

const task = (id: string, rounds: number, extra: Partial<Task> = {}): Task =>
  ({ id, name: `Task ${id}`, completed: false, timeSpent: 0, targetRounds: rounds, ...extra });
const project = (id: string, tasks: Task[], deadline?: string): Project =>
  ({ id, name: `Project ${id}`, tasks, subProjects: [], isExpanded: true, deadline });
const session = (day: string, minutes: number): KairoSession =>
  ({ id: `${day}-${minutes}`, date: new Date(`${day}T10:00:00`).toISOString(), duration: minutes, completed: true, type: 'focus' });

test('recentRounds buckets focus minutes into rounds per local day', () => {
  const out = recentRounds([session('2026-03-10', 50), session('2026-03-10', 25), session('2026-03-08', 25)], '2026-03-10', 4);
  assert.deepEqual(out, [0, 1, 0, 3]);
});

test('deadline projects get an even schedule; today shows the first slice in task order', () => {
  const state = buildTodayState({
    projects: [project('a', [task('t1', 6), task('t2', 4)], '2026-03-15')],
    sessions: [],
    today: '2026-03-10',
  });
  const p = state.projects[0]!;
  assert.equal(p.remainingRounds, 10);
  assert.equal(p.pace?.daysLeft, 5);
  assert.equal(p.pace?.requiredPerDay, 2);
  assert.equal(state.blocks.length, 1);
  assert.deepEqual([state.blocks[0]!.taskId, state.blocks[0]!.rounds, state.blocks[0]!.reason], ['t1', 2, 'deadline']);
});

test('earlier deadlines come first; tasks without a deadline fill the daily goal as up-next', () => {
  const state = buildTodayState({
    projects: [
      project('free', [task('f1', 5)]),
      project('later', [task('l1', 3)], '2026-03-30'),
      project('soon', [task('s1', 2)], '2026-03-12'),
    ],
    sessions: [],
    today: '2026-03-10',
    dailyGoal: 4,
  });
  assert.deepEqual(state.blocks.map(b => `${b.taskId}:${b.rounds}:${b.reason}`), ['s1:1:deadline', 'l1:1:deadline', 'f1:2:up-next']);
  assert.equal(state.plannedToday, 4);
});

test('done rounds are subtracted and completed tasks are skipped', () => {
  const state = buildTodayState({
    projects: [project('a', [task('t1', 4, { timeSpent: 50 }), task('t2', 2, { completed: true, timeSpent: 50 })], '2026-03-12')],
    sessions: [],
    today: '2026-03-10',
  });
  assert.equal(state.projects[0]!.totalRounds, 6);
  assert.equal(state.projects[0]!.doneRounds, 4);
  assert.equal(state.projects[0]!.remainingRounds, 2);
});

test('estimate multiplier from finished tasks scales what is left', () => {
  const finished = [
    task('d1', 2, { completed: true, timeSpent: 100 }),
    task('d2', 2, { completed: true, timeSpent: 100 }),
    task('d3', 2, { completed: true, timeSpent: 100 }),
  ];
  const state = buildTodayState({ projects: [project('a', [...finished, task('t1', 4)], '2026-03-20')], sessions: [], today: '2026-03-10' });
  // ratios are all 2 -> (3 + 3*2) / 6 = 1.5, so 4 planned rounds become 6
  assert.equal(state.multiplier, 1.5);
  assert.equal(state.projects[0]!.remainingRounds, 6);
});

test('falling behind is reported and an impossible deadline overflows', () => {
  const sessions = [session('2026-03-09', 25), session('2026-03-10', 25)];
  const behind = buildTodayState({ projects: [project('a', [task('t1', 20)], '2026-03-20')], sessions, today: '2026-03-10' });
  assert.ok(['behind', 'at-risk'].includes(behind.projects[0]!.pace!.status));
  assert.equal(behind.roundsToday, 1);
  const impossible = buildTodayState({ projects: [project('a', [task('t1', 60)], '2026-03-12')], sessions: [], today: '2026-03-10' });
  assert.equal(impossible.projects[0]!.pace!.status, 'infeasible');
  assert.ok(impossible.projects[0]!.overflowRounds > 0);
});

test('empty state has no plan and no blocks', () => {
  const state = buildTodayState({ projects: [], sessions: [], today: '2026-03-10' });
  assert.deepEqual([state.hasPlan, state.blocks.length, state.multiplier], [false, 0, 1]);
});

test('validation keeps valid deadlines and estimatedRounds and drops junk', () => {
  const out = normalizeProjects([
    { id: 'p', name: 'P', deadline: '2026-03-15', tasks: [{ id: 't', name: 'T', estimatedRounds: 3.4 }] },
    { id: 'q', name: 'Q', deadline: 'tomorrow', tasks: [{ id: 'u', name: 'U', estimatedRounds: 'x' }] },
  ]);
  assert.equal(out[0]!.deadline, '2026-03-15');
  assert.equal(out[0]!.tasks[0]!.estimatedRounds, 3);
  assert.equal(out[1]!.deadline, undefined);
  assert.equal(out[1]!.tasks[0]!.estimatedRounds, undefined);
});

test('a student with no study history is not marked behind', () => {
  const state = buildTodayState({ projects: [project('a', [task('t1', 10)], '2026-03-20')], sessions: [], today: '2026-03-10' });
  assert.equal(state.projects[0]!.pace!.status, 'on-track');
  assert.equal(state.projects[0]!.pace!.projectedDays, null);
});
