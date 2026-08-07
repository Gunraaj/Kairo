import type { KairoSession, Project, Task, TaskStatus, UserSettings } from '../types';

const MAX_PROJECTS = 100;
const MAX_TASKS_PER_PROJECT = 500;
const MAX_SESSIONS = 20_000;

const objectValue = (value: unknown): Record<string, unknown> | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const text = (value: unknown, fallback: string, maxLength: number) => {
  if (typeof value !== 'string') return fallback;
  const normalized = value.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, maxLength);
  return normalized || fallback;
};

const id = (value: unknown) =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
    ? value
    : crypto.randomUUID();

const boundedNumber = (value: unknown, fallback: number, min: number, max: number) => {
  const candidate = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(candidate) ? Math.min(max, Math.max(min, candidate)) : fallback;
};

const normalizeTask = (value: unknown): Task | null => {
  const source = objectValue(value);
  if (!source) return null;
  const completed = source.completed === true;
  const allowedStatuses: TaskStatus[] = ['todo', 'in-progress', 'done'];
  const status = allowedStatuses.includes(source.status as TaskStatus)
    ? source.status as TaskStatus
    : completed ? 'done' : 'todo';

  return {
    id: id(source.id),
    name: text(source.name, 'Untitled task', 160),
    completed,
    status,
    timeSpent: Math.round(boundedNumber(source.timeSpent, 0, 0, 1_000_000)),
  };
};

export const normalizeProjects = (value: unknown): Project[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_PROJECTS).flatMap(item => {
    const source = objectValue(item);
    if (!source) return [];
    const tasks = Array.isArray(source.tasks)
      ? source.tasks.slice(0, MAX_TASKS_PER_PROJECT).flatMap(task => {
          const normalized = normalizeTask(task);
          return normalized ? [normalized] : [];
        })
      : [];

    return [{
      id: id(source.id),
      name: text(source.name, 'Untitled project', 80),
      tasks,
      subProjects: [],
      isExpanded: source.isExpanded !== false,
    }];
  });
};

export const normalizeSessions = (value: unknown): KairoSession[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_SESSIONS).flatMap(item => {
    const source = objectValue(item);
    if (!source) return [];
    const type = source.type === 'shortBreak' || source.type === 'longBreak' ? source.type : 'focus';
    const parsedDate = typeof source.date === 'string' ? new Date(source.date) : new Date(Number.NaN);

    return [{
      id: id(source.id),
      date: Number.isNaN(parsedDate.getTime()) ? new Date().toISOString() : parsedDate.toISOString(),
      duration: Math.round(boundedNumber(source.duration, 1, 1, 180)),
      completed: source.completed !== false,
      type,
      taskId: typeof source.taskId === 'string' ? id(source.taskId) : undefined,
      taskName: typeof source.taskName === 'string' ? text(source.taskName, 'Untitled task', 160) : undefined,
      distractions: source.distractions === undefined
        ? undefined
        : Math.round(boundedNumber(source.distractions, 0, 0, 10_000)),
    }];
  });
};

export const DEFAULT_SETTINGS: UserSettings = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  autoStartBreaks: false,
  sessionsPerRound: 4,
  deepFocusMode: false,
};

export const normalizeSettings = (value: unknown): UserSettings => {
  const source = objectValue(value);
  if (!source) return DEFAULT_SETTINGS;
  return {
    focusDuration: Math.round(boundedNumber(source.focusDuration, 25, 1, 180)),
    shortBreakDuration: Math.round(boundedNumber(source.shortBreakDuration, 5, 1, 60)),
    longBreakDuration: Math.round(boundedNumber(source.longBreakDuration, 15, 1, 120)),
    sessionsPerRound: Math.round(boundedNumber(source.sessionsPerRound, 4, 1, 12)),
    deepFocusMode: source.deepFocusMode === true,
    autoStartBreaks: source.autoStartBreaks === true,
  };
};

export const sanitizeName = (value: string, maxLength: number) =>
  text(value, '', maxLength);

export const normalizeActiveTaskId = (value: unknown): string | null =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
