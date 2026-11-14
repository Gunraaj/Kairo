import assert from 'node:assert/strict';
import test from 'node:test';
import type { Project, Task } from '../types.ts';
import { applyReplanOps, proposeReplan, ReplanUnavailableError, resolveReplanOps } from '../utils/replan.ts';
import { buildTodayState } from '../utils/todayPlan.ts';

const task = (id: string, rounds: number, extra: Partial<Task> = {}): Task =>
  ({ id, name: `Task ${id}`, completed: false, timeSpent: 0, targetRounds: rounds, ...extra });
const project = (): Project => ({
  id: 'p', name: 'Chem', subProjects: [], isExpanded: true, deadline: '2026-03-12',
  tasks: [task('a', 4, { timeSpent: 25 }), task('b', 6), task('c', 3), task('d', 2, { completed: true, timeSpent: 50 })],
});

test('resolve keeps only safe ops on real unfinished tasks', () => {
  const ops = resolveReplanOps(project(), [
    { kind: 'set_rounds', task: 'task b', rounds: 3, reason: 'smaller' },
    { kind: 'drop', task: 'Task a', reason: 'started, must be ignored' },
    { kind: 'drop', task: 'Task d', reason: 'already finished' },
    { kind: 'drop', task: 'Task nope', reason: 'unknown' },
    { kind: 'split', task: 'Task c', parts: [{ name: 'c1', rounds: 1 }], reason: 'needs two parts' },
    { kind: 'set_rounds', task: 'Task b', rounds: 1, reason: 'duplicate task ignored' },
    { kind: 'set_rounds', task: 'Task c', rounds: 3, reason: 'same as now, so a no-op' },
  ]);
  assert.deepEqual(ops.map(o => [o.kind, o.taskId]), [['set_rounds', 'b']]);
});

test('set_rounds never goes below rounds already done', () => {
  const p = project();
  p.tasks[0] = task('a', 6, { timeSpent: 75 });
  const [op] = resolveReplanOps(p, [{ kind: 'set_rounds', task: 'Task a', rounds: 1, reason: 'x' }]);
  assert.equal((op as any).rounds, 3);
});

test('apply: re-estimate, drop, split and reorder', () => {
  const p = project();
  const ops = resolveReplanOps(p, [
    { kind: 'set_rounds', task: 'Task b', rounds: 3, reason: 'r' },
    { kind: 'split', task: 'Task c', parts: [{ name: 'c1', rounds: 1 }, { name: 'c2', rounds: 2 }], reason: 'r' },
  ]);
  let n = 0;
  const next = applyReplanOps(p, ops, () => `new${++n}`);
  assert.deepEqual(next.tasks.map(t => `${t.id}:${t.targetRounds}`), ['a:4', 'b:3', 'new1:1', 'new2:2', 'd:2']);
  assert.equal(next.tasks[1]!.estimatedRounds, 6);

  const moved = applyReplanOps(p, resolveReplanOps(p, [{ kind: 'reorder', task: 'Task c', position: 1, reason: 'r' }]));
  assert.deepEqual(moved.tasks.map(t => t.id), ['c', 'a', 'b', 'd']);

  const dropped = applyReplanOps(p, resolveReplanOps(p, [{ kind: 'drop', task: 'Task c', reason: 'r' }]));
  assert.deepEqual(dropped.tasks.map(t => t.id), ['a', 'b', 'd']);
});

test('proposeReplan sends pace numbers and returns resolved ops; failures become ReplanUnavailableError', async () => {
  const p = project();
  const state = buildTodayState({ projects: [p], sessions: [], today: '2026-03-10' });
  let sent = '';
  const fetchImpl = (async (_u: unknown, init?: RequestInit) => {
    sent = JSON.parse(String(init?.body)).messages[1].content;
    return new Response(JSON.stringify({ choices: [{ message: { content: '{"changes":[{"kind":"set_rounds","task":"Task b","rounds":3,"reason":"Fits the time left"}]}' } }] }));
  }) as typeof fetch;
  const config = { provider: 'local' as const, apiKey: '', baseUrl: 'http://x/v1', model: 'm', temperature: 0 };
  const ops = await proposeReplan({ project: p, plan: state.projects[0]!, multiplier: state.multiplier }, { config, fetchImpl });
  assert.match(sent, /Deadline: 2026-03-12/);
  assert.match(sent, /Task b - 0\/6 rounds done/);
  assert.deepEqual(ops.map(o => o.kind), ['set_rounds']);

  const failing = (async () => new Response('{}', { status: 500 })) as typeof fetch;
  await assert.rejects(proposeReplan({ project: p, plan: state.projects[0]!, multiplier: 1 }, { config, fetchImpl: failing }), ReplanUnavailableError);
});
