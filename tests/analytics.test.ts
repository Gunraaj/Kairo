import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildYearGrid,
  calculateFocusStats,
  calculateTodaySummary,
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

test('calculateTodaySummary computes exact today focus minutes and session counts', () => {
  const today = new Date('2026-10-24T14:30:00.000Z');
  const todayEarlier = new Date('2026-10-24T09:15:00.000Z');
  const yesterday = new Date('2026-10-23T16:00:00.000Z');

  const sessions: KairoSession[] = [
    { id: 's1', date: todayEarlier.toISOString(), duration: 25, completed: true, type: 'focus' },
    { id: 's2', date: today.toISOString(), duration: 30, completed: true, type: 'focus' },
    { id: 's3', date: today.toISOString(), duration: 5, completed: true, type: 'shortBreak' }, // break ignored
    { id: 's4', date: today.toISOString(), duration: 15, completed: false, type: 'focus' }, // incomplete ignored
    { id: 's5', date: yesterday.toISOString(), duration: 45, completed: true, type: 'focus' },
    { id: 's6', date: 'invalid-date', duration: 25, completed: true, type: 'focus' }, // invalid date ignored
  ];

  const summary = calculateTodaySummary(sessions, today);
  assert.equal(summary.sessions, 2);
  assert.equal(summary.minutes, 55);
  assert.equal(summary.streak, 2);
});

test('calculateTodaySummary handles zero sessions today with streak from yesterday', () => {
  const today = new Date('2026-10-24T14:30:00.000Z');
  const yesterday = new Date('2026-10-23T16:00:00.000Z');

  const sessions: KairoSession[] = [
    { id: 's1', date: yesterday.toISOString(), duration: 25, completed: true, type: 'focus' },
  ];

  const summary = calculateTodaySummary(sessions, today);
  assert.equal(summary.sessions, 0);
  assert.equal(summary.minutes, 0);
  assert.equal(summary.streak, 1);
});
