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

/**
 * Calculates completed Pomodoros from minutes spent and Pomodoro length.
 * Always returns a clean integer (never fractional floats like 3.5).
 */
export const calculateDonePomodoros = (timeSpent: number | undefined, pomodoroLength: number = 25): number => {
  const safeSpent = Math.max(0, timeSpent || 0);
  const safeLength = Math.max(1, Math.round(pomodoroLength || 25));
  return Math.floor(safeSpent / safeLength);
};

/**
 * Returns a clean integer progress ratio string like "0/4", "2/4", "4/4", "5/4".
 * Strictly integer whole numbers (never decimals like 3.5).
 */
export const formatPomodoroRatio = (doneRounds: number, targetRounds: number = 4): string => {
  const safeDone = Math.max(0, Math.floor(doneRounds || 0));
  const safeTarget = Math.max(1, Math.floor(targetRounds || 4));
  return `${safeDone}/${safeTarget}`;
};

/**
 * Calculates total planned minutes from target pomodoros and pomodoro duration.
 */
export const calculatePlannedMinutes = (targetRounds: number = 4, pomodoroLength: number = 25): number => {
  const safeTarget = Math.max(1, Math.round(targetRounds || 4));
  const safeLength = Math.max(1, Math.round(pomodoroLength || 25));
  return safeTarget * safeLength;
};

/**
 * Auto-estimates target pomodoros from a list of subtasks.
 * If subtasks have estimatedMinutes, sums them up and computes Math.ceil(total / pomodoroLength).
 */
export const estimatePomodorosFromSubtasks = (
  subTasks: SubTask[] | undefined,
  pomodoroLength: number = 25,
): number => {
  if (!Array.isArray(subTasks) || subTasks.length === 0) return 4;
  const safeLength = Math.max(1, Math.round(pomodoroLength || 25));
  const hasExplicitRounds = subTasks.some(st => typeof st.targetRounds === 'number' && st.targetRounds > 0);
  if (hasExplicitRounds) {
    const totalRounds = subTasks.reduce((acc, st) => {
      if (typeof st.targetRounds === 'number' && st.targetRounds > 0) return acc + st.targetRounds;
      if (st.estimatedMinutes && st.estimatedMinutes > 0) return acc + Math.max(1, Math.ceil(st.estimatedMinutes / safeLength));
      return acc + 1;
    }, 0);
    return Math.max(1, Math.min(24, Math.round(totalRounds)));
  }
  const totalEstimated = subTasks.reduce((acc, st) => acc + (st.estimatedMinutes || 0), 0);
  if (totalEstimated <= 0) return Math.max(1, Math.min(24, subTasks.length));
  return Math.max(1, Math.min(24, Math.ceil(totalEstimated / safeLength)));
};

export interface FinishCalculation {
  totalPomos: number;
  donePomos: number;
  remainingPomos: number;
  totalMinutes: number;
  finishTimeFormatted: string; // e.g. "21:59"
  hoursFormatted: string; // e.g. "4.7h"
}

/**
 * Calculates compiled Pomodoro totals, remaining focus & break time,
 * and estimated finish time (e.g. Pomofocus style "Pomos: 0/9 Finish At: 21:59 (4.7h)").
 */
export const calculateFinishEstimate = (
  tasks: Array<{ targetRounds?: number; completed?: boolean; timeSpent?: number; pomodoroLength?: number }>,
  settings?: { focusDuration?: number; shortBreakDuration?: number; longBreakDuration?: number; longBreakInterval?: number },
  now: Date = new Date(),
): FinishCalculation => {
  let totalPomos = 0;
  let donePomos = 0;

  const defaultFocusLen = settings?.focusDuration || 25;
  const shortBreak = settings?.shortBreakDuration || 5;
  const longBreak = settings?.longBreakDuration || 15;
  const longBreakInterval = settings?.longBreakInterval || 4;

  const list = Array.isArray(tasks) ? tasks : [];
  for (const t of list) {
    const target = Math.max(1, Math.round(t.targetRounds ?? 1));
    const pLen = t.pomodoroLength || defaultFocusLen;
    const done = Math.min(target, Math.floor((t.timeSpent || 0) / pLen));
    totalPomos += target;
    donePomos += t.completed ? target : done;
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

  const focusMinutes = remainingPomos * defaultFocusLen;
  const breaksNeeded = Math.max(0, remainingPomos - 1);
  const numLongBreaks = Math.floor(breaksNeeded / longBreakInterval);
  const numShortBreaks = Math.max(0, breaksNeeded - numLongBreaks);
  const breakMinutes = (numShortBreaks * shortBreak) + (numLongBreaks * longBreak);

  const totalMinutes = focusMinutes + breakMinutes;
  const finishDate = new Date(now.getTime() + totalMinutes * 60 * 1000);
  const finishHours = finishDate.getHours().toString().padStart(2, '0');
  const finishMins = finishDate.getMinutes().toString().padStart(2, '0');
  const finishTimeFormatted = `${finishHours}:${finishMins}`;
  const hoursFormatted = (totalMinutes / 60).toFixed(1) + 'h';

  return {
    totalPomos,
    donePomos,
    remainingPomos,
    totalMinutes,
    finishTimeFormatted,
    hoursFormatted,
  };
};
