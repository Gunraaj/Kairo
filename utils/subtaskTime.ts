import type { SubTask, Task, TimeCalcMode } from '../types';

/**
 * Sums all minutes spent on a list of subtasks.
 */
export const calculateSubtaskSum = (subTasks: SubTask[] | undefined): number => {
  if (!Array.isArray(subTasks) || subTasks.length === 0) return 0;
  return subTasks.reduce((sum, st) => sum + (Number.isFinite(st.timeSpent) ? Math.max(0, st.timeSpent || 0) : 0), 0);
};

/**
 * Calculates the effective total time for a task depending on its timeCalcMode:
 * - 'auto': strictly the sum of all subtasks (default when subtasks exist)
 * - 'direct': manual/standalone time on the parent task
 * - 'hybrid': direct time spent on parent task + sum of all subtasks
 * - if no subtasks exist, returns task.timeSpent directly
 */
export const calculateEffectiveTaskTime = (task: Task): number => {
  const subTasks = Array.isArray(task.subTasks) ? task.subTasks : [];
  if (subTasks.length === 0) {
    return Math.max(0, task.timeSpent || 0);
  }

  const mode: TimeCalcMode = task.timeCalcMode || 'auto';
  const subtaskSum = calculateSubtaskSum(subTasks);

  switch (mode) {
    case 'auto':
      return subtaskSum;
    case 'hybrid': {
      const direct = Number.isFinite(task.directTimeSpent)
        ? Math.max(0, task.directTimeSpent || 0)
        : Math.max(0, (task.timeSpent || 0) - subtaskSum);
      return direct + subtaskSum;
    }
    case 'direct':
      return Math.max(0, task.timeSpent || 0);
    default:
      return subtaskSum;
  }
};

/**
 * Updates a subtask's time and automatically recalculates the parent task's timeSpent.
 */
export const updateSubtaskMinutes = (
  task: Task,
  subtaskId: string,
  minutes: number,
  operation: 'set' | 'add' = 'set',
): Task => {
  const subTasks = (task.subTasks || []).map(st => {
    if (st.id !== subtaskId) return st;
    const current = Math.max(0, st.timeSpent || 0);
    const next = operation === 'add' ? current + minutes : minutes;
    return { ...st, timeSpent: Math.max(0, Math.round(next)) };
  });

  const updatedTask: Task = {
    ...task,
    subTasks,
  };

  const nextTotal = calculateEffectiveTaskTime(updatedTask);
  return {
    ...updatedTask,
    timeSpent: nextTotal,
  };
};

/**
 * Cycles calculation mode: 'auto' -> 'hybrid' -> 'direct' -> 'auto'
 */
export const cycleTimeCalcMode = (current?: TimeCalcMode): TimeCalcMode => {
  if (!current || current === 'auto') return 'hybrid';
  if (current === 'hybrid') return 'direct';
  return 'auto';
};

/**
 * Formats minutes into human-readable compact notation (e.g. "45m", "1h 15m")
 */
export const formatDurationCompact = (minutes: number): string => {
  const safe = Math.max(0, Math.round(minutes || 0));
  if (safe < 60) return `${safe}m`;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};
