import assert from 'node:assert/strict';
import test from 'node:test';
import type { Task } from '../types.ts';
import {
  calculateEffectiveTaskTime,
  calculateSubtaskSum,
  cycleTimeCalcMode,
  formatDurationCompact,
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
