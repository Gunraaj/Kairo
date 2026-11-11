import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFinishEstimate, FinishCalculationSettings } from '../utils/subtaskTime';
import { checkUnlockableCapsules } from '../utils/timeCapsule';
import { normalizeTimeCapsules } from '../data/validation';
import type { Task, SubTask, TimeCapsule, Project } from '../types';

// ============================================================================
// PART 1: Subtask Completion & Reversion Logic Stress Test
// ============================================================================

/**
 * Pure state reducer simulating SidebarNav subtask operations exactly as implemented
 */
function applyToggleSubTaskDone(task: Task, subTaskId: string): Task {
  const currentSubs = Array.isArray(task.subTasks) ? task.subTasks : [];
  const updatedSubs = currentSubs.map(st =>
    st.id === subTaskId ? { ...st, completed: !st.completed } : st,
  );
  const allDone = updatedSubs.length > 0 && updatedSubs.every(st => st.completed);
  return {
    ...task,
    completed: allDone,
    status: (allDone ? 'done' : 'todo') as 'todo' | 'done',
    subTasks: updatedSubs,
  };
}

function applyAddSubTask(task: Task, subTaskName: string): Task {
  const name = subTaskName.trim().slice(0, 160);
  if (!name) return task;
  const subTask: SubTask = { id: `st-${Math.random().toString(36).slice(2, 9)}`, name, completed: false };
  return {
    ...task,
    completed: false,
    status: 'todo' as const,
    subTasks: [...(Array.isArray(task.subTasks) ? task.subTasks : []), subTask],
  };
}

function applyDeleteSubTask(task: Task, subTaskId: string): Task {
  const remainingSubs = (Array.isArray(task.subTasks) ? task.subTasks : []).filter(st => st.id !== subTaskId);
  const allDone = remainingSubs.length > 0 && remainingSubs.every(st => st.completed);
  return {
    ...task,
    subTasks: remainingSubs,
    ...(remainingSubs.length > 0 ? { completed: allDone, status: (allDone ? 'done' : 'todo') as 'todo' | 'done' } : {}),
  };
}

function applyToggleTaskDone(task: Task): Task {
  const nextCompleted = !task.completed;
  const updatedSubs = (Array.isArray(task.subTasks) ? task.subTasks : []).map(st => ({
    ...st,
    completed: nextCompleted,
  }));
  return {
    ...task,
    completed: nextCompleted,
    status: (nextCompleted ? 'done' : 'todo') as 'todo' | 'done',
    subTasks: updatedSubs,
  };
}

test('Subtask Reversion: 0 subtasks behavior', () => {
  let task: Task = {
    id: 't0',
    name: 'Zero Subtasks Task',
    completed: false,
    status: 'todo',
    timeSpent: 0,
    subTasks: [],
  };

  // Toggle parent task done
  task = applyToggleTaskDone(task);
  assert.equal(task.completed, true);
  assert.equal(task.status, 'done');

  // Toggle parent task undone
  task = applyToggleTaskDone(task);
  assert.equal(task.completed, false);
  assert.equal(task.status, 'todo');

  // Toggle non-existent subtask
  task = applyToggleSubTaskDone(task, 'non-existent');
  assert.equal(task.completed, false);
  assert.equal(task.status, 'todo');
});

test('Subtask Reversion: 1 subtask toggling cycle', () => {
  let task: Task = {
    id: 't1',
    name: 'Single Subtask Task',
    completed: false,
    status: 'todo',
    timeSpent: 0,
    subTasks: [{ id: 'st1', name: 'Only Subtask', completed: false }],
  };

  // Complete subtask -> parent should become done
  task = applyToggleSubTaskDone(task, 'st1');
  assert.equal(task.subTasks?.[0].completed, true);
  assert.equal(task.completed, true);
  assert.equal(task.status, 'done');

  // Uncheck subtask -> parent MUST revert to todo & incomplete
  task = applyToggleSubTaskDone(task, 'st1');
  assert.equal(task.subTasks?.[0].completed, false);
  assert.equal(task.completed, false);
  assert.equal(task.status, 'todo');

  // Toggle parent directly to done -> subtask should be done too
  task = applyToggleTaskDone(task);
  assert.equal(task.completed, true);
  assert.equal(task.status, 'done');
  assert.equal(task.subTasks?.[0].completed, true);

  // Uncheck subtask again -> parent MUST revert to todo & incomplete
  task = applyToggleSubTaskDone(task, 'st1');
  assert.equal(task.subTasks?.[0].completed, false);
  assert.equal(task.completed, false);
  assert.equal(task.status, 'todo');
});

test('Subtask Reversion: N subtasks (all done -> uncheck first, last, middle)', () => {
  const N = 5;
  const initialSubs: SubTask[] = Array.from({ length: N }, (_, i) => ({
    id: `sub-${i}`,
    name: `Subtask ${i}`,
    completed: true,
  }));

  // Initial state: all completed
  let task: Task = {
    id: 't-n',
    name: 'N Subtasks Task',
    completed: true,
    status: 'done',
    timeSpent: 100,
    subTasks: initialSubs,
  };

  // Case 1: Uncheck FIRST (index 0)
  task = applyToggleSubTaskDone(task, 'sub-0');
  assert.equal(task.subTasks?.[0].completed, false);
  assert.equal(task.completed, false, 'Parent must be incomplete when first subtask is unchecked');
  assert.equal(task.status, 'todo', 'Parent status must revert to todo');

  // Re-check first
  task = applyToggleSubTaskDone(task, 'sub-0');
  assert.equal(task.completed, true);
  assert.equal(task.status, 'done');

  // Case 2: Uncheck LAST (index N-1)
  task = applyToggleSubTaskDone(task, `sub-${N - 1}`);
  assert.equal(task.subTasks?.[N - 1].completed, false);
  assert.equal(task.completed, false, 'Parent must be incomplete when last subtask is unchecked');
  assert.equal(task.status, 'todo', 'Parent status must revert to todo');

  // Re-check last
  task = applyToggleSubTaskDone(task, `sub-${N - 1}`);
  assert.equal(task.completed, true);
  assert.equal(task.status, 'done');

  // Case 3: Uncheck MIDDLE (index 2)
  task = applyToggleSubTaskDone(task, 'sub-2');
  assert.equal(task.subTasks?.[2].completed, false);
  assert.equal(task.completed, false, 'Parent must be incomplete when middle subtask is unchecked');
  assert.equal(task.status, 'todo', 'Parent status must revert to todo');
});

test('Subtask Reversion: Rapid addition and deletion fuzzing (500 steps invariant check)', () => {
  let task: Task = {
    id: 'fuzz-task',
    name: 'Fuzz Task',
    completed: false,
    status: 'todo',
    timeSpent: 0,
    subTasks: [],
  };

  for (let step = 0; step < 500; step++) {
    const op = Math.floor(Math.random() * 4);
    const subs = task.subTasks || [];

    if (op === 0 || subs.length === 0) {
      // Add subtask
      task = applyAddSubTask(task, `Sub ${step}`);
    } else if (op === 1 && subs.length > 0) {
      // Delete random subtask
      const target = subs[Math.floor(Math.random() * subs.length)].id;
      task = applyDeleteSubTask(task, target);
    } else if (op === 2 && subs.length > 0) {
      // Toggle random subtask
      const target = subs[Math.floor(Math.random() * subs.length)].id;
      task = applyToggleSubTaskDone(task, target);
    } else {
      // Toggle parent task
      task = applyToggleTaskDone(task);
    }

    // INVARIANT CHECKS AT EVERY STEP
    const currentSubs = task.subTasks || [];
    if (currentSubs.length > 0) {
      const allDone = currentSubs.every(st => st.completed);
      if (allDone) {
        assert.equal(task.completed, true, `Step ${step}: when all subtasks completed, parent must be completed`);
        assert.equal(task.status, 'done', `Step ${step}: when all subtasks completed, parent status must be done`);
      } else {
        assert.equal(task.completed, false, `Step ${step}: when any subtask incomplete, parent must be false`);
        assert.equal(task.status, 'todo', `Step ${step}: when any subtask incomplete, parent status must be todo`);
      }
    }
    // Completed and status must NEVER diverge
    assert.equal(task.completed, task.status === 'done', `Step ${step}: completed (${task.completed}) and status (${task.status}) must agree`);
  }
});


// ============================================================================
// PART 2: Time Capsule Tomorrow Rollover Edge Cases
// ============================================================================

test('Time Capsule: targetTime === creation time (exact minute match) rolls over to tomorrow', () => {
  // Creation at 14:30:00 local time
  const created = new Date('2026-06-15T14:30:00');
  const capsule: TimeCapsule = {
    id: 'c-exact',
    createdAt: created.toISOString(),
    message: 'Exact minute capsule',
    treat: 'Espresso',
    triggerType: 'time',
    targetTime: '14:30',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  // Checked at creation time: MUST remain locked (since 14:30 today is already reached, rolls over to 14:30 tomorrow)
  const atCreation = checkUnlockableCapsules([capsule], 0, new Date('2026-06-15T14:30:00'));
  assert.equal(atCreation.unlockable.length, 0, 'Exact match must NOT unlock immediately today');
  assert.equal(atCreation.remaining.length, 1);

  // Checked late tonight: still locked
  const tonight = checkUnlockableCapsules([capsule], 0, new Date('2026-06-15T23:59:59'));
  assert.equal(tonight.unlockable.length, 0);

  // Checked tomorrow at 14:29: still locked
  const tomorrowBefore = checkUnlockableCapsules([capsule], 0, new Date('2026-06-16T14:29:59'));
  assert.equal(tomorrowBefore.unlockable.length, 0);

  // Checked tomorrow at 14:30: UNLOCKS!
  const tomorrowAt = checkUnlockableCapsules([capsule], 0, new Date('2026-06-16T14:30:00'));
  assert.equal(tomorrowAt.unlockable.length, 1);
  assert.equal(tomorrowAt.unlockable[0].id, 'c-exact');
});

test('Time Capsule: 23:59 creation with 00:01 targetTime vs 00:01 creation with 23:59 targetTime', () => {
  // Scenario A: Created at 23:59 on Nov 11, targetTime 00:01
  const createdNight = new Date('2026-11-11T23:59:00');
  const nightCapsule: TimeCapsule = {
    id: 'c-night',
    createdAt: createdNight.toISOString(),
    message: 'Night capsule',
    treat: 'Sleep',
    triggerType: 'time',
    targetTime: '00:01',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  // 30 seconds after creation on Nov 11: locked
  assert.equal(checkUnlockableCapsules([nightCapsule], 0, new Date('2026-11-11T23:59:30')).unlockable.length, 0);
  // Nov 12 at 00:00:30 (before 00:01): locked
  assert.equal(checkUnlockableCapsules([nightCapsule], 0, new Date('2026-11-12T00:00:30')).unlockable.length, 0);
  // Nov 12 at 00:01:00: UNLOCKED!
  assert.equal(checkUnlockableCapsules([nightCapsule], 0, new Date('2026-11-12T00:01:00')).unlockable.length, 1);

  // Scenario B: Created at 00:01 on Nov 11, targetTime 23:59
  const createdMorning = new Date('2026-11-11T00:01:00');
  const morningCapsule: TimeCapsule = {
    id: 'c-morning',
    createdAt: createdMorning.toISOString(),
    message: 'Morning capsule',
    treat: 'Dinner',
    triggerType: 'time',
    targetTime: '23:59',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  // Nov 11 at 12:00:00 (midday same day): locked
  assert.equal(checkUnlockableCapsules([morningCapsule], 0, new Date('2026-11-11T12:00:00')).unlockable.length, 0);
  // Nov 11 at 23:58:59: locked
  assert.equal(checkUnlockableCapsules([morningCapsule], 0, new Date('2026-11-11T23:58:59')).unlockable.length, 0);
  // Nov 11 at 23:59:00: UNLOCKED SAME DAY!
  assert.equal(checkUnlockableCapsules([morningCapsule], 0, new Date('2026-11-11T23:59:00')).unlockable.length, 1);
});

test('Time Capsule: Year boundary rollover (Dec 31 to Jan 1)', () => {
  const createdDec31 = new Date('2026-12-31T23:55:00');
  const nyeCapsule: TimeCapsule = {
    id: 'c-nye',
    createdAt: createdDec31.toISOString(),
    message: 'Happy New Year!',
    treat: 'Champagne',
    triggerType: 'time',
    targetTime: '00:05',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  // Dec 31 at 23:59: locked
  assert.equal(checkUnlockableCapsules([nyeCapsule], 0, new Date('2026-12-31T23:59:00')).unlockable.length, 0);
  // Jan 1, 2027 at 00:04: locked
  assert.equal(checkUnlockableCapsules([nyeCapsule], 0, new Date('2027-01-01T00:04:00')).unlockable.length, 0);
  // Jan 1, 2027 at 00:05: UNLOCKED!
  const unlockedNye = checkUnlockableCapsules([nyeCapsule], 0, new Date('2027-01-01T00:05:00'));
  assert.equal(unlockedNye.unlockable.length, 1);
  assert.equal(unlockedNye.unlockable[0].id, 'c-nye');
});

test('Time Capsule: Month boundary rollover (Jan 31 to Feb 1, Feb 28 to Mar 1, Leap year Feb 28 to Feb 29)', () => {
  // Jan 31 -> Feb 1
  const jan31 = new Date('2026-01-31T23:50:00');
  const janCapsule: TimeCapsule = {
    id: 'c-jan',
    createdAt: jan31.toISOString(),
    message: 'Feb treat',
    treat: 'Tea',
    triggerType: 'time',
    targetTime: '00:10',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };
  assert.equal(checkUnlockableCapsules([janCapsule], 0, new Date('2026-02-01T00:09:00')).unlockable.length, 0);
  assert.equal(checkUnlockableCapsules([janCapsule], 0, new Date('2026-02-01T00:10:00')).unlockable.length, 1);

  // Feb 28 in non-leap year (2025) -> Mar 1
  const feb28NonLeap = new Date('2025-02-28T23:50:00');
  const marCapsule: TimeCapsule = {
    id: 'c-mar',
    createdAt: feb28NonLeap.toISOString(),
    message: 'March treat',
    treat: 'Coffee',
    triggerType: 'time',
    targetTime: '00:10',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };
  assert.equal(checkUnlockableCapsules([marCapsule], 0, new Date('2025-03-01T00:09:00')).unlockable.length, 0);
  assert.equal(checkUnlockableCapsules([marCapsule], 0, new Date('2025-03-01T00:10:00')).unlockable.length, 1);

  // Feb 28 in leap year (2024) -> Feb 29
  const feb28Leap = new Date('2024-02-28T23:50:00');
  const leapCapsule: TimeCapsule = {
    id: 'c-leap',
    createdAt: feb28Leap.toISOString(),
    message: 'Leap treat',
    treat: 'Cake',
    triggerType: 'time',
    targetTime: '00:10',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };
  assert.equal(checkUnlockableCapsules([leapCapsule], 0, new Date('2024-02-29T00:09:00')).unlockable.length, 0);
  assert.equal(checkUnlockableCapsules([leapCapsule], 0, new Date('2024-02-29T00:10:00')).unlockable.length, 1);
});

test('Time Capsule: Malformed targetTime strings do not crash or prematurely unlock', () => {
  const malformedInputs = [
    '12', // missing colon
    '1234',
    '',
    'abc',
    'foo:bar',
    'NaN:NaN',
    '-10:-20',
    '-01:30',
    '12:-15',
    '24:00', // invalid hour
    '25:30',
    '12:60', // invalid minute
    '99:99',
    '12:30:45',
    ' 12:00 ',
    '<script>alert(1)</script>',
  ];

  for (const badTime of malformedInputs) {
    // 1. In validation layer: bad targetTime should be stripped to undefined
    const normalized = normalizeTimeCapsules([
      {
        id: 'c-bad',
        message: 'Test message',
        triggerType: 'time',
        targetTime: badTime,
        createdAt: '2026-11-11T12:00:00.000Z',
      },
    ]);
    assert.equal(normalized[0].targetTime, undefined, `Input '${badTime}' must be rejected by normalizeTimeCapsules`);

    // 2. In engine directly: raw malformed targetTime must not throw and must stay locked
    const rawCapsule: TimeCapsule = {
      id: `c-raw-${badTime}`,
      createdAt: new Date().toISOString(),
      message: 'Raw malformed',
      treat: 'None',
      triggerType: 'time',
      targetTime: badTime,
      completedRoundsAtCreation: 0,
      isUnlocked: false,
    };

    assert.doesNotThrow(() => {
      const res = checkUnlockableCapsules([rawCapsule], 0);
      assert.equal(res.unlockable.length, 0, `Malformed targetTime '${badTime}' must not unlock`);
      assert.equal(res.remaining.length, 1);
    }, `checkUnlockableCapsules threw on '${badTime}'`);
  }
});


// ============================================================================
// PART 3: Finish Estimate Calculations Oracle & Boundary Stress
// ============================================================================

/**
 * Mathematical Oracle for calculateFinishEstimate
 */
function mathematicalOracle(
  tasks: Array<{
    targetRounds?: number;
    completed?: boolean;
    timeSpent?: number;
    pomodoroLength?: number;
    subTasks?: SubTask[];
  }>,
  settings?: FinishCalculationSettings,
  now: Date = new Date(),
) {
  const defaultFocus = Math.max(1, Math.round(settings?.focusDuration || 25));
  const shortBreak = Math.max(0, Math.round(settings?.shortBreakDuration ?? 5));
  const longBreak = Math.max(0, Math.round(settings?.longBreakDuration ?? 15));
  const longBreakInterval = Math.max(1, Math.round(settings?.sessionsPerRound || settings?.longBreakInterval || 4));

  let totalPomos = 0;
  let donePomos = 0;
  let focusMinutes = 0;

  for (const t of tasks || []) {
    const pLen = Math.max(1, Math.round(t.pomodoroLength || defaultFocus));
    let target = t.targetRounds;
    if (target === undefined || target === null) {
      if (t.subTasks && t.subTasks.length > 0) {
        const hasExplicit = t.subTasks.some(st => typeof st.targetRounds === 'number' && st.targetRounds > 0);
        if (hasExplicit) {
          const tot = t.subTasks.reduce((acc, st) => {
            if (typeof st.targetRounds === 'number' && st.targetRounds > 0) return acc + st.targetRounds;
            if (st.estimatedMinutes && st.estimatedMinutes > 0) return acc + Math.max(1, Math.ceil(st.estimatedMinutes / pLen));
            return acc + 1;
          }, 0);
          target = Math.max(1, Math.min(24, Math.round(tot)));
        } else {
          const totEst = t.subTasks.reduce((acc, st) => acc + (st.estimatedMinutes || 0), 0);
          target = totEst <= 0 ? Math.max(1, Math.min(24, t.subTasks.length)) : Math.max(1, Math.min(24, Math.ceil(totEst / pLen)));
        }
      } else {
        target = 1;
      }
    }
    target = Math.max(1, Math.round(target));

    let spent = 0;
    if (Number.isFinite(t.timeSpent)) {
      spent = Math.max(0, t.timeSpent || 0);
    } else if (t.subTasks && t.subTasks.length > 0) {
      spent = t.subTasks.reduce((sum, st) => {
        const v = Number.isFinite(st.timeSpent) ? st.timeSpent : (st as any).duration;
        return sum + (Number.isFinite(v) ? Math.max(0, v || 0) : 0);
      }, 0);
    }

    const done = Math.min(target, Math.floor(spent / pLen));
    const effectiveDone = t.completed ? target : done;

    totalPomos += target;
    donePomos += effectiveDone;
    const remainingForTask = Math.max(0, target - effectiveDone);
    focusMinutes += remainingForTask * pLen;
  }

  const remainingPomos = Math.max(0, totalPomos - donePomos);
  if (remainingPomos === 0) {
    const hours = now.getHours().toString().padStart(2, '0');
    const mins = now.getMinutes().toString().padStart(2, '0');
    return {
      totalPomos,
      donePomos,
      remainingPomos: 0,
      totalMinutes: 0,
      finishTimeFormatted: `${hours}:${mins}`,
      hoursFormatted: '0.0h',
    };
  }

  const breaksNeeded = Math.max(0, remainingPomos - 1);
  const numLongBreaks = Math.floor(breaksNeeded / longBreakInterval);
  const numShortBreaks = Math.max(0, breaksNeeded - numLongBreaks);
  const breakMinutes = (numShortBreaks * shortBreak) + (numLongBreaks * longBreak);
  const totalMinutes = focusMinutes + breakMinutes;

  const finishDate = new Date(now.getTime() + totalMinutes * 60 * 1000);
  const finishHours = finishDate.getHours().toString().padStart(2, '0');
  const finishMins = finishDate.getMinutes().toString().padStart(2, '0');

  return {
    totalPomos,
    donePomos,
    remainingPomos,
    totalMinutes,
    finishTimeFormatted: `${finishHours}:${finishMins}`,
    hoursFormatted: (totalMinutes / 60).toFixed(1) + 'h',
  };
}

test('Finish Estimate: sessionsPerRound = 1 (every break is a long break)', () => {
  const tasks = [
    { targetRounds: 4, completed: false, timeSpent: 0, pomodoroLength: 25 },
  ];
  const settings: FinishCalculationSettings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 20,
    sessionsPerRound: 1, // Every break must be long break!
  };
  const mockNow = new Date('2026-11-11T10:00:00.000Z');
  const res = calculateFinishEstimate(tasks, settings, mockNow);
  const oracle = mathematicalOracle(tasks, settings, mockNow);

  assert.deepEqual(res, oracle);
  // 4 pomos: 3 breaks needed. With sessionsPerRound = 1, all 3 breaks are long breaks!
  // Focus: 4 * 25 = 100m. Breaks: 3 * 20 = 60m. Total = 160m = 2h 40m.
  assert.equal(res.totalMinutes, 160);
});

test('Finish Estimate: sessionsPerRound = 100 (all breaks are short breaks up to 100)', () => {
  const tasks = [
    { targetRounds: 10, completed: false, timeSpent: 0, pomodoroLength: 25 },
  ];
  const settings: FinishCalculationSettings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 30,
    sessionsPerRound: 100, // No long break until session 100
  };
  const mockNow = new Date('2026-11-11T10:00:00.000Z');
  const res = calculateFinishEstimate(tasks, settings, mockNow);
  const oracle = mathematicalOracle(tasks, settings, mockNow);

  assert.deepEqual(res, oracle);
  // 10 pomos: 9 breaks. All 9 short breaks (9 * 5 = 45m). Focus: 10 * 25 = 250m. Total: 295m.
  assert.equal(res.totalMinutes, 295);
});

test('Finish Estimate: tasks with custom pomodoroLength = 1, 5, 50, 120 minutes', () => {
  const tasks = [
    { targetRounds: 2, completed: false, timeSpent: 0, pomodoroLength: 1 },
    { targetRounds: 2, completed: false, timeSpent: 0, pomodoroLength: 5 },
    { targetRounds: 2, completed: false, timeSpent: 0, pomodoroLength: 50 },
    { targetRounds: 1, completed: false, timeSpent: 0, pomodoroLength: 120 },
  ];
  const settings: FinishCalculationSettings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsPerRound: 4,
  };
  const mockNow = new Date('2026-11-11T09:00:00.000Z');
  const res = calculateFinishEstimate(tasks, settings, mockNow);
  const oracle = mathematicalOracle(tasks, settings, mockNow);

  assert.deepEqual(res, oracle);
  // Total pomos = 2 + 2 + 2 + 1 = 7 pomos.
  // Focus: (2*1) + (2*5) + (2*50) + (1*120) = 2 + 10 + 100 + 120 = 232m.
  // Breaks: 6 breaks needed. With interval 4: 1 long break (15m), 5 short breaks (5*5=25m). Break = 40m.
  // Total = 232 + 40 = 272m (4.5h).
  assert.equal(res.totalPomos, 7);
  assert.equal(res.totalMinutes, 272);
});

test('Finish Estimate: tasks with 0 targetRounds, missing timeSpent, and all completed', () => {
  const mockNow = new Date('2026-11-11T12:00:00.000Z');
  const settings: FinishCalculationSettings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsPerRound: 4,
  };

  // Case 1: 0 targetRounds (clamped to 1) and missing timeSpent
  const clampedTasks = [
    { targetRounds: 0, completed: false, timeSpent: undefined, pomodoroLength: 25 },
  ];
  const clampedRes = calculateFinishEstimate(clampedTasks, settings, mockNow);
  assert.equal(clampedRes.totalPomos, 1);
  assert.equal(clampedRes.remainingPomos, 1);
  assert.equal(clampedRes.totalMinutes, 25);

  // Case 2: All tasks completed
  const allDoneTasks = [
    { targetRounds: 4, completed: true, timeSpent: 100, pomodoroLength: 25 },
    { targetRounds: 2, completed: true, timeSpent: 50, pomodoroLength: 25 },
  ];
  const allDoneRes = calculateFinishEstimate(allDoneTasks, settings, mockNow);
  assert.equal(allDoneRes.totalPomos, 6);
  assert.equal(allDoneRes.donePomos, 6);
  assert.equal(allDoneRes.remainingPomos, 0);
  assert.equal(allDoneRes.totalMinutes, 0);
  assert.equal(allDoneRes.hoursFormatted, '0.0h');
  const expectedNowHHMM = `${mockNow.getHours().toString().padStart(2, '0')}:${mockNow.getMinutes().toString().padStart(2, '0')}`;
  assert.equal(allDoneRes.finishTimeFormatted, expectedNowHHMM);

  // Case 3: Empty task list
  const emptyRes = calculateFinishEstimate([], settings, mockNow);
  assert.equal(emptyRes.totalPomos, 0);
  assert.equal(emptyRes.remainingPomos, 0);
  assert.equal(emptyRes.totalMinutes, 0);
});

test('Finish Estimate: 200 Randomized Oracle Fuzzing Runs', () => {
  const mockNow = new Date('2026-11-11T08:30:00.000Z');

  for (let seed = 0; seed < 200; seed++) {
    const numTasks = Math.floor(Math.random() * 6) + 1;
    const tasks = Array.from({ length: numTasks }, (_, idx) => {
      const pomodoroLength = Math.random() < 0.2 ? undefined : [1, 5, 15, 25, 45, 50, 90, 120][Math.floor(Math.random() * 8)];
      const targetRounds = Math.random() < 0.1 ? undefined : Math.floor(Math.random() * 8);
      const completed = Math.random() < 0.25;
      const timeSpent = Math.random() < 0.2 ? undefined : Math.floor(Math.random() * 200);

      return {
        id: `fuzz-t-${seed}-${idx}`,
        targetRounds,
        completed,
        timeSpent,
        pomodoroLength,
      };
    });

    const settings: FinishCalculationSettings = {
      focusDuration: [15, 25, 30, 50][Math.floor(Math.random() * 4)],
      shortBreakDuration: [3, 5, 10][Math.floor(Math.random() * 3)],
      longBreakDuration: [15, 20, 30][Math.floor(Math.random() * 3)],
      sessionsPerRound: [1, 2, 4, 8, 100][Math.floor(Math.random() * 5)],
    };

    const actual = calculateFinishEstimate(tasks, settings, mockNow);
    const expected = mathematicalOracle(tasks, settings, mockNow);

    assert.equal(actual.totalPomos, expected.totalPomos, `Fuzz run ${seed}: totalPomos mismatch`);
    assert.equal(actual.donePomos, expected.donePomos, `Fuzz run ${seed}: donePomos mismatch`);
    assert.equal(actual.remainingPomos, expected.remainingPomos, `Fuzz run ${seed}: remainingPomos mismatch`);
    assert.equal(actual.totalMinutes, expected.totalMinutes, `Fuzz run ${seed}: totalMinutes mismatch`);
    assert.equal(actual.finishTimeFormatted, expected.finishTimeFormatted, `Fuzz run ${seed}: finishTimeFormatted mismatch`);
    assert.equal(actual.hoursFormatted, expected.hoursFormatted, `Fuzz run ${seed}: hoursFormatted mismatch`);
  }
});
