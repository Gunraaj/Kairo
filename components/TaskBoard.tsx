import React, { useEffect, useMemo, useState } from 'react';
import type { Project, Task } from '../types';
import { Icon } from './Icon';
import { sanitizeName } from '../data/validation';

interface TaskBoardProps {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
  isSessionActive: boolean;
}

export const TaskBoard: React.FC<TaskBoardProps> = ({ projects, setProjects, activeTaskId, setActiveTaskId, isSessionActive }) => {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id ?? null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newTaskName, setNewTaskName] = useState('');

  useEffect(() => {
    if (!projects.some(project => project.id === selectedProjectId)) {
      setSelectedProjectId(projects[0]?.id ?? null);
    }
  }, [projects, selectedProjectId]);

  const selectedProject = projects.find(project => project.id === selectedProjectId) ?? null;
  const openTasks = selectedProject?.tasks.filter(task => !task.completed) ?? [];
  const doneTasks = selectedProject?.tasks.filter(task => task.completed) ?? [];
  const completedCount = selectedProject?.tasks.filter(task => task.completed).length ?? 0;

  const addProject = () => {
    const name = sanitizeName(newProjectName, 80);
    if (!name) return;
    const project: Project = {
      id: crypto.randomUUID(),
      name,
      tasks: [],
      subProjects: [],
      isExpanded: true,
    };
    setProjects(previous => [...previous, project]);
    setSelectedProjectId(project.id);
    setNewProjectName('');
  };

  const addTask = () => {
    if (isSessionActive) return;
    const name = sanitizeName(newTaskName, 160);
    if (!name || !selectedProject) return;
    const task: Task = {
      id: crypto.randomUUID(),
      name,
      completed: false,
      status: 'todo',
      timeSpent: 0,
    };
    setProjects(previous => previous.map(project =>
      project.id === selectedProject.id ? { ...project, tasks: [...project.tasks, task] } : project
    ));
    setActiveTaskId(task.id);
    setNewTaskName('');
  };

  const toggleTask = (taskId: string) => {
    setProjects(previous => previous.map(project => ({
      ...project,
      tasks: project.tasks.map(task => task.id === taskId
        ? { ...task, completed: !task.completed, status: task.completed ? 'todo' : 'done' }
        : task),
    })));
  };

  const deleteTask = (taskId: string) => {
    if (isSessionActive) return;
    const task = selectedProject?.tasks.find(item => item.id === taskId);
    if (!task || !window.confirm(`Delete "${task.name}"?`)) return;
    setProjects(previous => previous.map(project => ({
      ...project,
      tasks: project.tasks.filter(task => task.id !== taskId),
    })));
    if (activeTaskId === taskId) setActiveTaskId(null);
  };

  const deleteProject = (projectId: string) => {
    if (isSessionActive) return;
    const project = projects.find(item => item.id === projectId);
    if (!project || !window.confirm(`Delete "${project.name}" and its tasks?`)) return;
    setProjects(previous => previous.filter(item => item.id !== projectId));
    if (project.tasks.some(task => task.id === activeTaskId)) setActiveTaskId(null);
  };

  const progress = selectedProject?.tasks.length
    ? Math.round((completedCount / selectedProject.tasks.length) * 100)
    : 0;

  const renderTask = (task: Task) => (
    <div key={task.id} className={`task-row ${activeTaskId === task.id ? 'task-row-active' : ''}`}>
      <button className={`task-check ${task.completed ? 'task-check-done' : ''}`} onClick={() => toggleTask(task.id)} aria-label={task.completed ? 'Mark task incomplete' : 'Mark task complete'}>
        {task.completed && <Icon name="check" className="h-3 w-3" />}
      </button>
      <button className="min-w-0 flex-1 text-left" onClick={() => !isSessionActive && setActiveTaskId(task.id)} disabled={isSessionActive}>
        <span className={`block truncate text-sm font-medium ${task.completed ? 'text-kairo-secondary line-through' : 'text-kairo-primary'}`}>{task.name}</span>
        {task.timeSpent > 0 && <span className="mt-0.5 block text-xs text-kairo-secondary">{task.timeSpent} min focused</span>}
      </button>
      <button onClick={() => deleteTask(task.id)} disabled={isSessionActive} className="row-action" title="Delete task" aria-label="Delete task">
        <Icon name="trash" className="h-4 w-4" />
      </button>
    </div>
  );

  return (
    <div className="task-workspace">
      <header className="workspace-panel-header">
        <div>
          <p className="eyebrow">Projects</p>
          <h2>Your work</h2>
        </div>
        <div className="quick-add project-add">
          <input maxLength={80} value={newProjectName} onChange={event => setNewProjectName(event.target.value)} onKeyDown={event => event.key === 'Enter' && addProject()} placeholder="New project" aria-label="New project name" />
          <button onClick={addProject} aria-label="Add project"><Icon name="plus" className="h-4 w-4" /></button>
        </div>
      </header>

      <div className="project-stack custom-scrollbar">
        {projects.map(project => {
          const done = project.tasks.filter(task => task.completed).length;
          return (
            <div key={project.id} className={`project-item group ${selectedProjectId === project.id ? 'project-item-active' : ''}`}>
      <button onClick={() => !isSessionActive && setSelectedProjectId(project.id)} disabled={isSessionActive} className="min-w-0 flex-1 text-left">
                <span className="block truncate text-sm font-semibold">{project.name}</span>
                <span className="project-count">{done}/{project.tasks.length}</span>
              </button>
              <button onClick={() => deleteProject(project.id)} disabled={isSessionActive} className="row-action" aria-label="Delete project">
                <Icon name="trash" className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
        {projects.length === 0 && <p className="project-empty">No projects yet. Add one above.</p>}
      </div>

      <section className="task-list-panel">
        {selectedProject ? (
          <>
            <header className="task-panel-heading">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="eyebrow">Current project</p>
                  <h2 className="truncate">{selectedProject.name}</h2>
                </div>
                <span className="progress-chip">{progress}%</span>
              </div>
              <div className="progress-track" role="progressbar" aria-label={`${selectedProject.name} completion`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span className={`progress-pct-${progress}`} />
              </div>
            </header>

            <div className="quick-add task-add">
              <input maxLength={160} value={newTaskName} onChange={event => setNewTaskName(event.target.value)} onKeyDown={event => event.key === 'Enter' && addTask()} placeholder="Add a task and press Enter" aria-label="New task name" />
              <button onClick={addTask} aria-label="Add task"><Icon name="plus" className="h-4 w-4" /></button>
            </div>

            <div className="custom-scrollbar mt-5 flex-1 overflow-y-auto pr-1">
              <div className="space-y-2">
                {openTasks.map(renderTask)}
              </div>
              {openTasks.length === 0 && doneTasks.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon"><Icon name="check" className="h-5 w-5" /></div>
                  <p className="font-medium">Start with one small task</p>
                  <p className="mt-1 text-sm text-kairo-secondary">It will be saved automatically.</p>
                </div>
              )}
              {doneTasks.length > 0 && (
                <details className="mt-5" open={openTasks.length === 0}>
                  <summary className="cursor-pointer py-2 text-xs font-semibold uppercase tracking-wider text-kairo-secondary">Completed · {doneTasks.length}</summary>
                  <div className="mt-1 space-y-2">{doneTasks.map(renderTask)}</div>
                </details>
              )}
            </div>
          </>
        ) : (
          <div className="empty-state h-full">
            <div className="empty-icon"><Icon name="folder" className="h-5 w-5" /></div>
            <p className="font-medium">Create your first project</p>
            <p className="mt-1 max-w-xs text-center text-sm text-kairo-secondary">Projects keep related tasks together. No folders inside folders.</p>
          </div>
        )}
      </section>
    </div>
  );
};
