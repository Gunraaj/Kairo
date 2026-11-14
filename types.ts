
export type TaskStatus = 'todo' | 'in-progress' | 'done';
export type TimeCalcMode = 'auto' | 'direct' | 'hybrid';

export interface SubTask {
  id: string;
  name: string;
  completed: boolean;
  timeSpent?: number; // in minutes spent on this subtask
  estimatedMinutes?: number; // estimated duration in minutes
  targetRounds?: number; // target Pomodoro rounds (whole integer)
  pomodoroLength?: number; // duration of each pomodoro in minutes
}

export interface Task {
  id: string;
  name: string;
  completed: boolean;
  timeSpent: number; // in minutes
  status?: TaskStatus;
  targetRounds?: number;
  pomodoroLength?: number; // duration of each pomodoro in minutes (default 25 or settings.focusDuration)
  subTasks?: SubTask[];
  timeCalcMode?: TimeCalcMode; // 'auto' (sum of subtasks), 'direct' (standalone), 'hybrid' (direct + subtasks)
  directTimeSpent?: number; // unassigned direct minutes spent on parent task (used in hybrid mode)
  estimatedRounds?: number; // rounds originally estimated (kept when targetRounds is re-planned)
}

export interface Project {
  id: string;
  name: string;
  tasks: Task[];
  subProjects: Project[];
  isExpanded: boolean;
  deadline?: string; // YYYY-MM-DD, local day
}

export interface FocusTarget {
  id: string;
  name: string;
  kind: 'project' | 'task';
  completed?: boolean;
  targetRounds?: number;
  pomodoroLength?: number;
  timeSpent?: number;
  subTasks?: SubTask[];
}

export type SessionType = 'focus' | 'shortBreak' | 'longBreak';

export interface KairoSession {
  id: string;
  date: string;
  duration: number;
  completed: boolean;
  type: SessionType;
  taskName?: string;
  taskId?: string;
  distractions?: number;
  // Implementation intention captured before the session started. One
  // sentence describing what the user is trying to accomplish. Evidence-
  // backed (Gollwitzer 1999): naming the intention increases follow-through.
  intention?: string;
}

export interface AudioSettings {
  isPlaying: boolean;
  engineEnabled: boolean;
  mode: 'binaural' | 'isochronic' | 'noise';
  ambientPreset: 'none' | 'rain' | 'ocean' | 'cafe' | 'fireplace';
  baseFrequency: number;
  beatFrequency: number;
  waveType: 'sine' | 'triangle';
  noiseType: 'pink' | 'brown' | 'white';
  binauralVolume: number;
  noiseVolume: number;
  masterVolume: number;
}

export interface UserSettings {
  focusDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  autoStartBreaks: boolean;
  sessionsPerRound: number;
  deepFocusMode: boolean;
}

export type Settings = UserSettings;

export type Palette = 'obsidian' | 'zen' | 'indigo' | 'washi';

export type StageLayoutVariation = 'zen' | 'classic' | 'cockpit';

export interface TimeCapsule {
  id: string;
  createdAt: string;
  message: string;
  treat: string;
  triggerType: 'rounds' | 'time' | 'tomorrow';
  targetRounds?: number;
  completedRoundsAtCreation: number;
  targetTime?: string;
  targetDate?: string;
  isUnlocked: boolean;
  unlockedAt?: string;
}

export interface SavedFocusStream {
  id: string;
  name: string;
  subtitle?: string;
  provider: 'youtube' | 'spotify';
  originalUrl: string;
  embedUrl: string;
  badge: string;
  emoji?: string;
  createdAt: number;
}
