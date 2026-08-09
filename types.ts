
export type TaskStatus = 'todo' | 'in-progress' | 'done';

export interface Task {
  id: string;
  name: string;
  completed: boolean;
  timeSpent: number; // in minutes
  status?: TaskStatus;
}

export interface Project {
  id: string;
  name: string;
  tasks: Task[];
  subProjects: Project[];
  isExpanded: boolean;
}

export interface FocusTarget {
  id: string;
  name: string;
  kind: 'project' | 'task';
  completed?: boolean;
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
