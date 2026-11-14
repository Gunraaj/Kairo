import React, { useState, useEffect } from 'react';
import { gsap } from 'gsap';
import { applyImportedPlan, type ImportedPlan } from '../utils/importPlan';
import type { Project, SubTask, Task, UserSettings } from '../types';
import { DocumentBreakdownModal } from './DocumentBreakdownModal';
import { InfoTip } from './InfoTip';
import { breakdownProjectTasks, breakdownSubtasks } from '../utils/geminiAi';
import {
  calculateDonePomodoros,
  calculateEffectiveTaskTime,
  calculateFinishEstimate,
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
    | 'book'
    | 'sparkles'
    | 'help'
    | 'today';
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
    case 'today':
      return <svg {...shared}><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></svg>;
    case 'help':
      return <svg {...shared}><circle cx="8" cy="8" r="6" /><path d="M6.2 6.3a1.9 1.9 0 013.6.7c0 1.3-1.8 1.4-1.8 2.6M8 11.6v.1" /></svg>;
    case 'sparkles':
      return (
        <svg {...shared}>
          <path d="M8 1.5l1.2 3.3 3.3 1.2-3.3 1.2L8 10.5l-1.2-3.3L3.5 6l3.3-1.2L8 1.5zM12.5 10.5l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6.6-1.7z" />
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
  onToday?: () => void;
  onBridge?: () => void;
  onHelp?: () => void;
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
  onToday,
  onBridge,
  onHelp,
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
  const [isDocBreakdownOpen, setIsDocBreakdownOpen] = useState(false);
  const [slicingProjectId, setSlicingProjectId] = useState<string | null>(null);
  const [slicingTaskId, setSlicingTaskId] = useState<string | null>(null);
  const [docBreakdownTargetProjectId, setDocBreakdownTargetProjectId] = useState<string | null>(null);

  const handleImportDocPlan = (imported: ImportedPlan) => {
    const result = applyImportedPlan(projects, imported);
    setProjects(result.projects);
    if (!imported.targetProjectId) setExpanded(prev => new Set(prev).add(result.projectId));
    if (!imported.targetProjectId && result.firstTaskId) setActiveTaskId(result.firstTaskId);
  };

  const allTasks = React.useMemo(() => {
    const list: Task[] = [];
    if (Array.isArray(projects)) {
      for (const p of projects) {
        if (Array.isArray(p.tasks)) {
          list.push(...p.tasks);
        }
      }
    }
    return list;
  }, [projects]);

  const finishCalc = React.useMemo(() => {
    return calculateFinishEstimate(allTasks, settings);
  }, [allTasks, settings]);

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
                  ? {
                      ...t,
                      completed: false,
                      status: 'todo' as const,
                      subTasks: [...(Array.isArray(t.subTasks) ? t.subTasks : []), subTask],
                    }
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
                  completed: allDone,
                  status: (allDone ? 'done' : 'todo') as 'todo' | 'done',
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
              tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
                if (t.id !== taskId) return t;
                const remainingSubs = (Array.isArray(t.subTasks) ? t.subTasks : []).filter(st => st.id !== subTaskId);
                const allDone = remainingSubs.length > 0 && remainingSubs.every(st => st.completed);
                return {
                  ...t,
                  subTasks: remainingSubs,
                  ...(remainingSubs.length > 0 ? { completed: allDone, status: (allDone ? 'done' : 'todo') as 'todo' | 'done' } : {}),
                };
              }),
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

  const updateSubTaskPomodoroTarget = (projectId: string, taskId: string, subTaskId: string, rounds: number) => {
    const targetRounds = Math.max(1, Math.min(24, Math.round(rounds)));
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
            if (t.id !== taskId) return t;
            const subTasks = (Array.isArray(t.subTasks) ? t.subTasks : []).map(st => {
              if (st.id !== subTaskId) return st;
              const pLen = st.pomodoroLength || t.pomodoroLength || settings?.focusDuration || 25;
              return { ...st, targetRounds, estimatedMinutes: targetRounds * pLen };
            });
            const updatedTask = { ...t, subTasks };
            return {
              ...updatedTask,
              timeSpent: calculateEffectiveTaskTime(updatedTask),
            };
          }),
        };
      }),
    );
  };

  const updateSubTaskPomodoroLength = (projectId: string, taskId: string, subTaskId: string, minutes: number) => {
    const pomodoroLength = Math.max(1, Math.min(180, Math.round(minutes)));
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
            if (t.id !== taskId) return t;
            const subTasks = (Array.isArray(t.subTasks) ? t.subTasks : []).map(st => {
              if (st.id !== subTaskId) return st;
              const rounds = st.targetRounds || 1;
              return { ...st, pomodoroLength, estimatedMinutes: rounds * pomodoroLength };
            });
            return { ...t, subTasks };
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

  const handleAiSliceProject = async (projectId: string, projectName: string) => {
    if (slicingProjectId) return;
    setSlicingProjectId(projectId);
    try {
      const sliced = await breakdownProjectTasks(projectName);
      if (Array.isArray(sliced) && sliced.length > 0) {
        setProjects(prev =>
          (Array.isArray(prev) ? prev : []).map(p => {
            if (p.id !== projectId) return p;
            const currentTasks = Array.isArray(p.tasks) ? p.tasks : [];
            const generatedTasks: Task[] = sliced.map(t => ({
              id: crypto.randomUUID(),
              name: t.name,
              targetRounds: t.targetRounds || 4,
              pomodoroLength: settings?.focusDuration || 25,
              completed: false,
              status: 'todo' as const,
              timeSpent: 0,
              subTasks: [],
            }));
            return {
              ...p,
              tasks: [...currentTasks, ...generatedTasks],
              isExpanded: true,
            };
          }),
        );
        setExpanded(prev => new Set(prev).add(projectId));
      }
    } catch (err) {
      console.error('Failed to AI slice project:', err);
    } finally {
      setSlicingProjectId(null);
    }
  };

  const handleAiSliceTask = async (projectId: string, taskId: string, taskName: string) => {
    if (slicingTaskId) return;
    setSlicingTaskId(taskId);
    try {
      const slicedSubs = await breakdownSubtasks(taskName);
      if (Array.isArray(slicedSubs) && slicedSubs.length > 0) {
        setProjects(prev =>
          (Array.isArray(prev) ? prev : []).map(p => {
            if (p.id !== projectId) return p;
            return {
              ...p,
              tasks: (Array.isArray(p.tasks) ? p.tasks : []).map(t => {
                if (t.id !== taskId) return t;
                const currentSubs = Array.isArray(t.subTasks) ? t.subTasks : [];
                const newSubs: SubTask[] = slicedSubs.map(stName => ({
                  id: crypto.randomUUID(),
                  name: stName,
                  completed: false,
                }));
                return {
                  ...t,
                  subTasks: [...currentSubs, ...newSubs],
                };
              }),
            };
          }),
        );
        setExpandedTasks(prev => new Set(prev).add(taskId));
      }
    } catch (err) {
      console.error('Failed to AI slice task:', err);
    } finally {
      setSlicingTaskId(null);
    }
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
        {/* Pomofocus-style compiled target & finish time summary */}
        {allTasks.length > 0 && (
          <div className="k-pomo-summary-bar" title="Overall Pomodoro target & estimated finish time across all tasks">
            <div className="k-pomo-sum-item">
              <span className="k-pomo-sum-label">Pomos</span>
              <span className="k-pomo-sum-val"><b>{finishCalc.donePomos}</b>/<b>{finishCalc.totalPomos}</b></span>
            </div>
            <div className="k-pomo-sum-divider">•</div>
            <div className="k-pomo-sum-item">
              <span className="k-pomo-sum-label">Finish</span>
              <span className="k-pomo-sum-val"><b>{finishCalc.finishTimeFormatted}</b> <small>({finishCalc.hoursFormatted})</small></span>
            </div>
            <InfoTip title="Estimated Finish Time" position="bottom">
              Calculates total planned focus rounds plus short & long breaks based on your settings.
            </InfoTip>
          </div>
        )}

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
                  <div className="k-project-actions">
                    <button
                      type="button"
                      className={`k-tree-icon-btn k-project-slice-btn ${slicingProjectId === project.id ? 'is-slicing' : ''}`}
                      onClick={e => {
                        e.stopPropagation();
                        handleAiSliceProject(project.id, project.name);
                      }}
                      disabled={Boolean(slicingProjectId)}
                      aria-label={`AI Slice Project: generate tasks for ${project.name}`}
                      title={slicingProjectId === project.id ? 'Generating tasks with AI...' : `✨ AI Slice ${project.name} into tasks`}
                    >
                      <NavIcon name="sparkles" />
                    </button>
                    <button
                      className="k-tree-icon-btn"
                      onClick={() => deleteProject(project.id)}
                      aria-label={`Delete ${project.name}`}
                      title="Delete project"
                    >
                      <NavIcon name="trash" />
                    </button>
                  </div>
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
                            onClick={e => {
                              const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                              if (!prefersReduced) {
                                gsap.fromTo(
                                  e.currentTarget,
                                  { scale: 0.78 },
                                  { scale: 1, duration: 0.26, ease: 'back.out(2.2)' },
                                );
                              }
                              toggleTaskDone(task.id);
                            }}
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
                              type="button"
                              className={`k-tree-icon-btn k-task-ai-slice-btn ${slicingTaskId === task.id ? 'is-slicing' : ''}`}
                              onClick={e => {
                                e.stopPropagation();
                                handleAiSliceTask(project.id, task.id, task.name);
                              }}
                              disabled={Boolean(slicingTaskId)}
                              aria-label={`AI Slice Task: generate subtasks for ${task.name}`}
                              title={slicingTaskId === task.id ? 'Generating subtasks with AI...' : `✨ AI Slice ${task.name} into subtasks`}
                            >
                              <NavIcon name="sparkles" />
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
                        {isPomoPopoverOpen && (() => {
                          const taskFinish = calculateFinishEstimate([task], settings);
                          return (
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

                              <div className="k-pomo-finish-pill-full" title="Estimated completion time based on rounds & breaks">
                                <span>Finish at ~<b>{taskFinish.finishTimeFormatted}</b></span>
                                <small>({taskFinish.hoursFormatted} total)</small>
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

                                {/* Or set by total estimated time (auto-divided by pomodoro duration) */}
                                <div className="k-pomo-time-calc-chips">
                                  <span className="k-pomo-sublabel">Or by total duration:</span>
                                  <div className="k-pomo-quick-chips">
                                    {[
                                      { label: '30m', mins: 30 },
                                      { label: '45m', mins: 45 },
                                      { label: '1h', mins: 60 },
                                      { label: '1.5h', mins: 90 },
                                      { label: '2h', mins: 120 },
                                      { label: '3h', mins: 180 },
                                      { label: '4h', mins: 240 },
                                    ].map(({ label, mins }) => {
                                      const computedRounds = Math.max(1, Math.ceil(mins / pomodoroLength));
                                      const isCurrent = target === computedRounds;
                                      return (
                                        <button
                                          key={label}
                                          type="button"
                                          className={`k-pomo-chip k-chip-duration ${isCurrent ? 'active' : ''}`}
                                          onClick={() => updateTaskPomodoroTarget(project.id, task.id, computedRounds)}
                                          title={`Set ~${mins}m total → ${computedRounds} Pomodoros (${pomodoroLength}m each)`}
                                        >
                                          {label}
                                        </button>
                                      );
                                    })}
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
                        );
                      })()}

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
                              const subPomodoroLength = st.pomodoroLength || task.pomodoroLength || settings?.focusDuration || 25;
                              const taskPomodoroLength = task.pomodoroLength || settings?.focusDuration || 25;
                              const isDifferentPace = subPomodoroLength !== taskPomodoroLength;
                              const subTarget = st.targetRounds || Math.max(1, Math.ceil((st.estimatedMinutes || subPomodoroLength) / subPomodoroLength));
                              const subDoneRounds = calculateDonePomodoros(st.timeSpent || 0, subPomodoroLength);
                              const isSubTargetMet = subDoneRounds >= subTarget;
                              const subPlannedMinutes = calculatePlannedMinutes(subTarget, subPomodoroLength);
                              const isSubPopoverOpen = targetPopoverTaskId === st.id;

                              return (
                                <div key={st.id} className="k-tree-subtask-group">
                                  <div
                                    className={`k-tree-subtask ${isSubActive ? 'active' : ''} ${
                                      st.completed ? 'done' : ''
                                    }`}
                                  >
                                    <button
                                      className={`k-subtask-check ${st.completed ? 'checked' : ''}`}
                                      onClick={e => {
                                        const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
                                        if (!prefersReduced) {
                                          gsap.fromTo(
                                            e.currentTarget,
                                            { scale: 0.78 },
                                            { scale: 1, duration: 0.26, ease: 'back.out(2.2)' },
                                          );
                                        }
                                        toggleSubTaskDone(project.id, task.id, st.id);
                                      }}
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
                                        {Boolean(st.timeSpent && st.timeSpent > 0 && !st.targetRounds) && (
                                          <em>{formatDurationCompact(st.timeSpent || 0)}</em>
                                        )}
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      className={`k-task-pomo-badge k-subtask-pomo-badge ${isSubTargetMet ? 'is-complete' : ''}`}
                                      onClick={e => {
                                        e.stopPropagation();
                                        setTargetPopoverTaskId(prev => (prev === st.id ? null : st.id));
                                      }}
                                      title={`🎯 Subtask Pomodoro Target: ${subDoneRounds}/${subTarget} completed (${subPomodoroLength}m each = ${formatDurationCompact(subPlannedMinutes)} total). Click to adjust target & session length.`}
                                      aria-label={`${subDoneRounds} of ${subTarget} Pomodoros completed on subtask`}
                                    >
                                      <span className="k-pomo-badge-icon">🍅</span>
                                      <span className="k-pomo-badge-ratio">{formatPomodoroRatio(subDoneRounds, subTarget)}</span>
                                      {isDifferentPace && (
                                        <span className="k-pomo-badge-len">{subPomodoroLength}m</span>
                                      )}
                                    </button>

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
                                        className="k-tree-icon-btn"
                                        onClick={() => deleteSubTask(project.id, task.id, st.id)}
                                        aria-label={`Delete subtask ${st.name}`}
                                        title="Delete subtask"
                                      >
                                        <NavIcon name="trash" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Subtask Pomodoro Target Popover */}
                                  {isSubPopoverOpen && (() => {
                                    const subFinish = calculateFinishEstimate([
                                      {
                                        targetRounds: subTarget,
                                        completed: st.completed,
                                        timeSpent: st.timeSpent || 0,
                                        pomodoroLength: subPomodoroLength,
                                      }
                                    ], settings);
                                    return (
                                      <div className="k-pomo-popover k-subtask-popover" onClick={e => e.stopPropagation()}>
                                        <div className="k-pomo-pop-head">
                                          <div className="k-pomo-pop-title">
                                            <span className="k-pomo-pop-icon">🍅</span>
                                            <b>Subtask Target & Pace</b>
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

                                        <div className="k-pomo-finish-pill-full" title="Estimated subtask completion time based on rounds & breaks">
                                          <span>Finish at ~<b>{subFinish.finishTimeFormatted}</b></span>
                                          <small>({subFinish.hoursFormatted} total)</small>
                                        </div>

                                        {/* Section 1: Estimated Pomodoros (Target) */}
                                        <div className="k-pomo-pop-section">
                                          <div className="k-pomo-pop-label-row">
                                            <span className="k-pomo-pop-title-sm">Estimated Pomodoros</span>
                                            <span className="k-pomo-pop-hint">Subtask target (whole numbers)</span>
                                          </div>
                                          <div className="k-pomo-stepper-wrap">
                                            <div className="k-pomo-stepper">
                                              <button
                                                type="button"
                                                className="k-pomo-stepper-btn"
                                                onClick={() => updateSubTaskPomodoroTarget(project.id, task.id, st.id, Math.max(1, subTarget - 1))}
                                                aria-label="Decrease target"
                                              >
                                                −
                                              </button>
                                              <span className="k-pomo-stepper-val">{subTarget}</span>
                                              <button
                                                type="button"
                                                className="k-pomo-stepper-btn"
                                                onClick={() => updateSubTaskPomodoroTarget(project.id, task.id, st.id, Math.min(24, subTarget + 1))}
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
                                                  className={`k-pomo-chip ${subTarget === n ? 'active' : ''}`}
                                                  onClick={() => updateSubTaskPomodoroTarget(project.id, task.id, st.id, n)}
                                                >
                                                  {n}
                                                </button>
                                              ))}
                                            </div>
                                          </div>

                                          {/* Or set by duration */}
                                          <div className="k-pomo-time-calc-chips">
                                            <span className="k-pomo-sublabel">Or by total duration:</span>
                                            <div className="k-pomo-quick-chips">
                                              {[
                                                { label: '15m', mins: 15 },
                                                { label: '30m', mins: 30 },
                                                { label: '45m', mins: 45 },
                                                { label: '1h', mins: 60 },
                                                { label: '1.5h', mins: 90 },
                                                { label: '2h', mins: 120 },
                                              ].map(({ label, mins }) => {
                                                const computedRounds = Math.max(1, Math.ceil(mins / subPomodoroLength));
                                                const isCurrent = subTarget === computedRounds;
                                                return (
                                                  <button
                                                    key={label}
                                                    type="button"
                                                    className={`k-pomo-chip k-chip-duration ${isCurrent ? 'active' : ''}`}
                                                    onClick={() => updateSubTaskPomodoroTarget(project.id, task.id, st.id, computedRounds)}
                                                    title={`Set ~${mins}m total → ${computedRounds} Pomodoros (${subPomodoroLength}m each)`}
                                                  >
                                                    {label}
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Section 2: Each Pomodoro Time */}
                                        <div className="k-pomo-pop-section">
                                          <div className="k-pomo-pop-label-row">
                                            <span className="k-pomo-pop-title-sm">Each Pomodoro Time</span>
                                            <span className="k-pomo-pop-hint">Subtask session length</span>
                                          </div>
                                          <div className="k-pomo-time-chips">
                                            {[15, 20, 25, 30, 45, 50, 60].map(mins => (
                                              <button
                                                key={mins}
                                                type="button"
                                                className={`k-pomo-chip ${subPomodoroLength === mins ? 'active' : ''}`}
                                                onClick={() => updateSubTaskPomodoroLength(project.id, task.id, st.id, mins)}
                                              >
                                                {mins}m {mins === (settings?.focusDuration || 25) ? '★' : ''}
                                              </button>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Section 3: Planned Calculation */}
                                        <div className="k-pomo-pop-calc">
                                          <div className="k-pomo-calc-line">
                                            <span className="k-pomo-calc-k">Subtask Planned:</span>
                                            <span className="k-pomo-calc-v">
                                              <b>{subTarget}</b> × <b>{subPomodoroLength}m</b> = <b>{formatDurationCompact(subPlannedMinutes)}</b>
                                            </span>
                                          </div>
                                          <div className="k-pomo-calc-line">
                                            <span className="k-pomo-calc-k">Progress:</span>
                                            <span className="k-pomo-calc-v">
                                              <b>{subDoneRounds}</b> of <b>{subTarget}</b> done {Boolean(st.timeSpent && st.timeSpent > 0) && `(${st.timeSpent}m focused)`}
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })()}
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

      <button
        className="k-nav-item"
        onClick={() => {
          setDocBreakdownTargetProjectId(null);
          setIsDocBreakdownOpen(true);
        }}
        title="Import Syllabus or Document Outline"
      >
        <NavIcon name="doc" />
        <span className="k-nav-label">Import Syllabus</span>
      </button>

      {onScience && (
        <button className="k-nav-item" onClick={onScience} title="Focus Science & Pomodoro Guide">
          <NavIcon name="book" />
          <span className="k-nav-label">Focus Guide</span>
        </button>
      )}

      {onToday && (
        <button className="k-nav-item" onClick={onToday} title="Today's plan">
          <NavIcon name="today" />
          <span className="k-nav-label">Today</span>
        </button>
      )}

      {onBridge && (
        <button className="k-nav-item" onClick={onBridge} title="Plan with your ChatGPT, Claude or Gemini">
          <NavIcon name="sparkles" />
          <span className="k-nav-label">Use my AI</span>
        </button>
      )}

      {onHelp && (
        <button className="k-nav-item" onClick={onHelp} title="Help & FAQ: AI, Supabase and setup guides">
          <NavIcon name="help" />
          <span className="k-nav-label">Help &amp; FAQ</span>
        </button>
      )}

      <button className="k-nav-item" onClick={onProgress} title="Progress & Focus Analytics">
        <NavIcon name="chart" />
        <span className="k-nav-label">Progress</span>
      </button>

      <button className="k-nav-item" onClick={onSettings} title="Preferences & Settings">
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
