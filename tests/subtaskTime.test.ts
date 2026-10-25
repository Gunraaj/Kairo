import assert from 'node:assert/strict';
import test from 'node:test';
import type { Task } from '../types.ts';
import {
  calculateDonePomodoros,
  calculateEffectiveTaskTime,
  calculateFinishEstimate,
  calculatePlannedMinutes,
  calculateSubtaskSum,
  cycleTimeCalcMode,
  estimatePomodorosFromSubtasks,
  formatDurationCompact,
  formatPomodoroRatio,
  updateSubtaskMinutes,
} from '../utils/subtaskTime.ts';

test('calculateSubtaskSum aggregates minutes correctly and ignores non-finite', () => {
  const sum1 = calculateSubtaskSum([
    { id: '1', name: 'A', completed: false, timeSpent: 25 },
    { id: '2', name: 'B', completed: true, timeSpent: 45 },
    { id: '3', name: 'C', completed: false },
  ]);
  assert.equal(sum1, 70);

  assert.equal(calculateSubtaskSum([]), 0);
  assert.equal(calculateSubtaskSum(undefined), 0);
});

test('calculateEffectiveTaskTime respects auto, direct, and hybrid modes', () => {
  // 1. Task without subtasks uses task.timeSpent directly
  const soloTask: Task = {
    id: 'solo',
    name: 'Solo Task',
    completed: false,
    timeSpent: 50,
  };
  assert.equal(calculateEffectiveTaskTime(soloTask), 50);

  // 2. Task with subtasks in 'auto' mode sums subtasks
  const autoTask: Task = {
    id: 't1',
    name: 'Auto Task',
    completed: false,
    timeSpent: 10, // stale or overridden
    timeCalcMode: 'auto',
    subTasks: [
      { id: 's1', name: 'Sub 1', completed: true, timeSpent: 25 },
      { id: 's2', name: 'Sub 2', completed: false, timeSpent: 30 },
    ],
  };
  assert.equal(calculateEffectiveTaskTime(autoTask), 55);

  // 3. Task in 'hybrid' mode combines direct parent overhead + subtasks
  const hybridTask: Task = {
    id: 't2',
    name: 'Hybrid Task',
    completed: false,
    timeSpent: 75,
    directTimeSpent: 20, // 20 min direct overview
    timeCalcMode: 'hybrid',
    subTasks: [
      { id: 's1', name: 'Sub 1', completed: true, timeSpent: 25 },
      { id: 's2', name: 'Sub 2', completed: false, timeSpent: 30 },
    ],
  };
  // 20 direct + 55 subtasks = 75
  assert.equal(calculateEffectiveTaskTime(hybridTask), 75);

  // 4. Task in 'direct' mode ignores subtasks for the task total
  const directTask: Task = {
    id: 't3',
    name: 'Direct Task',
    completed: false,
    timeSpent: 40,
    timeCalcMode: 'direct',
    subTasks: [
      { id: 's1', name: 'Sub 1', completed: true, timeSpent: 90 },
    ],
  };
  assert.equal(calculateEffectiveTaskTime(directTask), 40);
});

test('updateSubtaskMinutes recalculates parent task time automatically', () => {
  const task: Task = {
    id: 'parent',
    name: 'Parent Task',
    completed: false,
    timeSpent: 0,
    timeCalcMode: 'auto',
    subTasks: [
      { id: 'sub-1', name: 'First step', completed: false, timeSpent: 15 },
      { id: 'sub-2', name: 'Second step', completed: false, timeSpent: 0 },
    ],
  };

  // Add 25m to sub-2
  const updated1 = updateSubtaskMinutes(task, 'sub-2', 25, 'add');
  assert.equal(updated1.subTasks?.[1].timeSpent, 25);
  assert.equal(updated1.timeSpent, 40); // 15 + 25 = 40

  // Set sub-1 to 50m
  const updated2 = updateSubtaskMinutes(updated1, 'sub-1', 50, 'set');
  assert.equal(updated2.subTasks?.[0].timeSpent, 50);
  assert.equal(updated2.timeSpent, 75); // 50 + 25 = 75
});

test('cycleTimeCalcMode cycles seamlessly', () => {
  assert.equal(cycleTimeCalcMode(undefined), 'hybrid');
  assert.equal(cycleTimeCalcMode('auto'), 'hybrid');
  assert.equal(cycleTimeCalcMode('hybrid'), 'direct');
  assert.equal(cycleTimeCalcMode('direct'), 'auto');
});

test('formatDurationCompact formats clean strings', () => {
  assert.equal(formatDurationCompact(0), '0m');
  assert.equal(formatDurationCompact(25), '25m');
  assert.equal(formatDurationCompact(60), '1h');
  assert.equal(formatDurationCompact(85), '1h 25m');
  assert.equal(formatDurationCompact(120), '2h');
});

test('Pomodoro target calculations enforce whole integers and clean ratios like Focus To-Do', () => {
  // calculateDonePomodoros
  assert.equal(calculateDonePomodoros(0, 25), 0);
  assert.equal(calculateDonePomodoros(24, 25), 0); // 24m not yet 1 full pomodoro
  assert.equal(calculateDonePomodoros(25, 25), 1);
  assert.equal(calculateDonePomodoros(50, 25), 2);
  assert.equal(calculateDonePomodoros(74, 25), 2);
  assert.equal(calculateDonePomodoros(75, 25), 3);
  assert.equal(calculateDonePomodoros(90, 30), 3); // 30m custom pomodoro duration

  // formatPomodoroRatio produces integer ratios like 0/4, 2/4, never floats like 3.5
  assert.equal(formatPomodoroRatio(0, 4), '0/4');
  assert.equal(formatPomodoroRatio(2, 4), '2/4');
  assert.equal(formatPomodoroRatio(4, 4), '4/4');
  assert.equal(formatPomodoroRatio(5, 4), '5/4');
  assert.equal(formatPomodoroRatio(3.7 as any, 5.2 as any), '3/5'); // always floored integers

  // calculatePlannedMinutes
  assert.equal(calculatePlannedMinutes(4, 25), 100);
  assert.equal(calculatePlannedMinutes(3, 30), 90);
  assert.equal(calculatePlannedMinutes(2, 50), 100);

  // estimatePomodorosFromSubtasks
  const subs = [
    { id: '1', name: 'Outline', completed: false, estimatedMinutes: 20 },
    { id: '2', name: 'Draft', completed: false, estimatedMinutes: 40 },
    { id: '3', name: 'Review', completed: false, estimatedMinutes: 15 },
  ];
  // total estimated = 75m -> with 25m pomodoro = Math.ceil(75 / 25) = 3 pomodoros
  assert.equal(estimatePomodorosFromSubtasks(subs, 25), 3);
  // with 30m pomodoro = Math.ceil(75 / 30) = 3 pomodoros
  assert.equal(estimatePomodorosFromSubtasks(subs, 30), 3);
  // with 50m pomodoro = Math.ceil(75 / 50) = 2 pomodoros
  assert.equal(estimatePomodorosFromSubtasks(subs, 50), 2);
});

test('calculateFinishEstimate compiles Pomofocus-style total pomodoros and finish time', () => {
  const tasks = [
    { targetRounds: 6, timeSpent: 0, completed: false }, // 6 pomos
    { targetRounds: 2, timeSpent: 0, completed: false }, // 2 pomos
    { targetRounds: 1, timeSpent: 0, completed: false }, // 1 pomo
  ];
  const settings = { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, longBreakInterval: 4 };
  const mockNow = new Date('2026-10-25T10:00:00.000Z');

  // Total pomos = 9, done = 0, remaining = 9
  // Focus minutes = 9 * 25 = 225m
  // Breaks between 9 sessions = 8 breaks
  // Long breaks = Math.floor(8 / 4) = 2 long breaks (2 * 15 = 30m)
  // Short breaks = 8 - 2 = 6 short breaks (6 * 5 = 30m)
  // Total break minutes = 60m
  // Total minutes = 225 + 60 = 285m (4.75h) -> 4.8h
  const res = calculateFinishEstimate(tasks, settings, mockNow);
  assert.equal(res.totalPomos, 9);
  assert.equal(res.donePomos, 0);
  assert.equal(res.remainingPomos, 9);
  assert.equal(res.totalMinutes, 285);
  assert.equal(res.hoursFormatted, '4.8h');

  // Verify all tasks done gives 0m remaining
  const doneTasks = [
    { targetRounds: 2, timeSpent: 50, completed: true },
  ];
  const doneRes = calculateFinishEstimate(doneTasks, settings, mockNow);
  assert.equal(doneRes.totalPomos, 2);
  assert.equal(doneRes.donePomos, 2);
  assert.equal(doneRes.remainingPomos, 0);
  assert.equal(doneRes.totalMinutes, 0);
});
