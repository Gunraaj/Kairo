import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { Stage } from './components/Stage';
import { ControlPanel } from './components/ControlPanel';
import { SettingsModal } from './components/SettingsModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { Modal } from './components/Modal';
import type { Project, KairoSession, UserSettings, AudioSettings, FocusTarget } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAudioEngine } from './hooks/useAudioEngine';
import {
  DEFAULT_SETTINGS,
  normalizeActiveTaskId,
  normalizeProjects,
  normalizeSessions,
  normalizeSettings,
} from './data/validation';

const App: React.FC = () => {
  const [projects, setProjects] = useLocalStorage<Project[]>('kairo_projects', [], {
    version: 2,
    normalize: normalizeProjects,
  });
  const [sessions, setSessions] = useLocalStorage<KairoSession[]>('kairo_sessions', [], {
    version: 2,
    normalize: normalizeSessions,
  });
  const [activeTaskId, setActiveTaskId] = useLocalStorage<string | null>('kairo_active_task', null, {
    version: 1,
    normalize: normalizeActiveTaskId,
  });

  const [userSettings, setUserSettings] = useLocalStorage<UserSettings>('kairo_settings', DEFAULT_SETTINGS, {
    version: 2,
    normalize: normalizeSettings,
  });

  const [audioSettings, setAudioSettings] = useState<AudioSettings>({
    isPlaying: false,
    engineEnabled: true,
    mode: 'binaural',
    ambientPreset: 'rain',
    baseFrequency: 200,
    beatFrequency: 14,
    waveType: 'sine',
    noiseType: 'pink',
    binauralVolume: 0.08,
    noiseVolume: 0.12,
    masterVolume: 0.7,
  });

  const [showSettings, setShowSettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const announceToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);
  const [showWelcome, setShowWelcome] = useState(false);
  const [theme, setTheme] = useLocalStorage<'light' | 'dark' | 'system'>(
    'kairo_theme',
    'system',
    { version: 1, normalize: v => (v === 'light' || v === 'dark' ? v : 'system') },
  );

  // Reflect the theme choice onto <html data-theme> so every CSS token flips.
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', theme);
  }, [theme]);

  // First-visit welcome. Uses its own storage key so it never repeats.
  useEffect(() => {
    if (!localStorage.getItem('kairo_seen_welcome')) setShowWelcome(true);
  }, []);
  const dismissWelcome = () => {
    localStorage.setItem('kairo_seen_welcome', '1');
    setShowWelcome(false);
  };
  const [isSessionActive, setIsSessionActive] = useState(false);

  const audioEngine = useAudioEngine(audioSettings);
  const sessionIdsRef = useRef(new Set(sessions.map(session => session.id)));

  useEffect(() => {
    sessionIdsRef.current = new Set(sessions.map(session => session.id));
  }, [sessions]);

  const getActiveTarget = useCallback((items: Project[], id: string | null): FocusTarget | null => {
    if (!id) return null;
    for (const project of items) {
      if (project.id === id) return { id: project.id, name: project.name, kind: 'project' };
      const task = project.tasks.find(candidate => candidate.id === id);
      if (task) return { id: task.id, name: task.name, kind: 'task', completed: task.completed };
      const nested = getActiveTarget(project.subProjects, id);
      if (nested) return nested;
    }
    return null;
  }, []);

  const activeTarget = getActiveTarget(projects, activeTaskId);
  const completedPomodoros = sessions.filter(s => s.type === 'focus' && s.completed).length;
  const totalFocusMinutes = sessions
    .filter(s => s.type === 'focus' && s.completed)
    .reduce((total, s) => total + s.duration, 0);

  const todaySummary = useMemo(() => {
    const focusSessions = sessions.filter(s => s.type === 'focus' && s.completed);
    const dayKey = (value: string | number | Date) => {
      const d = new Date(value);
      return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    };
    const today = dayKey(Date.now());
    const todays = focusSessions.filter(s => dayKey(s.date) === today);
    const days = new Set(focusSessions.map(s => dayKey(s.date)));
    let streak = 0;
    const cursor = new Date();
    if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(dayKey(cursor))) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return {
      minutes: todays.reduce((total, s) => total + s.duration, 0),
      sessions: todays.length,
      streak,
    };
  }, [sessions]);

  useEffect(() => {
    if (!projects.some(project => project.subProjects.length > 0)) return;
    const flatten = (items: Project[], parentName = ''): Project[] => items.flatMap(project => {
      const projectName = parentName ? `${parentName} / ${project.name}` : project.name;
      return [
        { ...project, name: projectName, subProjects: [] },
        ...flatten(project.subProjects, projectName),
      ];
    });
    setProjects(flatten(projects));
  }, [projects, setProjects]);

  const addSession = useCallback((session: KairoSession) => {
    if (sessionIdsRef.current.has(session.id)) return;
    sessionIdsRef.current.add(session.id);
    setSessions(prev => [session, ...prev]);
    if (session.type === 'focus' && session.taskId) {
      const addTime = (items: Project[]): Project[] => items.map(project => ({
        ...project,
        tasks: project.tasks.map(task => task.id === session.taskId
          ? { ...task, timeSpent: task.timeSpent + session.duration }
          : task),
        subProjects: addTime(project.subProjects),
      }));
      setProjects(previous => addTime(previous));
    }
  }, [setProjects, setSessions]);

  const toggleAudio = useCallback((isPlaying: boolean) => {
    if (isPlaying) {
      void audioEngine.resume().catch(() => {
        setAudioSettings(previous => ({ ...previous, isPlaying: false }));
      });
    }
    setAudioSettings(previous => ({ ...previous, isPlaying }));
  }, [audioEngine]);

  return (
    <div className="app-shell" data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}>
      <aside className="k-sidebar" aria-label="Primary">
        <div className="k-sidebar-head">
          <div className="k-brand">
            <span className="k-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                <circle cx="8" cy="8" r="5.5" strokeDasharray="24 7" transform="rotate(-45 8 8)" />
                <circle cx="8" cy="8" r="1.4" fill="currentColor" stroke="none" />
              </svg>
            </span>
            <span className="k-brand-name">Kairo</span>
          </div>
          <div className="k-head-actions">
            <button
              className="k-head-icon"
              onClick={() => setTheme(prev => (prev === 'system' ? 'light' : prev === 'light' ? 'dark' : 'system'))}
              aria-label={`Theme: ${theme}. Click to cycle.`}
              title={`Theme: ${theme}${sidebarCollapsed ? '' : ' — click to cycle'}`}
            >
              {theme === 'dark' ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 9.5A5.5 5.5 0 116.5 3a4.5 4.5 0 006.5 6.5z" />
                </svg>
              ) : theme === 'light' ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="3" />
                  <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="3" width="12" height="8" rx="1" />
                  <path d="M6 13h4M8 11v2" />
                </svg>
              )}
            </button>
            <button
              className="k-head-icon k-collapse"
              onClick={() => setSidebarCollapsed(v => !v)}
              aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              title={sidebarCollapsed ? 'Expand' : 'Collapse'}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                {sidebarCollapsed
                  ? <path d="M5 3l4 4-4 4" />
                  : <path d="M9 3L5 7l4 4" />}
              </svg>
            </button>
          </div>
          <span role="status" aria-live="polite" className="sr-only">Theme: {theme}</span>
        </div>

        <SidebarNav
          projects={projects}
          setProjects={setProjects}
          activeTaskId={activeTaskId}
          setActiveTaskId={setActiveTaskId}
          onProgress={() => setShowAnalytics(true)}
          onSettings={() => setShowSettings(true)}
        />
        {/* legacy modals removed -- Progress and Settings still overlay */}
      </aside>

      <main className="k-main">
        <section className="k-stage" id="focus-workspace">
          <Stage
            settings={userSettings}
            setSettings={setUserSettings}
            addSession={addSession}
            activeTarget={activeTarget}
            toggleAudio={toggleAudio}
            playCompletionCue={audioEngine.playCue}
            totalPomodoros={completedPomodoros}
            totalFocusMinutes={totalFocusMinutes}
            todaySummary={todaySummary}
            onActiveChange={setIsSessionActive}
          />
        </section>

        <aside className="k-sound-lib" aria-label="Sound library">
          <ControlPanel
            audioSettings={audioSettings}
            setAudioSettings={setAudioSettings}
            resumeAudio={audioEngine.resume}
            audioError={audioEngine.error}
          />
        </aside>

      </main>

      {showWelcome && <WelcomeModal onClose={dismissWelcome} />}

      {showSettings && (
        <SettingsModal
          settings={userSettings}
          setSettings={setUserSettings}
          onClose={() => setShowSettings(false)}
          onToast={announceToast}
        />
      )}

      {toast && (
        <div className="k-toast" role="status" aria-live="polite">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l3.5 3.5L13 5" />
          </svg>
          <span>{toast}</span>
        </div>
      )}
      {showAnalytics && (
        <AnalyticsModal
          sessions={sessions}
          onClose={() => setShowAnalytics(false)}
        />
      )}
    </div>
  );
};

/* Small SVG icon set for the sidebar -- Sumi-thin strokes, no library. */
const NavIcon: React.FC<{ name: 'folder' | 'folder-open' | 'doc' | 'plus' | 'chart' | 'settings' | 'archive' | 'chevron' | 'chevron-down' | 'trash' | 'check' | 'sun' | 'moon' | 'system' }> = ({ name }) => {
  const shared = { className: 'k-nav-icon', width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'folder':      return <svg {...shared}><path d="M2 4a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1V12a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" /></svg>;
    case 'folder-open': return <svg {...shared}><path d="M2 4a1 1 0 011-1h3l1.5 1.5H13a1 1 0 011 1v1H2z" /><path d="M2 6.5h12l-1.5 5.7a1 1 0 01-1 .8H3a1 1 0 01-1-1z" /></svg>;
    case 'doc':         return <svg {...shared}><path d="M4 2h5l3 3v9a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M9 2v3h3" /></svg>;
    case 'plus':        return <svg {...shared}><path d="M8 3v10M3 8h10" /></svg>;
    case 'chart':       return <svg {...shared}><path d="M3 13V6M7 13V3M11 13V9" /></svg>;
    case 'settings':    return <svg {...shared}><circle cx="8" cy="8" r="2.2" /><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" /></svg>;
    case 'archive':     return <svg {...shared}><rect x="2" y="3" width="12" height="3" rx="0.5" /><path d="M3 6v7a1 1 0 001 1h8a1 1 0 001-1V6M6.5 9h3" /></svg>;
    case 'chevron':     return <svg {...shared}><path d="M6 4l4 4-4 4" /></svg>;
    case 'chevron-down':return <svg {...shared}><path d="M4 6l4 4 4-4" /></svg>;
    case 'trash':       return <svg {...shared}><path d="M3 4h10M6 4V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5V4M4.5 4l.6 8.5a1 1 0 001 .9h3.8a1 1 0 001-.9L11.5 4" /></svg>;
    case 'check':       return <svg {...shared}><path d="M3 8l3 3 7-7" /></svg>;
    case 'sun':         return <svg {...shared}><circle cx="8" cy="8" r="3" /><path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" /></svg>;
    case 'moon':        return <svg {...shared}><path d="M13 9.5A5.5 5.5 0 116.5 3a4.5 4.5 0 006.5 6.5z" /></svg>;
    case 'system':      return <svg {...shared}><rect x="2" y="3" width="12" height="8" rx="1" /><path d="M6 13h4M8 11v2" /></svg>;
  }
};

/* Folder-tree sidebar navigation: projects expand to show their tasks,
   clicking a task sets it as the focus target, add/delete inline. */
type SidebarNavProps = {
  projects: Project[];
  setProjects: React.Dispatch<React.SetStateAction<Project[]>>;
  activeTaskId: string | null;
  setActiveTaskId: (id: string | null) => void;
  onProgress: () => void;
  onSettings: () => void;
};

const SidebarNav: React.FC<SidebarNavProps> = ({ projects, setProjects, activeTaskId, setActiveTaskId, onProgress, onSettings }) => {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(projects.map(p => p.id)));
  const [newProjectName, setNewProjectName] = useState('');
  const [addingTaskFor, setAddingTaskFor] = useState<string | null>(null);
  const [newTaskName, setNewTaskName] = useState('');

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addProject = () => {
    const name = newProjectName.trim().slice(0, 80);
    if (!name) return;
    const project: Project = { id: crypto.randomUUID(), name, tasks: [], subProjects: [], isExpanded: true };
    setProjects(prev => [...prev, project]);
    setExpanded(prev => new Set(prev).add(project.id));
    setNewProjectName('');
  };

  const addTask = (projectId: string) => {
    const name = newTaskName.trim().slice(0, 160);
    if (!name) return;
    const task = { id: crypto.randomUUID(), name, completed: false, status: 'todo' as const, timeSpent: 0 };
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, tasks: [...p.tasks, task] } : p));
    setActiveTaskId(task.id);
    setNewTaskName('');
    setAddingTaskFor(null);
  };

  const toggleTaskDone = (taskId: string) => {
    setProjects(prev => prev.map(p => ({
      ...p,
      tasks: p.tasks.map(t => t.id === taskId ? { ...t, completed: !t.completed, status: (t.completed ? 'todo' : 'done') as 'todo' | 'done' } : t),
    })));
  };

  const deleteTask = (taskId: string) => {
    setProjects(prev => prev.map(p => ({ ...p, tasks: p.tasks.filter(t => t.id !== taskId) })));
    if (activeTaskId === taskId) setActiveTaskId(null);
  };

  const deleteProject = (projectId: string) => {
    const p = projects.find(x => x.id === projectId);
    if (!p) return;
    if (p.tasks.length > 0 && !window.confirm(`Delete "${p.name}" and its ${p.tasks.length} task${p.tasks.length === 1 ? '' : 's'}?`)) return;
    setProjects(prev => prev.filter(x => x.id !== projectId));
    if (p.tasks.some(t => t.id === activeTaskId)) setActiveTaskId(null);
  };

  return (
    <nav className="k-nav custom-scrollbar" aria-label="Workspace">
      <div className="k-nav-eyebrow">Workspace</div>

      <div className="k-nav-tree">
        {projects.map(project => {
          const isOpen = expanded.has(project.id);
          const done = project.tasks.filter(t => t.completed).length;
          return (
            <div key={project.id} className="k-tree-project">
              <div className="k-tree-project-row">
                <button
                  className="k-tree-toggle"
                  onClick={() => toggleExpand(project.id)}
                  aria-label={isOpen ? 'Collapse' : 'Expand'}
                  aria-expanded={isOpen}
                >
                  <NavIcon name={isOpen ? 'chevron-down' : 'chevron'} />
                </button>
                <button
                  className="k-tree-project-name"
                  onClick={() => toggleExpand(project.id)}
                  title={project.name}
                >
                  <NavIcon name={isOpen ? 'folder-open' : 'folder'} />
                  <span className="k-nav-label">{project.name}</span>
                  {project.tasks.length > 0 && (
                    <span className="k-count">{done}/{project.tasks.length}</span>
                  )}
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

              {isOpen && (
                <div className="k-tree-tasks">
                  {project.tasks.map(task => (
                    <div
                      key={task.id}
                      className={`k-tree-task ${activeTaskId === task.id ? 'active' : ''} ${task.completed ? 'done' : ''}`}
                    >
                      <button
                        className={`k-task-check ${task.completed ? 'checked' : ''}`}
                        onClick={() => toggleTaskDone(task.id)}
                        aria-label={task.completed ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {task.completed && <NavIcon name="check" />}
                      </button>
                      <button
                        className="k-tree-task-name"
                        onClick={() => setActiveTaskId(task.id)}
                        title={task.timeSpent > 0 ? `${task.name} — ${task.timeSpent} min focused` : task.name}
                      >
                        <span>{task.name}</span>
                        {task.timeSpent > 0 && (
                          <em>
                            {task.timeSpent >= 60
                              ? `${Math.floor(task.timeSpent / 60)}h`
                              : `${task.timeSpent}m`}
                          </em>
                        )}
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
                  ))}

                  {addingTaskFor === project.id ? (
                    <div className="k-tree-add-task">
                      <input
                        autoFocus
                        value={newTaskName}
                        onChange={e => setNewTaskName(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') addTask(project.id);
                          if (e.key === 'Escape') { setAddingTaskFor(null); setNewTaskName(''); }
                        }}
                        onBlur={() => { if (!newTaskName.trim()) setAddingTaskFor(null); }}
                        placeholder="Task name"
                        maxLength={160}
                      />
                    </div>
                  ) : (
                    <button
                      className="k-tree-add-btn"
                      onClick={() => setAddingTaskFor(project.id)}
                    >
                      <NavIcon name="plus" />
                      <span>Add task</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {projects.length === 0 && (
          <p className="k-tree-empty">No projects yet.</p>
        )}
      </div>

      <div className="k-tree-add-project">
        <input
          value={newProjectName}
          onChange={e => setNewProjectName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addProject(); }}
          placeholder="New project"
          maxLength={80}
          aria-label="New project name"
        />
        <button onClick={addProject} aria-label="Add project" disabled={!newProjectName.trim()}>
          <NavIcon name="plus" />
        </button>
      </div>

      <div style={{ flex: 1, minHeight: 12 }} />

      <button className="k-nav-item" onClick={onProgress}>
        <NavIcon name="chart" />
        <span className="k-nav-label">Progress</span>
      </button>
      <button className="k-nav-item" onClick={onSettings}>
        <NavIcon name="settings" />
        <span className="k-nav-label">Settings</span>
      </button>
    </nav>
  );
};

/* First-run welcome. Explains the four moves that unlock the app:
   add a project, pick a task, start focus, tune sound. Shows once. */
const WelcomeModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <Modal titleId="welcome-title" onClose={onClose} className="welcome-dialog">
    <>
      <header className="k-modal-header">
        <div>
          <h2 id="welcome-title">Welcome to Kairo</h2>
          <p className="k-modal-sub">Make space for one thing.</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Dismiss welcome">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>
      <div className="k-modal-body">
        {(() => {
          const steps: Array<[string, React.ReactNode]> = [
            ['Add a project', 'Type its name in the sidebar and press Enter. Everything you focus on lives inside a project.'],
            ['Pick one task', 'Expand a project and click a task. That is the one thing your next session belongs to.'],
            ['Start focus', <>Drag the dial for any duration up to 60 minutes, then press Space or the red button. <kbd>S</kbd> skip · <kbd>R</kbd> reset · <kbd>E</kbd> extend +5m.</>],
            ['Choose an atmosphere', 'The Sound Library on the right layers ambient sounds, binaural beats, or a lofi stream. Master volume governs everything.'],
          ];
          return (
            <ol className="k-welcome-list">
              {steps.map(([title, body], i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 * i + 0.15, duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
                >
                  <b>{title}</b>
                  <span>{body}</span>
                </motion.li>
              ))}
            </ol>
          );
        })()}
        <p className="k-welcome-note">
          Every completed session banks minutes to its task and fills a square in your yearly focus map (in Progress). Nothing leaves your browser — Kairo is fully local.
        </p>
      </div>
      <footer className="k-modal-footer">
        <button className="k-btn k-btn-primary" onClick={onClose}>Start focusing</button>
      </footer>
    </>
  </Modal>
);

export default App;
