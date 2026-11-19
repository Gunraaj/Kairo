import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { PlanPopover } from './PlanPopover';
import { NavIcon } from './NavIcon';
import type { Project, SubTask, Task, UserSettings } from '../types';
import { breakdownProjectTasks, breakdownSubtasks } from '../utils/geminiAi';
import {
  calculateDonePomodoros,
  snapSessions,
  calculateEffectiveTaskTime,
  calculateFinishEstimate,
  calculatePlannedMinutes,
  estimatePomodorosFromSubtasks,
  formatDurationCompact,
  formatPomodoroRatio,
} from '../utils/subtaskTime';

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
  onFocus?: () => void;
  currentView?: 'today' | 'focus';
  onNewPlan?: () => void;
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
  onFocus,
  currentView,
  onNewPlan,
  onHelp,
  isSessionActive,
  onStartTaskFocus,
  onToggleTimer,
}) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const list = Array.isArray(projects) ? projects : [];
    const active = list.find(p => p.tasks?.some(t => t.id === activeTaskId || t.subTasks?.some(st => st.id === activeTaskId)));
    return new Set(active ? [active.id] : list.slice(0, 1).map(p => p.id));
  });
  const seenProjectIds = useRef(new Set((Array.isArray(projects) ? projects : []).map(p => p.id)));

  useEffect(() => {
    if (Array.isArray(projects) && projects.length > 0) {
      setExpanded(prev => {
        const next = new Set(prev);
        for (const p of projects) {
          if (!seenProjectIds.current.has(p.id)) {
            seenProjectIds.current.add(p.id);
            next.add(p.id);
          }
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
  const [slicingProjectId, setSlicingProjectId] = useState<string | null>(null);
  const [slicingTaskId, setSlicingTaskId] = useState<string | null>(null);



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

  const updateTaskPomodoroTarget = (projectId: string, taskId: string, rounds: number) => {
    const targetRounds = Math.min(24, snapSessions(rounds));
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
    const targetRounds = Math.min(24, snapSessions(rounds));
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

  /** Copies a task right below the original, with fresh ids and progress reset. */
  const duplicateTask = (projectId: string, taskId: string) => {
    const copyId = crypto.randomUUID();
    setProjects(prev =>
      (Array.isArray(prev) ? prev : []).map(p => {
        if (p.id !== projectId) return p;
        const tasks = Array.isArray(p.tasks) ? p.tasks : [];
        const index = tasks.findIndex(t => t.id === taskId);
        if (index < 0) return p;
        const source = tasks[index];
        const copy: Task = {
          ...source,
          id: copyId,
          name: `${source.name} (copy)`.slice(0, 160),
          completed: false,
          status: 'todo',
          timeSpent: 0,
          directTimeSpent: 0,
          subTasks: (Array.isArray(source.subTasks) ? source.subTasks : []).map(st => ({ ...st, id: crypto.randomUUID(), completed: false, timeSpent: 0 })),
        };
        return { ...p, tasks: [...tasks.slice(0, index + 1), copy, ...tasks.slice(index + 1)] };
      }),
    );
    if (expandedTasks.has(taskId)) setExpandedTasks(prev => new Set(prev).add(copyId));
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
    <nav className="k-nav" aria-label="Workspace">
      <div className="k-nav-primary">
        {onToday && (
          <button className={`k-nav-item ${currentView === 'today' ? 'active' : ''}`} onClick={onToday} aria-current={currentView === 'today' ? 'page' : undefined}>
            <NavIcon name="today" />
            <span className="k-nav-label">Today</span>
          </button>
        )}
        {onFocus && (
          <button className={`k-nav-item ${currentView === 'focus' ? 'active' : ''}`} onClick={onFocus} aria-current={currentView === 'focus' ? 'page' : undefined}>
            <NavIcon name="timer" />
            <span className="k-nav-label">Focus</span>
          </button>
        )}
        {onNewPlan && (
          <button className="k-nav-item" onClick={onNewPlan} title="Plan an exam or project: a few questions, then a day-by-day plan">
            <NavIcon name="sparkles" />
            <span className="k-nav-label">New plan</span>
          </button>
        )}
        <button className="k-nav-item" onClick={onProgress}>
          <NavIcon name="chart" />
          <span className="k-nav-label">Progress</span>
        </button>
      </div>

      <div className="k-nav-scroll custom-scrollbar">
      <div className="k-nav-eyebrow">Projects</div>

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
              fontSize: 'calc(14px * var(--text-scale, 1))',
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
        {/* Quick Focus default item */}
        <div className={`k-tree-task k-quick-focus-item ${activeTaskId === null ? 'active' : ''}`}>
          <div className="k-quick-focus-indicator" aria-hidden="true" />
          <button
            className="k-tree-task-name"
            onClick={() => setActiveTaskId(null)}
            title="General unassigned focus session"
          >
            <span>Focus without a task</span>
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
                    const doneRounds = calculateDonePomodoros(task.timeSpent, pomodoroLength, target);
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
                              <span className="k-tree-task-text">{task.name}</span>
                            </button>
                          )}
                          <div className="k-task-meta">
                          {hasSubs && (
                            <button
                              type="button"
                              className={`k-subtask-pill ${doneSubs === subTasks.length ? 'all-done' : ''}`}
                              onClick={e => toggleTaskSubtasks(task.id, e)}
                              aria-expanded={isTaskExpanded}
                              title={`${doneSubs} of ${subTasks.length} subtasks done. Click to ${isTaskExpanded ? 'hide' : 'show'} them.`}
                            >
                              {isTaskExpanded ? '▾' : '▸'} {doneSubs}/{subTasks.length} subtasks
                            </button>
                          )}
                          {task.timeSpent > 0 && (
                            <em className="k-task-time" title="Time focused on this task">
                              {formatDurationCompact(task.timeSpent)}
                            </em>
                          )}
                          <button
                            type="button"
                            className={`k-task-pomo-badge ${isTargetMet ? 'is-complete' : ''}`}
                            onClick={e => {
                              e.stopPropagation();
                              setTargetPopoverTaskId(prev => (prev === task.id ? null : task.id));
                            }}
                            title={`${doneRounds} of ${target} sessions done (${pomodoroLength} min each, ${formatDurationCompact(plannedMinutes)} planned). Click to change.`}
                            aria-label={`${doneRounds} of ${target} sessions done, ${pomodoroLength} minutes each. Click to change.`}
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
                              type="button"
                              className="k-tree-icon-btn"
                              onClick={e => { e.stopPropagation(); duplicateTask(project.id, task.id); }}
                              aria-label={`Duplicate ${task.name}`}
                              title="Duplicate task"
                            >
                              <NavIcon name="copy" />
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
                        </div>

                        {isPomoPopoverOpen && (
                          <PlanPopover
                            kind="task"
                            target={target}
                            length={pomodoroLength}
                            doneRounds={doneRounds}
                            focusedMinutes={task.timeSpent || 0}
                            defaultLength={settings?.focusDuration || 25}
                            finish={calculateFinishEstimate([task], settings)}
                            totalChips={[30, 45, 60, 90, 120, 180, 240]}
                            onTarget={n => updateTaskPomodoroTarget(project.id, task.id, n)}
                            onLength={m => updateTaskPomodoroLength(project.id, task.id, m)}
                            onClose={() => setTargetPopoverTaskId(null)}
                            align={hasSubs ? { count: subTasks.length, estimated: subtaskTotalEstimated, onAlign: () => alignTargetFromSubtasks(project.id, task.id) } : undefined}
                          />
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
                              </div>
                            )}
                            {subTasks.map(st => {
                              const isSubActive = activeTaskId === st.id;
                              const subPomodoroLength = st.pomodoroLength || task.pomodoroLength || settings?.focusDuration || 25;
                              const taskPomodoroLength = task.pomodoroLength || settings?.focusDuration || 25;
                              const isDifferentPace = subPomodoroLength !== taskPomodoroLength;
                              const subTarget = st.targetRounds || Math.max(1, Math.ceil((st.estimatedMinutes || subPomodoroLength) / subPomodoroLength));
                              const subDoneRounds = calculateDonePomodoros(st.timeSpent || 0, subPomodoroLength, subTarget);
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
                                      className={`k-task-pomo-badge k-subtask-pomo-badge ${isSubTargetMet ? 'is-complete' : ''} ${(st.timeSpent || 0) > 0 || st.targetRounds || isSubPopoverOpen ? '' : 'is-quiet'}`}
                                      onClick={e => {
                                        e.stopPropagation();
                                        setTargetPopoverTaskId(prev => (prev === st.id ? null : st.id));
                                      }}
                                      title={`${subDoneRounds} of ${subTarget} sessions done (${subPomodoroLength} min each, ${formatDurationCompact(subPlannedMinutes)} planned). Click to change.`}
                                      aria-label={`${subDoneRounds} of ${subTarget} sessions done on this subtask`}
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

                                  {isSubPopoverOpen && (
                                    <PlanPopover
                                      kind="subtask"
                                      target={subTarget}
                                      length={subPomodoroLength}
                                      doneRounds={subDoneRounds}
                                      focusedMinutes={st.timeSpent || 0}
                                      defaultLength={settings?.focusDuration || 25}
                                      finish={calculateFinishEstimate([
                                        { targetRounds: subTarget, completed: st.completed, timeSpent: st.timeSpent || 0, pomodoroLength: subPomodoroLength },
                                      ], settings)}
                                      totalChips={[15, 30, 45, 60, 90, 120]}
                                      onTarget={n => updateSubTaskPomodoroTarget(project.id, task.id, st.id, n)}
                                      onLength={m => updateSubTaskPomodoroLength(project.id, task.id, st.id, m)}
                                      onClose={() => setTargetPopoverTaskId(null)}
                                    />
                                  )}
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

    </div>

      <div className="k-nav-footer" role="group" aria-label="Tools">
        {onToggleSoundStudio && (
          <button type="button" className={`k-nav-tool ${soundStudioOpen ? 'active' : ''}`} onClick={onToggleSoundStudio} title="Sound Studio" aria-label="Sound Studio">
            <NavIcon name="sound" />
            {soundStudioOpen && <span className="k-badge-dot" />}
          </button>
        )}
        {onTimeCapsule && (
          <button type="button" className="k-nav-tool" onClick={onTimeCapsule} title="Time Capsule and Future Treat" aria-label="Time Capsule and Future Treat">
            <NavIcon name="mail" />
            {Boolean(capsuleCount && capsuleCount > 0) && <span className="k-badge-dot" />}
          </button>
        )}
        {onScience && (
          <button type="button" className="k-nav-tool" onClick={onScience} title="Focus Guide" aria-label="Focus Guide">
            <NavIcon name="book" />
          </button>
        )}
        {onHelp && (
          <button type="button" className="k-nav-tool" onClick={onHelp} title="Help and FAQ" aria-label="Help and FAQ">
            <NavIcon name="help" />
          </button>
        )}
        <button type="button" className="k-nav-tool" onClick={onSettings} title="Settings" aria-label="Settings">
          <NavIcon name="settings" />
        </button>
        {onShortcuts && (
          <button type="button" className="k-nav-tool" onClick={onShortcuts} title="Keyboard shortcuts (?)" aria-label="Keyboard shortcuts">
            <NavIcon name="keyboard" />
          </button>
        )}
      </div>

    </nav>
  );
};
