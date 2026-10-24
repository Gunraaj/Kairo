import React, { useState, useEffect } from 'react';
import type { Project, SubTask, Task, UserSettings } from '../types';
import { breakdownProjectTasks, breakdownSubtasks } from '../utils/geminiAi';
import { SLICE_PRESETS, PRESET_LIST, type SlicePreset } from '../utils/slicePresets';
import { DocumentBreakdownModal } from './DocumentBreakdownModal';
import {
  calculateDonePomodoros,
  calculateEffectiveTaskTime,
  calculatePlannedMinutes,
  cycleTimeCalcMode,
  estimatePomodorosFromSubtasks,
  formatDurationCompact,
  formatPomodoroRatio,
  updateSubtaskMinutes,
} from '../utils/subtaskTime';

export const NavIcon: React.FC<{
  name:
    | 'folder'
    | 'folder-open'
    | 'doc'
    | 'plus'
    | 'chart'
    | 'settings'
    | 'archive'
    | 'chevron'
    | 'chevron-down'
    | 'trash'
    | 'check'
    | 'sun'
    | 'moon'
    | 'system'
    | 'sound'
    | 'keyboard'
    | 'mail'
    | 'book';
}> = ({ name }) => {
  const shared = {
    className: 'k-nav-icon',
    width: 16,
    height: 16,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  switch (name) {
    case 'folder':
      return <svg {...shared}><path d="M2 4a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" /></svg>;
    case 'folder-open':
      return <svg {...shared}><path d="M2 4a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1v1H2z" /><path d="M2 6.5h12l-1.5 5.7a1 1 0 01-1 .8H3a1 1 0 01-1-1z" /></svg>;
    case 'doc':
      return <svg {...shared}><path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M9 2v3h3" /></svg>;
    case 'plus':
      return <svg {...shared}><path d="M8 3v10M3 8h10" /></svg>;
    case 'chart':
      return <svg {...shared}><path d="M3 13V6M7 13V3M11 13V9" /></svg>;
    case 'settings':
      return <svg {...shared}><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" /></svg>;
    case 'archive':
      return <svg {...shared}><rect x="2" y="3" width="12" height="3" rx="0.5" /><path d="M3 6v7a1 1 0 001 1h8a1 1 0 001-1V6M6.5 9h3" /></svg>;
    case 'chevron':
      return <svg {...shared}><path d="M6 4l4 4-4 4" /></svg>;
    case 'chevron-down':
      return <svg {...shared}><path d="M4 6l4 4 4-4" /></svg>;
    case 'trash':
      return <svg {...shared}><path d="M3 4h10M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M4.5 4l.6 8.5a1 1 0 001 .9h3.8a1 1 0 001-.9L11.5 4" /></svg>;
    case 'check':
      return <svg {...shared}><path d="M3 8l3 3 7-7" /></svg>;
    case 'sun':
      return <svg {...shared}><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" /></svg>;
    case 'moon':
      return <svg {...shared}><path d="M13 9.5A5.5 5.5 0 116.5 3a4.5 4.5 0 006.5 6.5z" /></svg>;
    case 'system':
      return <svg {...shared}><rect x="2" y="3" width="12" height="8" rx="1" /><path d="M6 13h4M8 11v2" /></svg>;
    case 'sound':
      return <svg {...shared}><path d="M3 6v4h3l4 4V2L6 6H3zM13 5a5 5 0 010 6" /></svg>;
    case 'keyboard':
      return <svg {...shared}><rect x="2" y="4" width="12" height="8" rx="1" /><path d="M4 7h1M7 7h1M10 7h1M5 10h6" /></svg>;
    case 'mail':
      return <svg {...shared}><path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" /><path d="M2 5l6 4 6-4" /></svg>;
    case 'book':
      return (
        <svg {...shared}>
          <path d="M2 3.5A1.5 1.5 0 013.5 2H7v12H3.5A1.5 1.5 0 012 12.5v-9zM14 3.5A1.5 1.5 0 0012.5 2H9v12h3.5a1.5 1.5 0 001.5-1.5v-9z" />
        </svg>
      );
  }
};

export interface SidebarNavProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  settings?: UserSettings;
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
  onProgress: () => void;
  onSettings: () => void;
  onShortcuts?: () => void;
  onToggleSoundStudio?: () => void;
  soundStudioOpen?: boolean;
  onTimeCapsule?: () => void;
  capsuleCount?: number;
  onScience?: () => void;
  isSessionActive?: boolean;
  onStartTaskFocus?: (taskId: string) => void;
  onToggleTimer?: () => void;
}

export const SidebarNav: React.FC<SidebarNavProps> = ({
  projects,
  setProjects,
  settings,
  activeTaskId,
  setActiveTaskId,
  onProgress,
  onSettings,
  onShortcuts,
  onToggleSoundStudio,
  soundStudioOpen,
  onTimeCapsule,
  capsuleCount,
  onScience,
  isSessionActive,
  onStartTaskFocus,
  onToggleTimer,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set((Array.isArray(projects) ? projects : []).map(p => p.id)));

  useEffect(() => {
    if (Array.isArray(projects) && projects.length > 0) {
      setExpanded(prev => {
        const next = new Set(prev);
        for (const p of projects) {
          if (p.isExpanded !== false) next.add(p.id);
        }
        return next;
      });
    }
  }, [projects]);
  const [newProjectName, setNewProjectName] = useState('');
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');
  const [confirmDeleteProjectId, setConfirmDeleteProjectId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState('');
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState('');
  const [slicingProjectId, setSlicingProjectId] = useState<string | null>(null);
  const [targetPopoverTaskId, setTargetPopoverTaskId] = useState<string | null>(null);

  // Subtask state
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(() => {
    const set = new Set<string>();
    if (Array.isArray(projects)) {
      for (const p of projects) {
        if (Array.isArray(p.tasks)) {
          for (const t of p.tasks) {
            if (Array.isArray(t.subTasks) && t.subTasks.length > 0) {
              set.add(t.id);
            }
          }
        }
      }
    }
    return set;
  });
  const [addingSubTaskFor, setAddingSubTaskFor] = useState<string | null>(null);
  const [newSubTaskName, setNewSubTaskName] = useState('');
  const [editingSubTaskId, setEditingSubTaskId] = useState<string | null>(null);
  const [editSubTaskName, setEditSubTaskName] = useState('');
  const [slicingTaskId, setSlicingTaskId] = useState<string | null>(null);
  const [presetPickerForProject, setPresetPickerForProject] = useState<string | null>(null);
  const [presetPickerForTask, setPresetPickerForTask] = useState<string | null>(null);
  const [isDocBreakdownOpen, setIsDocBreakdownOpen] = useState(false);
  const [docBreakdownTargetProjectId, setDocBreakdownTargetProjectId] = useState<string | null>(null);

  const handleImportDocPlan = (imported: {
    projectName: string;
    targetProjectId?: string;
    tasks: Array<{
      name: string;
      targetRounds: number;
      subTasks: Array<{ id: string; name: string; completed: boolean }>;
    }>;
  }) => {
    if (imported.targetProjectId) {
      setProjects(prev =>
        (Array.isArray(prev) ? prev : []).map(p => {
          if (p.id !== imported.targetProjectId) return p;
          const newTasks: Task[] = imported.tasks.map(t => ({
            id: crypto.randomUUID(),
            name: t.name,
            completed: false,
            timeSpent: 0,
            status: 'todo',
            targetRounds: t.targetRounds,
            subTasks: t.subTasks.map(st => ({ id: crypto.randomUUID(), name: st.name, completed: false })),
          }));
          return {
            ...p,
            tasks: [...(p.tasks || []), ...newTasks],
          };
        }),
      );
    } else {
      const newProjId = crypto.randomUUID();
      const newTasks: Task[] = imported.tasks.map(t => ({
        id: crypto.randomUUID(),
        name: t.name,
        completed: false,
        timeSpent: 0,
        status: 'todo',
        targetRounds: t.targetRounds,
        subTasks: t.subTasks.map(st => ({ id: crypto.randomUUID(), name: st.name, completed: false })),
      }));
      const newProject: Project = {
        id: newProjId,
        name: imported.projectName,
        tasks: newTasks,
        subProjects: [],
        isExpanded: true,
      };
      setProjects(prev => [newProject, ...(Array.isArray(prev) ? prev : [])]);
      setExpanded(prev => new Set(prev).add(newProjId));
      if (newTasks.length > 0) {
        setActiveTaskId(newTasks[0].id);
      }
    }
  };

  const toggleTaskSubtasks = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const addSubTask = (projectId: string, taskId: string) => {
    const name = newSubTaskName.trim().slice(0, 160);
    if (!name) return;
    const subTask: SubTask = { id: crypto.randomUUID(), name, completed: false };
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p =>
        p.id === projectId
          ? {
              ...p,
              tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t =>
                t.id === taskId
                  ? { ...t, subTasks: [...(Array.isArray(t.subTasks) ? t.subTasks : []), subTask] }
                  : t,
              ),
            }
          : p,
      ),
    );
    setActiveTaskId(subTask.id);
    setNewSubTaskName('');
    setAddingSubTaskFor(null);
    setExpandedTasks(prev => new Set(prev).add(taskId));
    (document.activeElement as HTMLElement)?.blur?.();
  };

  const toggleSubTaskDone = (projectId: string, taskId: string, subTaskId: string) => {
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p =>
        p.id === projectId
          ? {
              ...p,
              tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
                if (t.id !== taskId) return t;
                const currentSubs = Array.isArray(t.subTasks) ? t.subTasks : [];
                const updatedSubs = currentSubs.map(st =>
                  st.id === subTaskId ? { ...st, completed: !st.completed } : st,
                );
                const allDone = updatedSubs.length > 0 && updatedSubs.every(st => st.completed);
                return {
                  ...t,
                  completed: allDone ? true : t.completed,
                  status: (allDone ? 'done' : t.status) as 'todo' | 'done',
                  subTasks: updatedSubs,
                };
              }),
            }
          : p,
      ),
    );
  };

  const deleteSubTask = (projectId: string, taskId: string, subTaskId: string) => {
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p =>
        p.id === projectId
          ? {
              ...p,
              tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t =>
                t.id === taskId
                  ? {
                      ...t,
                      subTasks: (Array.isArray(t.subTasks) ? t.subTasks : []).filter(st => st.id !== subTaskId),
                    }
                  : t,
              ),
            }
          : p,
      ),
    );
    if (activeTaskId === subTaskId) setActiveTaskId(null);
  };

  const saveSubTaskRename = (projectId: string, taskId: string, subTaskId: string) => {
    const name = editSubTaskName.trim().slice(0, 160);
    if (name) {
      setProjects(prev =>
        (Array.isArray(prev) ? prev : []).map(p =>
          p.id === projectId
            ? {
                ...p,
                tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t =>
                  t.id === taskId
                    ? {
                        ...t,
                        subTasks: (Array.isArray(t.subTasks) ? t.subTasks : []).map(st =>
                          st.id === subTaskId ? { ...st, name } : st,
                        ),
                      }
                    : t,
                ),
              }
            : p,
        ),
      );
    }
    setEditingSubTaskId(null);
  };

  const adjustSubtaskTime = (
    projectId: string,
    taskId: string,
    subtaskId: string,
    delta: number,
  ) => {
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
            if (t.id !== taskId) return t;
            return updateSubtaskMinutes(t, subtaskId, delta, 'add');
          }),
        };
      }),
    );
  };

  const toggleTaskCalcMode = (projectId: string, taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
            if (t.id !== taskId) return t;
            const nextMode = cycleTimeCalcMode(t.timeCalcMode);
            const updated: Task = { ...t, timeCalcMode: nextMode };
            return {
              ...updated,
              timeSpent: calculateEffectiveTaskTime(updated),
            };
          }),
        };
      }),
    );
  };

  const handleAiSubtaskSlice = async (projectId: string, task: Task) => {
    if (slicingTaskId) return;
    setSlicingTaskId(task.id);
    try {
      const generated = await breakdownSubtasks(task.name);
      if (generated && generated.length > 0) {
        const newSubs: SubTask[] = generated.map(name => ({
          id: crypto.randomUUID(),
          name,
          completed: false,
        }));
        setProjects(prev =>
          (Array.isArray(prev) ? prev : []).map(p =>
            p.id === projectId
              ? {
                  ...p,
                  tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t =>
                    t.id === task.id
                      ? { ...t, subTasks: [...(Array.isArray(t.subTasks) ? t.subTasks : []), ...newSubs] }
                      : t,
                  ),
                }
              : p,
          ),
        );
        setExpandedTasks(prev => new Set(prev).add(task.id));
        if (!activeTaskId && newSubs[0]) {
          setActiveTaskId(newSubs[0].id);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setSlicingTaskId(null);
    }
  };

  const handleAiSlice = async (project: Project) => {
    if (slicingProjectId) return;
    setSlicingProjectId(project.id);
    try {
      const generated = await breakdownProjectTasks(project.name);
      if (generated && generated.length > 0) {
        const newTasks = generated.map(g => ({
          id: crypto.randomUUID(),
          name: g.name,
          completed: false,
          status: 'todo' as const,
          timeSpent: 0,
          targetRounds: g.targetRounds,
          subTasks: [],
        }));
        setProjects(prev =>
          (Array.isArray(prev) ? prev : []).map(p =>
            p.id === project.id ? { ...p, tasks: [...(Array.isArray(p.tasks) ? p.tasks : []), ...newTasks] } : p,
          ),
        );
        if (!activeTaskId && newTasks[0]) {
          setActiveTaskId(newTasks[0].id);
        }
      }
    } catch {
      // Non-blocking
    } finally {
      setSlicingProjectId(null);
    }
  };

  const applyPresetToProject = (projectId: string, preset: SlicePreset) => {
    const newTasks: Task[] = preset.projectTasks.map(t => ({
      id: crypto.randomUUID(),
      name: t.name,
      completed: false,
      status: 'todo' as const,
      timeSpent: 0,
      targetRounds: t.targetRounds,
      subTasks: (t.subTasks || []).map(st => ({
        id: crypto.randomUUID(),
        name: st,
        completed: false,
      })),
    }));

    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p =>
        p.id === projectId
          ? { ...p, tasks: [...(Array.isArray(p.tasks) ? p.tasks : []), ...newTasks] }
          : p,
      ),
    );

    if (newTasks[0] && !activeTaskId) {
      setActiveTaskId(newTasks[0].id);
    }
    setExpandedTasks(prev => {
      const next = new Set(prev);
      newTasks.forEach(t => next.add(t.id));
      return next;
    });
    setPresetPickerForProject(null);
  };

  const applyPresetToTask = (projectId: string, taskId: string, preset: SlicePreset) => {
    const newSubs: SubTask[] = preset.subtaskSteps.map(name => ({
      id: crypto.randomUUID(),
      name,
      completed: false,
    }));

    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p =>
        p.id === projectId
          ? {
              ...p,
              tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t =>
                t.id === taskId
                  ? { ...t, subTasks: [...(Array.isArray(t.subTasks) ? t.subTasks : []), ...newSubs] }
                  : t,
              ),
            }
          : p,
      ),
    );
    setExpandedTasks(prev => new Set(prev).add(taskId));
    if (!activeTaskId && newSubs[0]) {
      setActiveTaskId(newSubs[0].id);
    }
    setPresetPickerForTask(null);
  };

  const createPresetProject = (preset: SlicePreset) => {
    const projectId = crypto.randomUUID();
    const newTasks: Task[] = preset.projectTasks.map(t => ({
      id: crypto.randomUUID(),
      name: t.name,
      completed: false,
      status: 'todo' as const,
      timeSpent: 0,
      targetRounds: t.targetRounds,
      subTasks: (t.subTasks || []).map(st => ({
        id: crypto.randomUUID(),
        name: st,
        completed: false,
      })),
    }));

    const newProject: Project = {
      id: projectId,
      name: `${preset.emoji} ${preset.name}`,
      tasks: newTasks,
      subProjects: [],
      isExpanded: true,
    };

    setProjects(prev => [...(Array.isArray(prev) ? prev : []), newProject]);
    setExpanded(prev => new Set(prev).add(projectId));
    setExpandedTasks(prev => {
      const next = new Set(prev);
      newTasks.forEach(t => next.add(t.id));
      return next;
    });
    if (newTasks[0]) {
      setActiveTaskId(newTasks[0].id);
    }
  };

  const saveTaskRename = (taskId: string) => {
    const name = editTaskName.trim().slice(0, 160);
    if (name) {
      setProjects(prev =>
        (Array.isArray(prev) ? prev : []).map(p => ({
          ...p,
          tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => (t.id === taskId ? { ...t, name } : t)),
        })),
      );
    }
    setEditingTaskId(null);
  };

  const saveProjectRename = (projectId: string) => {
    const name = editProjectName.trim().slice(0, 80);
    if (name) {
      setProjects(prev => (Array.isArray(prev) ? prev : []).map(p => (p.id === projectId ? { ...p, name } : p)));
    }
    setEditingProjectId(null);
  };

  const cycleTargetRounds = (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => ({
        ...p,
        tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
          if (t.id !== taskId) return t;
          const current = t.targetRounds || 4;
          const next = current >= 8 ? 1 : current + 1;
          return { ...t, targetRounds: next };
        }),
      })),
    );
  };

  const updateTaskPomodoroTarget = (projectId: string, taskId: string, rounds: number) => {
    const targetRounds = Math.max(1, Math.min(24, Math.round(rounds)));
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t =>
            t.id === taskId ? { ...t, targetRounds } : t,
          ),
        };
      }),
    );
  };

  const updateTaskPomodoroLength = (projectId: string, taskId: string, minutes: number) => {
    const pomodoroLength = Math.max(1, Math.min(180, Math.round(minutes)));
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t =>
            t.id === taskId ? { ...t, pomodoroLength } : t,
          ),
        };
      }),
    );
  };

  const alignTargetFromSubtasks = (projectId: string, taskId: string) => {
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
            if (t.id !== taskId) return t;
            const pLength = t.pomodoroLength || settings?.focusDuration || 25;
            const estimated = estimatePomodorosFromSubtasks(t.subTasks, pLength);
            return { ...t, targetRounds: estimated };
          }),
        };
      }),
    );
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addProject = () => {
    const name = newProjectName.trim().slice(0, 80);
    if (!name) return;
    const project: Project = { id: crypto.randomUUID(), name, tasks: [], subProjects: [], isExpanded: true };
    setProjects(prev => [...(Array.isArray(prev) ? prev : []), project]);
    setExpanded(prev => new Set(prev).add(project.id));
    setNewProjectName('');
    (document.activeElement as HTMLElement)?.blur?.();
  };

  const addTask = (projectId: string) => {
    const name = newTaskName.trim().slice(0, 160);
    if (!name) return;
    const task: Task = { id: crypto.randomUUID(), name, completed: false, status: 'todo' as const, timeSpent: 0, subTasks: [] };
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p =>
        p.id === projectId ? { ...p, tasks: [...(Array.isArray(p.tasks) ? p.tasks : []), task] } : p,
      ),
    );
    setActiveTaskId(task.id);
    setNewTaskName('');
    setAddingTaskFor(null);
    (document.activeElement as HTMLElement)?.blur?.();
  };

  const toggleTaskDone = (taskId: string) => {
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => ({
        ...p,
        tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
          if (t.id !== taskId) return t;
          const nextCompleted = !t.completed;
          const updatedSubs = (Array.isArray(t.subTasks) ? t.subTasks : []).map(st => ({
            ...st,
            completed: nextCompleted,
          }));
          return {
            ...t,
            completed: nextCompleted,
            status: (nextCompleted ? 'done' : 'todo') as 'todo' | 'done',
            subTasks: updatedSubs,
          };
        }),
      })),
    );
  };

  const deleteTask = (taskId: string) => {
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => ({
        ...p,
        tasks: (Array.isArray(p.tasks) ? p.tasks : []).filter(t => {
          if (t.id === taskId) {
            if (activeTaskId === taskId || (t.subTasks || []).some(st => st.id === activeTaskId)) {
              setActiveTaskId(null);
            }
            return false;
          }
          return true;
        }),
      })),
    );
  };

  const deleteProject = (projectId: string) => {
    const safeProjects = Array.isArray(projects) ? projects : [];
    const p = safeProjects.find(x => x.id === projectId);
    if (!p) return;
    const pTasks = Array.isArray(p.tasks) ? p.tasks : [];
    if (pTasks.length > 0 && confirmDeleteProjectId !== projectId) {
      setConfirmDeleteProjectId(projectId);
      return;
    }
    setConfirmDeleteProjectId(null);
    setProjects(prev => (Array.isArray(prev) ? prev : []).filter(x => x.id !== projectId));
    if (pTasks.some(t => t.id === activeTaskId || (t.subTasks || []).some(st => st.id === activeTaskId))) {
      setActiveTaskId(null);
    }
  };

  const query = searchQuery.trim().toLowerCase();
  const safeProjects = Array.isArray(projects) ? projects : [];
  const visibleProjects = safeProjects
    .map(p => {
      if (!p) return null;
      const tasks = Array.isArray(p.tasks) ? p.tasks : [];
      if (!query) return { ...p, tasks };
      const projectMatches = (p.name || '').toLowerCase().includes(query);
      const matchingTasks = tasks.filter(t => {
        const matchesTask = (t?.name || '').toLowerCase().includes(query);
        const matchesSub = (t?.subTasks || []).some(st => (st?.name || '').toLowerCase().includes(query));
        return matchesTask || matchesSub;
      });
      if (projectMatches) return { ...p, tasks };
      if (matchingTasks.length > 0) return { ...p, tasks: matchingTasks };
      return null;
    })
    .filter((p): p is Project => p !== null);

  return (
    <nav className="k-nav custom-scrollbar" aria-label="Workspace">
      <div className="k-nav-eyebrow">Projects & Tasks</div>

      {projects.length > 2 && (
        <div className="k-sidebar-search" style={{ padding: '0 6px 6px' }}>
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search tasks..."
            aria-label="Search projects and tasks"
            style={{
              width: '100%',
              padding: '4px 8px',
              fontSize: 12,
              borderRadius: 'var(--r-sm)',
              border: '1px solid var(--stone-2)',
              background: 'var(--washi-card)',
              color: 'var(--sumi)',
            }}
          />
        </div>
      )}

      <div className="k-nav-tree">
        {/* Quick Focus default item */}
        <div className={`k-tree-task k-quick-focus-item ${activeTaskId === null ? 'active' : ''}`}>
          <div className="k-quick-focus-indicator" aria-hidden="true" />
          <button
            className="k-tree-task-name"
            onClick={() => setActiveTaskId(null)}
            title="General unassigned focus session"
          >
            <span>Quick Focus</span>
            <small style={{ color: 'var(--sumi-3)', marginLeft: 6, fontSize: 11 }}>Untracked</small>
          </button>
        </div>

        {/* Quick Starter Presets for Study, Learning, Work & Writing */}
        <div className="k-tree-presets-shelf">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
            <span className="k-shelf-label">Quick Presets</span>
            <button
              type="button"
              onClick={() => {
                setDocBreakdownTargetProjectId(null);
                setIsDocBreakdownOpen(true);
              }}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--shu)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '1px 4px',
              }}
              title="Import syllabus, PRD, or topic list for grounded breakdown"
            >
              <span>📄 Doc / Syllabus</span>
            </button>
          </div>
          <div className="k-preset-chips-row">
            {PRESET_LIST.map(preset => (
              <button
                key={preset.id}
                type="button"
                className="k-preset-chip-btn"
                onClick={() => createPresetProject(preset)}
                title={`1-Click create ${preset.name} project with Pomodoro tasks`}
              >
                <span className="k-chip-emoji">{preset.emoji}</span>
                <span className="k-chip-name">
                  {preset.category === 'study'
                    ? 'Study'
                    : preset.category === 'learning'
                    ? 'Learn'
                    : preset.category === 'working'
                    ? 'Work'
                    : 'Write'}
                </span>
              </button>
            ))}
            <button
              type="button"
              className="k-preset-chip-btn k-import-doc-btn"
              onClick={() => {
                setDocBreakdownTargetProjectId(null);
                setIsDocBreakdownOpen(true);
              }}
              title="Import course syllabus, PRD, or topic list for grounded breakdown"
            >
              <span className="k-chip-emoji">📄</span>
              <span className="k-chip-name">Doc / Syllabus</span>
            </button>
          </div>
        </div>

        {visibleProjects.map(project => {
          const tasks = Array.isArray(project.tasks) ? project.tasks : [];
          const isOpen = expanded.has(project.id) || Boolean(query);
          const done = tasks.filter(t => t.completed).length;
          const isDeleting = confirmDeleteProjectId === project.id;
          return (
            <div key={project.id} className="k-tree-project">
              <div className={`k-tree-project-row ${isDeleting ? 'confirming-delete' : ''}`}>
                <button
                  className="k-tree-toggle"
                  onClick={() => toggleExpand(project.id)}
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                  aria-expanded={isOpen}
                >
                  <NavIcon name={isOpen ? 'chevron-down' : 'chevron'} />
                </button>
                {editingProjectId === project.id ? (
                  <input
                    className="k-tree-rename-input"
                    value={editProjectName}
                    onChange={e => setEditProjectName(e.target.value)}
                    onBlur={() => saveProjectRename(project.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveProjectRename(project.id);
                      else if (e.key === 'Escape') setEditingProjectId(null);
                    }}
                    autoFocus
                    maxLength={80}
                  />
                ) : (
                  <button
                    className="k-tree-project-name"
                    onClick={() => toggleExpand(project.id)}
                    onDoubleClick={e => {
                      e.stopPropagation();
                      setEditingProjectId(project.id);
                      setEditProjectName(project.name);
                    }}
                    title={`${project.name} (Double-click to rename)`}
                  >
                    <NavIcon name={isOpen ? 'folder-open' : 'folder'} />
                    <span className="k-nav-label">{project.name}</span>
                    {tasks.length > 0 && (
                      <span className="k-count">
                        {done}/{tasks.length}
                      </span>
                    )}
                  </button>
                )}
                {isDeleting ? (
                  <div className="k-delete-confirm-group">
                    <button
                      className="k-delete-confirm-btn"
                      onClick={() => deleteProject(project.id)}
                      title="Confirm delete"
                    >
                      Delete
                    </button>
                    <button
                      className="k-delete-cancel-btn"
                      onClick={() => setConfirmDeleteProjectId(null)}
                      title="Cancel"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="k-tree-icon-btn"
                    onClick={() => deleteProject(project.id)}
                    aria-label={`Delete ${project.name}`}
                    title="Delete project"
                  >
                    <NavIcon name="trash" />
                  </button>
                )}
              </div>

              {isOpen && (
                <div className="k-tree-tasks">
                  {tasks.map(task => {
                    const target = task.targetRounds || 4;
                    const pomodoroLength = task.pomodoroLength || settings?.focusDuration || 25;
                    const doneRounds = calculateDonePomodoros(task.timeSpent, pomodoroLength);
                    const isTargetMet = doneRounds >= target;
                    const plannedMinutes = calculatePlannedMinutes(target, pomodoroLength);
                    const subTasks = Array.isArray(task.subTasks) ? task.subTasks : [];
                    const hasSubs = subTasks.length > 0;
                    const doneSubs = subTasks.filter(s => s.completed).length;
                    const subtaskTotalEstimated = subTasks.reduce((sum, s) => sum + (s.estimatedMinutes || 0), 0);
                    const isTaskExpanded = expandedTasks.has(task.id);
                    const isSlicing = slicingTaskId === task.id;
                    const isTaskActive = activeTaskId === task.id;
                    const isPomoPopoverOpen = targetPopoverTaskId === task.id;

                    return (
                      <div key={task.id} className="k-tree-task-group">
                        <div
                          className={`k-tree-task ${isTaskActive ? 'active' : ''} ${
                            task.completed ? 'done' : ''
                          }`}
                        >
                          <button
                            className={`k-task-check ${task.completed ? 'checked' : ''}`}
                            onClick={() => toggleTaskDone(task.id)}
                            aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                          >
                            {task.completed && <NavIcon name="check" />}
                          </button>
                          {editingTaskId === task.id ? (
                            <input
                              className="k-tree-rename-input"
                              value={editTaskName}
                              onChange={e => setEditTaskName(e.target.value)}
                              onBlur={() => saveTaskRename(task.id)}
                              onKeyDown={e => {
                                if (e.key === 'Enter') saveTaskRename(task.id);
                                else if (e.key === 'Escape') setEditingTaskId(null);
                              }}
                              autoFocus
                              maxLength={160}
                            />
                          ) : (
                            <button
                              className="k-tree-task-name"
                              onClick={() => {
                                setActiveTaskId(task.id);
                                if (!isSessionActive) {
                                  onStartTaskFocus?.(task.id);
                                }
                              }}
                              onDoubleClick={e => {
                                e.stopPropagation();
                                setEditingTaskId(task.id);
                                setEditTaskName(task.name);
                              }}
                              title={
                                task.timeSpent > 0
                                  ? `${task.name} — ${task.timeSpent} min focused (Click to focus, double-click to rename)`
                                  : `${task.name} (Click to focus, double-click to rename)`
                              }
                            >
                              <span>{task.name}</span>
                              {hasSubs && (
                                <span
                                  className={`k-subtask-pill ${doneSubs === subTasks.length ? 'all-done' : ''}`}
                                  onClick={e => toggleTaskSubtasks(task.id, e)}
                                  title={`${doneSubs}/${subTasks.length} subtasks done. Click to ${isTaskExpanded ? 'collapse' : 'expand'}.`}
                                >
                                  {doneSubs}/{subTasks.length} {isTaskExpanded ? '▾' : '▸'}
                                </span>
                              )}
                              {task.timeSpent > 0 && (
                                <em>
                                  {formatDurationCompact(task.timeSpent)}
                                </em>
                              )}
                            </button>
                          )}
                          <button
                            type="button"
                            className={`k-task-pomo-badge ${isTargetMet ? 'is-complete' : ''}`}
                            onClick={e => {
                              e.stopPropagation();
                              setTargetPopoverTaskId(prev => (prev === task.id ? null : task.id));
                              setPresetPickerForTask(null);
                            }}
                            title={`🎯 Pomodoro Target: ${doneRounds}/${target} completed (${pomodoroLength}m each = ${formatDurationCompact(plannedMinutes)} total). Click to adjust target & session length.`}
                            aria-label={`${doneRounds} of ${target} Pomodoros completed, ${pomodoroLength}m each. Click to customize.`}
                          >
                            <span className="k-pomo-badge-icon">🍅</span>
                            <span className="k-pomo-badge-ratio">{formatPomodoroRatio(doneRounds, target)}</span>
                            <span className="k-pomo-badge-len">{pomodoroLength}m</span>
                          </button>
                          <div className="k-task-actions">
                            <button
                              type="button"
                              className={`k-tree-icon-btn k-task-play-btn ${isTaskActive && isSessionActive ? 'is-running' : ''}`}
                              onClick={e => {
                                e.stopPropagation();
                                if (isTaskActive && isSessionActive) {
                                  onToggleTimer?.();
                                } else {
                                  setActiveTaskId(task.id);
                                  onStartTaskFocus?.(task.id);
                                }
                              }}
                              title={isTaskActive && isSessionActive ? 'Pause focus on this task' : `▶ Start Focus on ${task.name}`}
                              aria-label={isTaskActive && isSessionActive ? 'Pause focus' : `Start focus on ${task.name}`}
                            >
                              {isTaskActive && isSessionActive ? '⏸' : '▶'}
                            </button>
                            <button
                              className="k-tree-icon-btn k-task-add-subtask-btn"
                              onClick={() => {
                                setAddingSubTaskFor(task.id);
                                setExpandedTasks(prev => new Set(prev).add(task.id));
                              }}
                              aria-label={`Add subtask to ${task.name}`}
                              title="Add subtask"
                            >
                              <NavIcon name="plus" />
                            </button>
                            <button
                              className={`k-tree-icon-btn ${isSlicing ? 'spinning' : ''}`}
                              onClick={() => setPresetPickerForTask(prev => prev === task.id ? null : task.id)}
                              aria-label={`Slice ${task.name} into subtasks (Presets or AI)`}
                              title={isSlicing ? 'Slicing subtasks...' : 'Slice into subtasks (Study, Learn, Work, or AI)'}
                              disabled={isSlicing}
                            >
                              ✨
                            </button>
                            <button
                              className="k-tree-icon-btn"
                              onClick={() => deleteTask(task.id)}
                              aria-label={`Delete ${task.name}`}
                              title="Delete task"
                            >
                              <NavIcon name="trash" />
                            </button>
                          </div>
                        </div>

                        {/* Focus To-Do Style Pomodoro Target & Pace Popover */}
                        {isPomoPopoverOpen && (
                          <div className="k-pomo-popover" onClick={e => e.stopPropagation()}>
                            <div className="k-pomo-pop-head">
                              <div className="k-pomo-pop-title">
                                <span className="k-pomo-pop-icon">🍅</span>
                                <b>Pomodoro Target & Pace</b>
                              </div>
                              <button
                                type="button"
                                className="k-pomo-pop-close"
                                onClick={() => setTargetPopoverTaskId(null)}
                                aria-label="Close"
                              >
                                ✕
                              </button>
                            </div>

                            {/* Section 1: Estimated Pomodoros (Target) */}
                            <div className="k-pomo-pop-section">
                              <div className="k-pomo-pop-label-row">
                                <span className="k-pomo-pop-title-sm">Estimated Pomodoros</span>
                                <span className="k-pomo-pop-hint">Target sessions (clean whole numbers)</span>
                              </div>
                              <div className="k-pomo-stepper-wrap">
                                <div className="k-pomo-stepper">
                                  <button
                                    type="button"
                                    className="k-pomo-stepper-btn"
                                    onClick={() => updateTaskPomodoroTarget(project.id, task.id, Math.max(1, target - 1))}
                                    aria-label="Decrease target"
                                  >
                                    −
                                  </button>
                                  <span className="k-pomo-stepper-val">{target}</span>
                                  <button
                                    type="button"
                                    className="k-pomo-stepper-btn"
                                    onClick={() => updateTaskPomodoroTarget(project.id, task.id, Math.min(24, target + 1))}
                                    aria-label="Increase target"
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="k-pomo-quick-chips">
                                  {[1, 2, 3, 4, 5, 6, 8, 10].map(n => (
                                    <button
                                      key={n}
                                      type="button"
                                      className={`k-pomo-chip ${target === n ? 'active' : ''}`}
                                      onClick={() => updateTaskPomodoroTarget(project.id, task.id, n)}
                                    >
                                      {n}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>

                            {/* Section 2: Each Pomodoro Time */}
                            <div className="k-pomo-pop-section">
                              <div className="k-pomo-pop-label-row">
                                <span className="k-pomo-pop-title-sm">Each Pomodoro Time</span>
                                <span className="k-pomo-pop-hint">Focus session duration</span>
                              </div>
                              <div className="k-pomo-time-chips">
                                {[15, 20, 25, 30, 45, 50, 60].map(mins => (
                                  <button
                                    key={mins}
                                    type="button"
                                    className={`k-pomo-chip ${pomodoroLength === mins ? 'active' : ''}`}
                                    onClick={() => updateTaskPomodoroLength(project.id, task.id, mins)}
                                  >
                                    {mins}m {mins === (settings?.focusDuration || 25) ? '★' : ''}
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Section 3: Live Planned Calculation */}
                            <div className="k-pomo-pop-calc">
                              <div className="k-pomo-calc-line">
                                <span className="k-pomo-calc-k">Total Planned:</span>
                                <span className="k-pomo-calc-v">
                                  <b>{target}</b> × <b>{pomodoroLength}m</b> = <b>{formatDurationCompact(plannedMinutes)}</b>
                                </span>
                              </div>
                              <div className="k-pomo-calc-line">
                                <span className="k-pomo-calc-k">Progress:</span>
                                <span className="k-pomo-calc-v">
                                  <b>{doneRounds}</b> of <b>{target}</b> done ({formatDurationCompact(task.timeSpent)} focused)
                                </span>
                              </div>
                            </div>

                            {/* Auto-align from subtasks if subtasks exist */}
                            {hasSubs && (
                              <button
                                type="button"
                                className="k-pomo-auto-subs-btn"
                                onClick={() => alignTargetFromSubtasks(project.id, task.id)}
                                title="Auto-align target based on subtask estimated durations"
                              >
                                <span>⚡ Auto-align target from {subTasks.length} subtasks</span>
                                {subtaskTotalEstimated > 0 && <small>({subtaskTotalEstimated}m total planned)</small>}
                              </button>
                            )}
                          </div>
                        )}

                        {/* Preset Picker Popover for Task */}
                        {presetPickerForTask === task.id && (
                          <div className="k-slice-popover k-slice-popover-task">
                            <div className="k-popover-head">
                              <b>Slice Subtasks</b>
                              <button onClick={() => setPresetPickerForTask(null)} aria-label="Close">✕</button>
                            </div>
                            <div className="k-popover-options">
                              <button
                                type="button"
                                className="k-popover-preset-btn is-ai"
                                onClick={() => {
                                  setPresetPickerForTask(null);
                                  handleAiSubtaskSlice(project.id, task);
                                }}
                              >
                                <span className="k-popover-emoji">✨</span>
                                <div className="k-popover-text">
                                  <b>AI Dynamic Slice</b>
                                  <span>Auto-generate steps via AI engine</span>
                                </div>
                              </button>
                              {PRESET_LIST.map(preset => (
                                <button
                                  key={preset.id}
                                  type="button"
                                  className="k-popover-preset-btn"
                                  onClick={() => applyPresetToTask(project.id, task.id, preset)}
                                >
                                  <span className="k-popover-emoji">{preset.emoji}</span>
                                  <div className="k-popover-text">
                                    <b>{preset.name}</b>
                                    <span>{preset.subtaskSteps.slice(0, 2).join(' · ')}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Nested Subtasks Container */}
                        {(isTaskExpanded || addingSubTaskFor === task.id || hasSubs) && (
                          <div
                            className="k-tree-subtasks"
                            style={{ display: isTaskExpanded || addingSubTaskFor === task.id ? 'flex' : 'none' }}
                          >
                            {hasSubs && (
                              <div className="k-subtasks-header">
                                <span className="k-subtasks-header-title">
                                  Subtasks <span className="k-subtasks-header-ratio">({doneSubs}/{subTasks.length})</span>
                                </span>
                                <button
                                  type="button"
                                  className="k-task-calc-badge"
                                  onClick={e => toggleTaskCalcMode(project.id, task.id, e)}
                                  title={
                                    task.timeCalcMode === 'hybrid'
                                      ? '⚡ Hybrid Mode: Direct time + subtasks sum. Click to switch.'
                                      : task.timeCalcMode === 'direct'
                                      ? '📌 Direct Mode: Standalone parent task time. Click to switch.'
                                      : '🎯 Auto Mode: Total time is calculated as the sum of all subtasks. Click to switch.'
                                  }
                                  aria-label="Toggle time calculation mode (Auto, Hybrid, Direct)"
                                >
                                  {task.timeCalcMode === 'hybrid' ? '⚡ Hybrid' : task.timeCalcMode === 'direct' ? '📌 Direct' : '🎯 Auto Sum'}
                                </button>
                              </div>
                            )}
                            {subTasks.map(st => {
                              const isSubActive = activeTaskId === st.id;
                              return (
                                <div
                                  key={st.id}
                                  className={`k-tree-subtask ${isSubActive ? 'active' : ''} ${
                                    st.completed ? 'done' : ''
                                  }`}
                                >
                                  <button
                                    className={`k-subtask-check ${st.completed ? 'checked' : ''}`}
                                    onClick={() => toggleSubTaskDone(project.id, task.id, st.id)}
                                    aria-label={st.completed ? 'Mark subtask incomplete' : 'Mark subtask complete'}
                                  >
                                    {st.completed && <NavIcon name="check" />}
                                  </button>
                                  {editingSubTaskId === st.id ? (
                                    <input
                                      className="k-tree-rename-input"
                                      value={editSubTaskName}
                                      onChange={e => setEditSubTaskName(e.target.value)}
                                      onBlur={() => saveSubTaskRename(project.id, task.id, st.id)}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') saveSubTaskRename(project.id, task.id, st.id);
                                        else if (e.key === 'Escape') setEditingSubTaskId(null);
                                      }}
                                      autoFocus
                                      maxLength={160}
                                    />
                                  ) : (
                                    <button
                                      className="k-tree-subtask-name"
                                      onClick={() => {
                                        setActiveTaskId(st.id);
                                        if (!isSessionActive) {
                                          onStartTaskFocus?.(st.id);
                                        }
                                      }}
                                      onDoubleClick={e => {
                                        e.stopPropagation();
                                        setEditingSubTaskId(st.id);
                                        setEditSubTaskName(st.name);
                                      }}
                                      title={`${task.name} › ${st.name} (Click to focus, double-click to rename)`}
                                    >
                                      <span>{st.name}</span>
                                      {Boolean(st.timeSpent && st.timeSpent > 0) && (
                                        <span
                                          className="k-subtask-time-chip"
                                          onClick={e => {
                                            e.stopPropagation();
                                            adjustSubtaskTime(project.id, task.id, st.id, 15);
                                          }}
                                          title={`${st.timeSpent}m spent on this subtask. Click to add +15m.`}
                                        >
                                          {formatDurationCompact(st.timeSpent)}
                                        </span>
                                      )}
                                    </button>
                                  )}
                                  <div className="k-subtask-actions">
                                    <button
                                      type="button"
                                      className={`k-tree-icon-btn k-task-play-btn ${activeTaskId === st.id && isSessionActive ? 'is-running' : ''}`}
                                      onClick={e => {
                                        e.stopPropagation();
                                        if (activeTaskId === st.id && isSessionActive) {
                                          onToggleTimer?.();
                                        } else {
                                          setActiveTaskId(st.id);
                                          onStartTaskFocus?.(st.id);
                                        }
                                      }}
                                      title={activeTaskId === st.id && isSessionActive ? 'Pause focus on this subtask' : `▶ Start Focus on ${st.name}`}
                                      aria-label={activeTaskId === st.id && isSessionActive ? 'Pause focus' : `Start focus on ${st.name}`}
                                    >
                                      {activeTaskId === st.id && isSessionActive ? '⏸' : '▶'}
                                    </button>
                                    <button
                                      type="button"
                                      className="k-tree-icon-btn k-subtask-add-time-btn"
                                      onClick={e => {
                                        e.stopPropagation();
                                        adjustSubtaskTime(project.id, task.id, st.id, pomodoroLength);
                                      }}
                                      title={`Add +${pomodoroLength}m (1 Pomodoro) to this subtask`}
                                      aria-label={`Add ${pomodoroLength} minutes to ${st.name}`}
                                    >
                                      +{pomodoroLength}m
                                    </button>
                                    <button
                                      className="k-tree-icon-btn"
                                      onClick={() => deleteSubTask(project.id, task.id, st.id)}
                                      aria-label={`Delete subtask ${st.name}`}
                                      title="Delete subtask"
                                    >
                                      <NavIcon name="trash" />
                                    </button>
                                  </div>
                                </div>
                              );
                            })}

                            {addingSubTaskFor === task.id ? (
                              <div className="k-tree-add-subtask">
                                <input
                                  autoFocus
                                  value={newSubTaskName}
                                  onChange={e => setNewSubTaskName(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') addSubTask(project.id, task.id);
                                    if (e.key === 'Escape') {
                                      setAddingSubTaskFor(null);
                                      setNewSubTaskName('');
                                    }
                                  }}
                                  placeholder="Subtask name (Enter to save, Esc)..."
                                  maxLength={160}
                                />
                              </div>
                            ) : (
                              <button
                                className="k-subtask-add-trigger"
                                onClick={() => {
                                  setAddingSubTaskFor(task.id);
                                  setExpandedTasks(prev => new Set(prev).add(task.id));
                                }}
                              >
                                <NavIcon name="plus" />
                                <span>Add subtask</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {addingTaskFor === project.id ? (
                    <div className="k-tree-add-task">
                      <input
                        autoFocus
                        value={newTaskName}
                        onChange={e => setNewTaskName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') addTask(project.id);
                          if (e.key === 'Escape') {
                            setAddingTaskFor(null);
                            setNewTaskName('');
                          }
                        }}
                        onBlur={() => {
                          if (!newTaskName.trim()) setAddingTaskFor(null);
                        }}
                        placeholder="Task name..."
                        maxLength={160}
                      />
                    </div>
                  ) : (
                    <div className="k-tree-add-actions">
                      <button className="k-tree-add-btn" onClick={() => setAddingTaskFor(project.id)}>
                        <NavIcon name="plus" />
                        <span>Add task</span>
                      </button>
                      <div className="k-slice-btn-group">
                        <button
                          className={`k-tree-ai-slice-btn ${slicingProjectId === project.id ? 'is-loading' : ''}`}
                          onClick={() => handleAiSlice(project)}
                          disabled={slicingProjectId === project.id}
                          title="Auto-slice project into Pomodoro tasks with configured AI (OpenRouter, Ollama, Gemini, or Offline)"
                        >
                          {slicingProjectId === project.id ? (
                            <>
                              <span className="k-ai-spinner" aria-hidden="true" />
                              <span>Slicing...</span>
                            </>
                          ) : (
                            <>
                              <span aria-hidden="true">✨</span>
                              <span>AI Slice</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          className={`k-tree-presets-menu-btn ${presetPickerForProject === project.id ? 'is-open' : ''}`}
                          onClick={() => setPresetPickerForProject(prev => (prev === project.id ? null : project.id))}
                          title="Choose Study, Learning, Work, or Writing breakdown presets"
                        >
                          Presets ▾
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Preset Picker Popover for Project */}
                  {presetPickerForProject === project.id && (
                    <div className="k-slice-popover">
                      <div className="k-popover-head">
                        <b>Choose Breakdown Preset</b>
                        <button onClick={() => setPresetPickerForProject(null)} aria-label="Close presets">✕</button>
                      </div>
                      <div className="k-popover-options">
                        {PRESET_LIST.map(preset => (
                          <button
                            key={preset.id}
                            type="button"
                            className="k-popover-preset-btn"
                            onClick={() => applyPresetToProject(project.id, preset)}
                          >
                            <span className="k-popover-emoji">{preset.emoji}</span>
                            <div className="k-popover-text">
                              <b>{preset.name}</b>
                              <span>{preset.tagline}</span>
                            </div>
                          </button>
                        ))}
                        <button
                          type="button"
                          className="k-popover-preset-btn"
                          style={{ borderTop: '1px solid var(--stone-3)', marginTop: 4, paddingTop: 6 }}
                          onClick={() => {
                            setPresetPickerForProject(null);
                            setDocBreakdownTargetProjectId(project.id);
                            setIsDocBreakdownOpen(true);
                          }}
                        >
                          <span className="k-popover-emoji">📄</span>
                          <div className="k-popover-text">
                            <b>Import Doc or Syllabus...</b>
                            <span>Slice from syllabus PDF, PRD, or topic list</span>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {projects.length === 0 && (
          <p className="k-tree-empty">No projects yet. Add one below to organize your work.</p>
        )}
      </div>

      <div className="k-tree-add-project">
        <input
          value={newProjectName}
          onChange={e => setNewProjectName(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') addProject();
          }}
          placeholder="New project..."
          maxLength={80}
          aria-label="New project name"
        />
        <button onClick={addProject} aria-label="Add project" disabled={!newProjectName.trim()}>
          <NavIcon name="plus" />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 12 }} />

      {onToggleSoundStudio && (
        <button
          className={`k-nav-item ${soundStudioOpen ? 'active' : ''}`}
          onClick={onToggleSoundStudio}
          title="Toggle Sound Studio"
        >
          <NavIcon name="sound" />
          <span className="k-nav-label">Sound Studio</span>
          {soundStudioOpen && <span className="k-badge-dot" />}
        </button>
      )}

      {onTimeCapsule && (
        <button
          className="k-nav-item"
          onClick={onTimeCapsule}
          title="Time Capsule & Future Treat"
        >
          <NavIcon name="mail" />
          <span className="k-nav-label">Future Treat</span>
          {Boolean(capsuleCount && capsuleCount > 0) && (
            <span className="k-badge-dot" title={`${capsuleCount} sealed treat${capsuleCount === 1 ? '' : 's'}`} />
          )}
        </button>
      )}

      {onScience && (
        <button className="k-nav-item" onClick={onScience} title="Focus Science & Pomodoro Guide">
          <NavIcon name="book" />
          <span className="k-nav-label">Focus Guide</span>
        </button>
      )}

      <button className="k-nav-item" onClick={onProgress}>
        <NavIcon name="chart" />
        <span className="k-nav-label">Progress</span>
      </button>

      <button className="k-nav-item" onClick={onSettings}>
        <NavIcon name="settings" />
        <span className="k-nav-label">Settings</span>
      </button>

      {onShortcuts && (
        <button className="k-nav-item" onClick={onShortcuts} title="Keyboard Shortcuts (?)">
          <NavIcon name="keyboard" />
          <span className="k-nav-label">Shortcuts</span>
          <kbd style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontSize: 10, opacity: 0.6, padding: '1px 5px', border: '1px solid var(--stone-3)', borderRadius: 3 }}>?</kbd>
        </button>
      )}

      {isDocBreakdownOpen && (
        <DocumentBreakdownModal
          onClose={() => setIsDocBreakdownOpen(false)}
          onImportPlan={handleImportDocPlan}
          existingProjects={projects}
          defaultProjectId={docBreakdownTargetProjectId}
        />
      )}
    </nav>
  );
};
