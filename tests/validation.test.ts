import assert from 'node:assert/strict';
import test from 'node:test';
import {
  normalizeActiveTaskId,
  normalizeProjects,
  normalizeSessions,
  normalizeSettings,
} from '../data/validation.ts';

test('normalizes and bounds settings', () => {
  const settings = normalizeSettings({
    focusDuration: 999,
    shortBreakDuration: Number.NaN,
    longBreakDuration: -2,
    sessionsPerRound: 0,
    deepFocusMode: 'yes',
  });
  assert.equal(settings.focusDuration, 180);
  assert.equal(settings.shortBreakDuration, 5);
  assert.equal(settings.longBreakDuration, 1);
  assert.equal(settings.sessionsPerRound, 1);
  assert.equal(settings.deepFocusMode, false);
});

test('removes nested project complexity and sanitizes stored text', () => {
  const projects = normalizeProjects([{
    id: 'p1',
    name: ' Project\u0000 name ',
    tasks: [{ id: 't1', name: ' Task\u0007 name ', timeSpent: -4, completed: false }],
    subProjects: [{ id: 'nested' }],
  }]);
  assert.equal(projects[0]?.name, 'Project  name');
  assert.equal(projects[0]?.tasks[0]?.timeSpent, 0);
  assert.deepEqual(projects[0]?.subProjects, []);
});

test('drops invalid session records and clamps duration', () => {
  const sessions = normalizeSessions([
    null,
    { id: 's1', date: 'bad', duration: 999, completed: true, type: 'unexpected' },
  ]);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0]?.duration, 180);
  assert.equal(sessions[0]?.type, 'focus');
  assert.match(sessions[0]?.date ?? '', /^\d{4}-\d{2}-\d{2}T/);
});

test('accepts only bounded active task identifiers', () => {
  assert.equal(normalizeActiveTaskId('task_123'), 'task_123');
  assert.equal(normalizeActiveTaskId('javascript:alert(1)'), null);
  assert.equal(normalizeActiveTaskId('x'.repeat(129)), null);
});
