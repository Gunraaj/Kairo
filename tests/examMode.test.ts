import assert from 'node:assert/strict';
import test from 'node:test';
import { buildSprint, examPhase } from '../utils/examMode.ts';

const at = (h: number, m = 0) => new Date(2026, 2, 10, h, m);
const clock = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

test('phases follow days left', () => {
  assert.deepEqual([10, 7, 4, 3, 2, 1, 0, -1].map(examPhase), ['normal', 'crunch', 'crunch', 'final-days', 'final-days', 'eve', 'exam-day', 'exam-day']);
});

test('sprint interleaves topics, cycles techniques, and puts a long break after every 4th round', () => {
  const s = buildSprint({
    tasks: [{ id: 'a', name: 'Alpha', rounds: 4 }, { id: 'b', name: 'Beta', rounds: 4 }],
    minutes: 240,
    start: at(9),
  });
  const focus = s.blocks.filter(b => b.kind === 'focus');
  assert.equal(s.rounds, 8);
  assert.deepEqual(focus.map(b => `${b.taskId}:${b.technique}`), ['a:recall', 'a:recall', 'b:recall', 'b:recall', 'a:practice', 'a:practice', 'b:practice', 'b:practice']);
  assert.deepEqual(s.blocks.slice(0, 4).map(b => `${clock(b.start)} ${b.kind}`), ['09:00 focus', '09:25 break', '09:30 focus', '09:55 break']);
  assert.equal(s.blocks.find(b => b.kind === 'long-break')!.end.getTime() - s.blocks.find(b => b.kind === 'long-break')!.start.getTime(), 15 * 60_000);
  assert.deepEqual(s.uncovered, []);
  // no trailing break after the last round
  assert.equal(s.blocks[s.blocks.length - 1]!.kind, 'focus');
});

test('the sprint never exceeds the time available and reports what it could not cover', () => {
  const s = buildSprint({ tasks: [{ id: 'a', name: 'A', rounds: 5 }, { id: 'b', name: 'B', rounds: 5 }, { id: 'c', name: 'C', rounds: 5 }], minutes: 60, start: at(9) });
  assert.equal(s.rounds, 2);
  assert.ok(s.endsAt.getTime() <= at(10).getTime());
  assert.deepEqual(s.covered, ['A']);
  assert.deepEqual(s.uncovered, ['B', 'C']);
});

test('stopBy trims the sprint so it ends before bedtime', () => {
  const s = buildSprint({ tasks: [{ id: 'a', name: 'A', rounds: 10 }], minutes: 600, start: at(20), stopBy: at(21, 30) });
  assert.ok(s.endsAt.getTime() <= at(21, 30).getTime());
  assert.equal(s.rounds, 3);
});

test('empty input and zero rounds give an empty sprint', () => {
  assert.equal(buildSprint({ tasks: [], minutes: 120, start: at(9) }).blocks.length, 0);
  assert.equal(buildSprint({ tasks: [{ id: 'a', name: 'A', rounds: 0 }], minutes: 120, start: at(9) }).rounds, 0);
});
