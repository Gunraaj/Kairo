import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildYearGrid,
  calculateFocusStats,
  dayKey,
  intensityLevel,
} from '../utils/analytics.ts';
import type { KairoSession } from '../types.ts';

test('intensityLevel categorizes minutes into correct tiers', () => {
  assert.equal(intensityLevel(0), 0);
  assert.equal(intensityLevel(15), 1);
  assert.equal(intensityLevel(25), 2);
  assert.equal(intensityLevel(60), 3);
  assert.equal(intensityLevel(120), 4);
  assert.equal(intensityLevel(240), 4);
});

test('buildYearGrid creates 53 weeks ending with current week Saturday', () => {
  const refDate = new Date('2026-10-24T12:00:00.000Z');
  const grid = buildYearGrid([], refDate);

  assert.equal(grid.weeks.length, 53);
  grid.weeks.forEach(w => {
    assert.equal(w.days.length, 7);
  });
});

test('calculateFocusStats aggregates total minutes, top tasks, and streaks', () => {
  const refDate = new Date('2026-10-24T12:00:00.000Z');
  const yesterday = new Date('2026-10-23T12:00:00.000Z');
  const twoDaysAgo = new Date('2026-10-22T12:00:00.000Z');

  const sessions: KairoSession[] = [
    {
      id: '1',
      date: refDate.toISOString(),
      duration: 25,
      completed: true,
      type: 'focus',
      taskName: 'Coding Feature',
      intention: 'Write clean code',
    },
    {
      id: '2',
      date: yesterday.toISOString(),
      duration: 50,
      completed: true,
      type: 'focus',
      taskName: 'Coding Feature',
      intention: 'Draft unit tests',
    },
    {
      id: '3',
      date: twoDaysAgo.toISOString(),
      duration: 30,
      completed: true,
      type: 'focus',
      taskName: 'Documentation',
    },
    {
      id: '4',
      date: refDate.toISOString(),
      duration: 10,
      completed: true,
      type: 'shortBreak', // Breaks ignored in focus stats
    },
  ];

  const stats = calculateFocusStats(sessions, refDate);

  assert.equal(stats.totalMins, 105);
  assert.equal(stats.sessionCount, 3);
  assert.equal(stats.activeDays, 3);
  assert.equal(stats.currentStreak, 3);
  assert.equal(stats.longestStreak, 3);
  assert.equal(stats.topTasks[0].name, 'Coding Feature');
  assert.equal(stats.topTasks[0].mins, 75);
  assert.equal(stats.recentIntentions.length, 2);
  assert.equal(stats.recentIntentions[0].intention, 'Write clean code');
});
