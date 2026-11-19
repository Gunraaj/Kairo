import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDonePomodoros, calculatePlannedMinutes, formatPomodoroRatio, formatSessions, snapSessions } from '../utils/subtaskTime';
import { normalizeProjects } from '../data/validation';

test('sessions are planned in halves, never below half a session', () => {
  assert.equal(snapSessions(0), 0.5);
  assert.equal(snapSessions(0.3), 0.5);
  assert.equal(snapSessions(0.5), 0.5);
  assert.equal(snapSessions(1.26), 1.5);
  assert.equal(snapSessions(3), 3);
  assert.equal(snapSessions(99), 48);
  assert.equal(snapSessions(Number.NaN), 1);
  assert.equal(formatSessions(0.5), '0.5');
  assert.equal(formatSessions(2), '2');
});

test('half sessions count progress in halves; whole targets stay whole', () => {
  assert.equal(calculateDonePomodoros(13, 25, 0.5), 0.5);
  assert.equal(calculateDonePomodoros(12, 25, 0.5), 0);
  assert.equal(calculateDonePomodoros(30, 25, 2.5), 1);
  assert.equal(calculateDonePomodoros(70, 25, 4), 2);
  assert.equal(calculateDonePomodoros(70, 25), 2);
  assert.equal(formatPomodoroRatio(0.5, 0.5), '0.5/0.5');
  assert.equal(formatPomodoroRatio(2, 4), '2/4');
  assert.equal(calculatePlannedMinutes(0.5, 30), 15);
});

test('a half-session target survives saving and loading', () => {
  const projects = normalizeProjects([{ id: 'p', name: 'P', tasks: [{ id: 't', name: 'Quick read', completed: false, timeSpent: 0, targetRounds: 0.5, subTasks: [{ id: 's', name: 'Skim', completed: false, targetRounds: 0.5 }] }], subProjects: [], isExpanded: true }]);
  assert.equal(projects[0].tasks[0].targetRounds, 0.5);
  assert.equal(projects[0].tasks[0].subTasks?.[0].targetRounds, 0.5);
});
