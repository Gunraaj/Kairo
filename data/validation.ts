import type { KairoSession, Project, SubTask, Task, TaskStatus, UserSettings, SavedFocusStream, TimeCapsule, Palette } from '../types';

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

const normalizeSubTask = (value: unknown): SubTask | null => {
  const source = objectValue(value);
  if (!source) return null;
  return {
    id: id(source.id),
    name: text(source.name, 'Untitled subtask', 160),
    completed: source.completed === true,
    timeSpent: typeof source.timeSpent === 'number'
      ? Math.round(boundedNumber(source.timeSpent, 0, 0, 1_000_000))
      : 0,
    estimatedMinutes: typeof source.estimatedMinutes === 'number'
      ? Math.round(boundedNumber(source.estimatedMinutes, 25, 1, 10_000))
      : undefined,
    targetRounds: typeof source.targetRounds === 'number'
      ? Math.round(boundedNumber(source.targetRounds, 1, 1, 24))
      : undefined,
    pomodoroLength: typeof source.pomodoroLength === 'number'
      ? Math.round(boundedNumber(source.pomodoroLength, 25, 1, 180))
      : undefined,
  };
};

const dayKeyValue = (value: unknown): string | undefined =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) ? value : undefined;

const normalizeTask = (value: unknown): Task | null => {
  const source = objectValue(value);
  if (!source) return null;
  const completed = source.completed === true;
  const allowedStatuses: TaskStatus[] = ['todo', 'in-progress', 'done'];
  const status = allowedStatuses.includes(source.status as TaskStatus)
    ? source.status as TaskStatus
    : completed ? 'done' : 'todo';

  const allowedCalcModes = ['auto', 'direct', 'hybrid'];
  const timeCalcMode = allowedCalcModes.includes(source.timeCalcMode as string)
    ? (source.timeCalcMode as 'auto' | 'direct' | 'hybrid')
    : undefined;

  const subTasks = Array.isArray(source.subTasks)
    ? source.subTasks.slice(0, 50).flatMap(sub => {
        const normalized = normalizeSubTask(sub);
        return normalized ? [normalized] : [];
      })
    : [];

  return {
    id: id(source.id),
    name: text(source.name, 'Untitled task', 160),
    completed,
    status,
    timeSpent: Math.round(boundedNumber(source.timeSpent, 0, 0, 1_000_000)),
    estimatedRounds: typeof source.estimatedRounds === 'number'
      ? Math.round(boundedNumber(source.estimatedRounds, 1, 1, 100))
      : undefined,
    directTimeSpent: typeof source.directTimeSpent === 'number'
      ? Math.round(boundedNumber(source.directTimeSpent, 0, 0, 1_000_000))
      : undefined,
    timeCalcMode,
    targetRounds: typeof source.targetRounds === 'number'
      ? Math.round(boundedNumber(source.targetRounds, 4, 1, 24))
      : undefined,
    pomodoroLength: typeof source.pomodoroLength === 'number'
      ? Math.round(boundedNumber(source.pomodoroLength, 25, 1, 180))
      : undefined,
    subTasks,
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
      deadline: dayKeyValue(source.deadline),
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
      intention: typeof source.intention === 'string' && source.intention.trim()
        ? text(source.intention, '', 200)
        : undefined,
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

export const normalizeTheme = (value: unknown): 'light' | 'dark' =>
  value === 'light' ? 'light' : 'dark';

export const ALLOWED_PALETTES: readonly Palette[] = ['obsidian', 'zen', 'indigo', 'washi'] as const;

export const normalizePalette = (value: unknown): Palette => {
  if (typeof value !== 'string') return 'obsidian';
  const cleaned = value.toLowerCase().trim() as Palette;
  return ALLOWED_PALETTES.includes(cleaned) ? cleaned : 'obsidian';
};

export const normalizeSavedStreams = (value: unknown): SavedFocusStream[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap(item => {
    const source = objectValue(item);
    if (!source) return [];
    const provider = source.provider === 'spotify' ? 'spotify' : 'youtube';
    const embed = typeof source.embedUrl === 'string' ? source.embedUrl.trim() : '';
    const orig = typeof source.originalUrl === 'string' ? source.originalUrl.trim() : '';
    if (!embed) return [];
    const createdAt = typeof source.createdAt === 'number' && Number.isFinite(source.createdAt)
      ? source.createdAt
      : Date.now();
    const badge = typeof source.badge === 'string'
      ? text(source.badge, provider === 'spotify' ? 'Spotify' : 'Lofi', 20)
      : (provider === 'spotify' ? 'Spotify' : 'Lofi');
    const emoji = typeof source.emoji === 'string' ? text(source.emoji, '', 8) : undefined;
    return [{
      id: id(source.id),
      name: text(source.name, 'Focus Stream', 80),
      subtitle: typeof source.subtitle === 'string' ? text(source.subtitle, '', 80) : undefined,
      provider,
      originalUrl: orig,
      embedUrl: embed,
      badge,
      emoji,
      createdAt,
    }];
  });
};

export const normalizeTimeCapsules = (value: unknown): TimeCapsule[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 50).flatMap(item => {
    const source = objectValue(item);
    if (!source) return [];
    const rawMessage = typeof source.message === 'string' ? source.message.trim() : '';
    if (!rawMessage) return [];

    const triggerType: TimeCapsule['triggerType'] =
      source.triggerType === 'time' ? 'time'
      : source.triggerType === 'tomorrow' ? 'tomorrow'
      : 'rounds';

    const targetRounds = typeof source.targetRounds === 'number' && Number.isFinite(source.targetRounds)
      ? Math.max(1, Math.min(24, Math.floor(source.targetRounds)))
      : undefined;

    const targetTime = typeof source.targetTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(source.targetTime)
      ? source.targetTime
      : undefined;

    const createdAt = typeof source.createdAt === 'string' && !Number.isNaN(new Date(source.createdAt).getTime())
      ? source.createdAt
      : new Date().toISOString();

    const unlockedAt = typeof source.unlockedAt === 'string' && !Number.isNaN(new Date(source.unlockedAt).getTime())
      ? source.unlockedAt
      : undefined;

    return [{
      id: id(source.id),
      createdAt,
      message: text(rawMessage, '', 500),
      treat: typeof source.treat === 'string' ? text(source.treat, '', 200) : '',
      triggerType,
      targetRounds,
      completedRoundsAtCreation: typeof source.completedRoundsAtCreation === 'number' && Number.isFinite(source.completedRoundsAtCreation)
        ? Math.max(0, Math.floor(source.completedRoundsAtCreation))
        : 0,
      targetTime,
      targetDate: typeof source.targetDate === 'string' ? text(source.targetDate, '', 32) : undefined,
      isUnlocked: Boolean(source.isUnlocked),
      unlockedAt,
    }];
  });
};
