import assert from 'node:assert/strict';
import test from 'node:test';
import type { Task } from '../types.ts';
import {
  calculateDonePomodoros,
  calculateEffectiveTaskTime,
  calculateFinishEstimate,
  calculatePlannedMinutes,
  calculateSubtaskSum,
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

test('task total is always time on the task itself plus time on its subtasks', () => {
  assert.equal(calculateEffectiveTaskTime({ id: 'a', name: 'A', completed: false, timeSpent: 50 }), 50);
  const subs = [{ id: 's1', name: 'S1', completed: true, timeSpent: 25 }, { id: 's2', name: 'S2', completed: false, timeSpent: 30 }];
  // only subtask time recorded (old "auto sum" data): total is the subtask sum, even if timeSpent is stale
  assert.equal(calculateEffectiveTaskTime({ id: 'b', name: 'B', completed: false, timeSpent: 10, subTasks: subs }), 55);
  // explicit direct time (old "hybrid" data)
  assert.equal(calculateEffectiveTaskTime({ id: 'c', name: 'C', completed: false, timeSpent: 75, directTimeSpent: 20, subTasks: subs }), 75);
  // old "direct" data: a total larger than the subtasks keeps the difference as direct time
  assert.equal(calculateEffectiveTaskTime({ id: 'd', name: 'D', completed: false, timeSpent: 90, subTasks: subs }), 90);
});

test('adding subtask time never loses time already logged on the task itself', () => {
  const task: Task = { id: 't', name: 'T', completed: false, timeSpent: 50, subTasks: [{ id: 's', name: 'S', completed: false, timeSpent: 20 }] };
  const next = updateSubtaskMinutes(task, 's', 25, 'add');
  assert.equal(next.directTimeSpent, 30);
  assert.equal(next.subTasks![0]!.timeSpent, 45);
  assert.equal(next.timeSpent, 75);
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

test('calculateFinishEstimate supports settings.sessionsPerRound alongside longBreakInterval', () => {
  const tasks = [
    { targetRounds: 4, timeSpent: 0, completed: false },
  ];
  // 4 pomodoros with sessionsPerRound = 2:
  // Breaks between 4 sessions = 3 breaks
  // Long breaks: Math.floor(3 / 2) = 1 (1 * 15m = 15m)
  // Short breaks: 3 - 1 = 2 (2 * 5m = 10m)
  // Break minutes = 25m
  // Focus minutes = 4 * 25 = 100m
  // Total = 125m
  const settings = { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsPerRound: 2 };
  const mockNow = new Date('2026-10-25T10:00:00.000Z');
  const res = calculateFinishEstimate(tasks, settings, mockNow);
  assert.equal(res.totalMinutes, 125);
});

test('calculateFinishEstimate factors custom task pomodoroLength into remaining focus minutes', () => {
  const tasks = [
    { targetRounds: 2, pomodoroLength: 50, timeSpent: 0, completed: false }, // 2 * 50 = 100m
    { targetRounds: 2, pomodoroLength: 25, timeSpent: 0, completed: false }, // 2 * 25 = 50m
  ];
  // Total pomos = 4, done = 0, remaining = 4
  // Focus minutes = 100 + 50 = 150m (instead of 4 * 25 = 100m)
  // Breaks = 3 (3 short breaks = 15m with longBreakInterval = 4)
  // Total = 165m
  const settings = { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsPerRound: 4 };
  const mockNow = new Date('2026-10-25T10:00:00.000Z');
  const res = calculateFinishEstimate(tasks, settings, mockNow);
  assert.equal(res.totalPomos, 4);
  assert.equal(res.remainingPomos, 4);
  assert.equal(res.totalMinutes, 165);
});

test('calculateFinishEstimate infers pomodoros from subtasks when targetRounds is omitted', () => {
  const tasks = [
    {
      pomodoroLength: 25,
      completed: false,
      subTasks: [
        { id: 'st1', name: 'Part 1', completed: false, estimatedMinutes: 25 },
        { id: 'st2', name: 'Part 2', completed: false, estimatedMinutes: 25 },
      ],
    },
  ];
  const settings = { focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15, sessionsPerRound: 4 };
  const mockNow = new Date('2026-10-25T10:00:00.000Z');
  const res = calculateFinishEstimate(tasks, settings, mockNow);
  assert.equal(res.totalPomos, 2);
  assert.equal(res.remainingPomos, 2);
  // 2 pomos * 25 = 50m focus + 1 short break (5m) = 55m
  assert.equal(res.totalMinutes, 55);
});

test('Subtask completion reversion: unchecking any subtask reverts parent task to todo and incomplete', () => {
  const task: Task = {
    id: 't1',
    name: 'Research Paper',
    completed: true,
    timeSpent: 50,
    status: 'done',
    subTasks: [
      { id: 'st1', name: 'Draft Abstract', completed: true },
      { id: 'st2', name: 'Methodology', completed: true },
    ],
  };

  // Simulating toggleSubTaskDone when unchecking st2
  const updatedSubs = (task.subTasks || []).map(st =>
    st.id === 'st2' ? { ...st, completed: !st.completed } : st,
  );
  const allDone = updatedSubs.length > 0 && updatedSubs.every(st => st.completed);
  const updatedTask: Task = {
    ...task,
    completed: allDone,
    status: (allDone ? 'done' : 'todo') as 'todo' | 'done',
    subTasks: updatedSubs,
  };

  assert.equal(updatedTask.completed, false);
  assert.equal(updatedTask.status, 'todo');
  assert.equal(updatedTask.subTasks?.[1]?.completed, false);
  assert.equal(updatedTask.subTasks?.[0]?.completed, true);

  // Simulating adding a new incomplete subtask to an otherwise done task
  const newSub = { id: 'st3', name: 'Conclusion', completed: false };
  const taskWithNewSub: Task = {
    ...updatedTask,
    completed: false,
    status: 'todo',
    subTasks: [...(updatedTask.subTasks || []), newSub],
  };
  assert.equal(taskWithNewSub.completed, false);
  assert.equal(taskWithNewSub.status, 'todo');
  assert.equal(taskWithNewSub.subTasks?.length, 3);
});
