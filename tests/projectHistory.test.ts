import assert from 'node:assert/strict';
import test from 'node:test';
import type { KairoSession, Project } from '../types.ts';
import { buildProjectHistory } from '../utils/projectHistory.ts';

const project: Project = {
  id: 'p', name: 'Algebra', subProjects: [], isExpanded: true,
  tasks: [
    { id: 'a', name: 'Vectors', completed: true, timeSpent: 75, targetRounds: 3 },
    { id: 'b', name: 'Matrices', completed: false, timeSpent: 25, targetRounds: 4 },
  ],
};
const s = (id: string, day: string, minutes: number, taskId?: string, extra: Partial<KairoSession> = {}): KairoSession =>
  ({ id, date: new Date(`${day}T10:00:00`).toISOString(), duration: minutes, completed: true, type: 'focus', taskId, ...extra });

test('history only counts this project, groups by day and task, and lists recent sessions newest first', () => {
  const h = buildProjectHistory({
    project,
    today: '2026-03-10',
    days: 5,
    sessions: [
      s('1', '2026-03-10', 25, 'a', { intention: 'Finish proofs' }),
      s('2', '2026-03-10', 25, 'b'),
      s('3', '2026-03-08', 50, 'a'),
      s('4', '2026-03-08', 25, 'other-project-task'),
      s('5', '2026-03-09', 25, undefined),
      { ...s('6', '2026-03-09', 25, 'a'), type: 'shortBreak' },
      { ...s('7', '2026-03-09', 25, 'a'), completed: false },
    ],
  });
  assert.equal(h.totalMinutes, 100);
  assert.equal(h.sessionCount, 3);
  assert.equal(h.activeDays, 2);
  assert.deepEqual([h.firstDay, h.lastDay], ['2026-03-08', '2026-03-10']);
  assert.deepEqual(h.daily.map(d => d.minutes), [0, 0, 50, 0, 50]);
  assert.deepEqual(h.daily.map(d => d.date.slice(8)), ['06', '07', '08', '09', '10']);
  assert.deepEqual(h.tasks.map(t => [t.name, t.minutes, t.sessions, t.doneRounds, t.targetRounds, t.completed]), [['Vectors', 75, 2, 3, 3, true], ['Matrices', 25, 1, 1, 4, false]]);
  assert.equal(h.recent.length, 3);
  assert.equal(h.recent[h.recent.length - 1]!.id, '3');
  assert.ok(h.recent.some(r => r.intention === 'Finish proofs'));
});

test('an untouched project has an empty history and a full zero-filled timeline', () => {
  const h = buildProjectHistory({ project, sessions: [], today: '2026-03-10' });
  assert.deepEqual([h.totalMinutes, h.sessionCount, h.activeDays, h.firstDay, h.recent.length], [0, 0, 0, undefined, 0]);
  assert.equal(h.daily.length, 30);
  assert.equal(h.tasks.length, 2);
});
