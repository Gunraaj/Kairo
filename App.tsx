import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { motion } from 'motion/react';
import { Stage } from './components/Stage';
import { ControlPanel } from './components/ControlPanel';
import { SettingsModal } from './components/SettingsModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { Modal } from './components/Modal';
import { SidebarNav } from './components/SidebarNav';
import { TimeCapsuleModal } from './components/TimeCapsuleModal';
import { PomodoroScienceModal } from './components/PomodoroScienceModal';
import { BrandLogo, getLogoSvgDataUri, type LogoVariant } from './components/BrandLogo';
import type { Project, Task, KairoSession, UserSettings, AudioSettings, FocusTarget, TimeCapsule } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAudioEngine } from './hooks/useAudioEngine';
import { checkUnlockableCapsules } from './utils/timeCapsule';
import { calculateEffectiveTaskTime, updateSubtaskMinutes } from './utils/subtaskTime';
import {
  DEFAULT_SETTINGS,
  normalizeActiveTaskId,
  normalizeProjects,
  normalizeSessions,
  normalizeSettings,
} from './data/validation';

const normalizeCapsules = (value: unknown): TimeCapsule[] => {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is TimeCapsule =>
      Boolean(item) &&
      typeof item === 'object' &&
      typeof (item as TimeCapsule).id === 'string' &&
      typeof (item as TimeCapsule).message === 'string',
  );
};

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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showScience, setShowScience] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('guide') === '1' || params.get('science') === '1';
    }
    return false;
  });
  const [showCapsuleModal, setShowCapsuleModal] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('capsule') === '1';
    }
    return false;
  });
  const [activeUnsealedCapsule, setActiveUnsealedCapsule] = useState<TimeCapsule | null>(null);
  const [capsules, setCapsules] = useLocalStorage<TimeCapsule[]>('kairo_time_capsules', [], {
    version: 1,
    normalize: normalizeCapsules,
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 260;
    try {
      const saved = localStorage.getItem('kairo_sidebar_width');
      if (!saved) return 260;
      const num = Number(saved);
      return Number.isFinite(num) ? Math.max(180, Math.min(480, num)) : 240;
    } catch {
      return 260;
    }
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const startResizingSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    const startX = e.clientX;
    const startW = sidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const nextW = Math.max(180, Math.min(480, startW + (moveEvent.clientX - startX)));
      setSidebarWidth(nextW);
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  const resetSidebarWidth = useCallback(() => {
    setSidebarWidth(260);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('kairo_sidebar_width', String(sidebarWidth));
    } catch {
      // Ignore quota
    }
  }, [sidebarWidth]);
  const [soundStudioOpen, setSoundStudioOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('sound') === '1';
    }
    return false;
  });
  const [toast, setToast] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const announceToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToast(null), 2600);
  }, []);

  const [showWelcome, setShowWelcome] = useState(false);
  const [zenMode, setZenMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('zen') === '1';
    }
    return false;
  });
  const [theme, setTheme] = useLocalStorage<'light' | 'dark'>(
    'kairo_theme',
    'dark',
    { version: 1, normalize: v => (v === 'light' ? 'light' : 'dark') },
  );
  const [palette, setPalette] = useLocalStorage<'obsidian' | 'zen' | 'indigo' | 'washi'>(
    'kairo_palette',
    'obsidian',
    {
      version: 1,
      normalize: v =>
        typeof v === 'string' && ['obsidian', 'zen', 'indigo', 'washi'].includes(v)
          ? (v as 'obsidian' | 'zen' | 'indigo' | 'washi')
          : 'obsidian',
    },
  );
  const [logoVariant, setLogoVariant] = useLocalStorage<LogoVariant>(
    'kairo_logo_variant',
    'interval',
    {
      version: 1,
      // The old gallery was exploratory; the interval mark is now Kairo's
      // canonical identity. Normalize legacy saved choices without touching
      // any product data or settings outside this key.
      normalize: () => 'interval',
    },
  );

  // Update browser tab favicon dynamically based on selected logo variant
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.type = 'image/svg+xml';
    link.href = getLogoSvgDataUri(logoVariant);
  }, [logoVariant]);

  const toggleZenMode = useCallback(() => {
    setZenMode(v => {
      const next = !v;
      if (typeof document !== 'undefined') {
        if (next && !document.fullscreenElement) {
          document.documentElement.requestFullscreen().catch(() => {});
        } else if (!next && document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement && zenMode) {
        setZenMode(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, [zenMode]);

  // Global key listener for shortcuts and Zen mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement)?.isContentEditable) return;
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcuts(v => !v);
      } else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleZenMode();
      } else if (e.key === 'Escape' && zenMode) {
        e.preventDefault();
        setZenMode(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleZenMode, zenMode]);

  // Reflect the theme & atmospheric palette choice onto <html data-theme data-palette>
  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    const paramTheme = params.get('theme');
    const activeTheme = paramTheme === 'light' || paramTheme === 'dark' ? paramTheme : theme;
    const paramPalette = params.get('palette');
    const validPalettes = ['obsidian', 'zen', 'indigo', 'washi'];
    const activePalette = validPalettes.includes(paramPalette || '') ? paramPalette : palette;

    const root = document.documentElement;
    root.setAttribute('data-theme', activeTheme);

    if (activePalette) root.setAttribute('data-palette', activePalette);
  }, [theme, palette]);

  // First-visit welcome
  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    if (params.get('welcome') === '0') {
      setShowWelcome(false);
      return;
    }
    // If user already has projects or sessions, they are an existing user with data — never show welcome
    if (projects.length > 0 || sessions.length > 0) {
      try {
        localStorage.setItem('kairo_seen_welcome', '1');
      } catch {}
      setShowWelcome(false);
      return;
    }
    if (!localStorage.getItem('kairo_seen_welcome')) setShowWelcome(true);
  }, [projects.length, sessions.length]);

  const dismissWelcome = () => {
    localStorage.setItem('kairo_seen_welcome', '1');
    setShowWelcome(false);
  };

  const [isSessionActive, setIsSessionActive] = useState(false);
  const [startSessionTrigger, setStartSessionTrigger] = useState<number>(0);
  const [toggleSessionTrigger, setToggleSessionTrigger] = useState<number>(0);

  const handleStartTaskFocus = useCallback((taskId: string) => {
    setActiveTaskId(taskId);
    setStartSessionTrigger(Date.now());
  }, []);

  const handleToggleTimer = useCallback(() => {
    setToggleSessionTrigger(Date.now());
  }, []);

  const audioEngine = useAudioEngine(audioSettings);
  const sessionIdsRef = useRef(new Set(sessions.map(session => session.id)));

  useEffect(() => {
    sessionIdsRef.current = new Set(sessions.map(session => session.id));
  }, [sessions]);

  const getActiveTarget = useCallback((items: Project[] | undefined, id: string | null): FocusTarget | null => {
    if (!id || !Array.isArray(items)) return null;
    for (const project of items) {
      if (!project) continue;
      if (project.id === id) return { id: project.id, name: project.name, kind: 'project' };
      const tasks = Array.isArray(project.tasks) ? project.tasks : [];
      const task = tasks.find(candidate => candidate?.id === id);
      if (task) {
        return {
          id: task.id,
          name: task.name,
          kind: 'task',
          completed: task.completed,
          targetRounds: task.targetRounds,
          pomodoroLength: task.pomodoroLength,
          timeSpent: task.timeSpent,
        };
      }
      for (const t of tasks) {
        const subTasks = Array.isArray(t.subTasks) ? t.subTasks : [];
        const subTask = subTasks.find(st => st?.id === id);
        if (subTask) {
          const subTarget = subTask.targetRounds || Math.max(1, Math.ceil((subTask.estimatedMinutes || t.pomodoroLength || userSettings.focusDuration || 25) / (subTask.pomodoroLength || t.pomodoroLength || userSettings.focusDuration || 25)));
          const subPomodoroLength = subTask.pomodoroLength || t.pomodoroLength || userSettings.focusDuration || 25;
          return {
            id: subTask.id,
            name: `${t.name} › ${subTask.name}`,
            kind: 'task',
            completed: subTask.completed,
            targetRounds: subTarget,
            pomodoroLength: subPomodoroLength,
            timeSpent: subTask.timeSpent,
          };
        }
      }
      const subProjects = Array.isArray(project.subProjects) ? project.subProjects : [];
      if (subProjects.length > 0) {
        const nested = getActiveTarget(subProjects, id);
        if (nested) return nested;
      }
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
    if (!Array.isArray(projects)) return;
    if (!projects.some(project => Array.isArray(project?.subProjects) && project.subProjects.length > 0)) return;
    const flatten = (items: Project[], parentName = ''): Project[] =>
      (items || []).flatMap(project => {
        if (!project) return [];
        const projectName = parentName ? `${parentName} / ${project.name}` : project.name;
        const subProjects = Array.isArray(project.subProjects) ? project.subProjects : [];
        return [{ ...project, name: projectName, subProjects: [] }, ...flatten(subProjects, projectName)];
      });
    setProjects(flatten(projects));
  }, [projects, setProjects]);

  const nextReward = useMemo(() => {
    const locked = capsules.find(c => !c.isUnlocked);
    return locked ? locked.treat : null;
  }, [capsules]);

  const addSession = useCallback(
    (session: KairoSession) => {
      if (sessionIdsRef.current.has(session.id)) return;
      sessionIdsRef.current.add(session.id);
      setSessions(prev => [session, ...prev]);
      if (session.type === 'focus' && session.taskId && session.duration > 0) {
        const addTime = (items: Project[]): Project[] =>
          (items || []).map(project => ({
            ...project,
            tasks: (project.tasks || []).map(task => {
              const isDirect = task.id === session.taskId;
              const hasSubTask = (task.subTasks || []).some(st => st.id === session.taskId);

              if (hasSubTask) {
                // Focus was directed to a specific subtask — update subtask & auto-cascade to task!
                return updateSubtaskMinutes(task, session.taskId!, session.duration, 'add');
              }
              if (isDirect) {
                // Focus was directed to the parent task directly
                const hasSubs = Array.isArray(task.subTasks) && task.subTasks.length > 0;
                const mode = task.timeCalcMode || (hasSubs ? 'hybrid' : 'direct');
                if (mode === 'hybrid') {
                  const directTime = (task.directTimeSpent || 0) + session.duration;
                  const updated: Task = { ...task, directTimeSpent: directTime, timeCalcMode: 'hybrid' };
                  return { ...updated, timeSpent: calculateEffectiveTaskTime(updated) };
                }
                return { ...task, timeSpent: (task.timeSpent || 0) + session.duration };
              }
              return task;
            }),
            subProjects: addTime(project.subProjects || []),
          }));
        setProjects(previous => addTime(previous));
      }

      if (session.type === 'focus' && session.completed) {
        const nextCount = completedPomodoros + 1;
        const { unlockable, remaining } = checkUnlockableCapsules(capsules, nextCount);
        if (unlockable.length > 0) {
          setCapsules([...unlockable, ...remaining]);
          setActiveUnsealedCapsule(unlockable[0]);
          setShowCapsuleModal(true);
          announceToast(`🎉 Future Treat unsealed: ${unlockable[0].treat}`);
        }
      }
    },
    [announceToast, capsules, completedPomodoros, setCapsules, setProjects, setSessions],
  );

  useEffect(() => {
    if (capsules.length === 0) return;
    const { unlockable, remaining } = checkUnlockableCapsules(capsules, completedPomodoros);
    if (unlockable.length > 0) {
      setCapsules([...unlockable, ...remaining]);
      setActiveUnsealedCapsule(unlockable[0]);
      setShowCapsuleModal(true);
      announceToast(`🎉 Future Treat unsealed: ${unlockable[0].treat}`);
    }
  }, [capsules, completedPomodoros, setCapsules, announceToast]);

  const handleSaveCapsule = useCallback(
    (data: {
      message: string;
      treat: string;
      triggerType: 'rounds' | 'time' | 'tomorrow';
      targetRounds?: number;
      targetTime?: string;
    }) => {
      const capsule: TimeCapsule = {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        message: data.message,
        treat: data.treat,
        triggerType: data.triggerType,
        targetRounds: data.targetRounds,
        targetTime: data.targetTime,
        completedRoundsAtCreation: completedPomodoros,
        isUnlocked: false,
      };
      setCapsules(prev => [capsule, ...prev]);
      announceToast('✉️ Time capsule sealed! Keep focusing to unlock it.');
    },
    [announceToast, completedPomodoros, setCapsules],
  );

  const handleClaimTreat = useCallback(
    (_id: string) => {
      setActiveUnsealedCapsule(null);
      announceToast('Enjoy your well-earned reward! ☕✨');
    },
    [announceToast],
  );

  const toggleAudio = useCallback(
    (isPlaying: boolean) => {
      if (isPlaying) {
        void audioEngine.resume().catch(() => {
          setAudioSettings(previous => ({ ...previous, isPlaying: false }));
        });
      }
      setAudioSettings(previous => ({ ...previous, isPlaying }));
    },
    [audioEngine],
  );

  const handleToggleSidebar = useCallback(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setMobileNavOpen(v => !v);
    } else {
      setSidebarCollapsed(v => !v);
    }
  }, []);

  const handleSelectTask = useCallback((taskId: string | null) => {
    setActiveTaskId(taskId);
    setMobileNavOpen(false);
  }, [setActiveTaskId]);

  return (
    <div
      className={`app-shell ${isResizingSidebar ? 'is-resizing' : ''}`}
      style={{ '--sidebar-w': `${sidebarWidth}px` } as React.CSSProperties}
      data-sidebar={sidebarCollapsed ? 'collapsed' : 'expanded'}
      data-mobile-nav={mobileNavOpen ? 'open' : 'closed'}
      data-sound-open={soundStudioOpen ? 'true' : 'false'}
      data-zen={zenMode ? 'true' : undefined}
    >
      {/* 1. Left Sidebar */}
      <aside className="k-sidebar" aria-label="Primary navigation">
        <div className="k-sidebar-head">
          <div
            className="k-brand"
            title="Kairo interval mark"
          >
            <span className="k-brand-mark" aria-hidden="true">
              <BrandLogo variant={logoVariant} size={15} />
            </span>
            <span className="k-brand-name">kairo</span>
          </div>

          <div className="k-head-actions">
            <button
              className="k-head-icon"
              onClick={() => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'))}
              aria-label={`Current theme: ${theme}. Click to switch to ${theme === 'dark' ? 'light' : 'dark'} mode.`}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 9.5A5.5 5.5 0 116.5 3a4.5 4.5 0 006.5 6.5z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="8" cy="8" r="3" />
                  <path d="M8 1.5v1.5M8 13v1.5M1.5 8h1.5M13 8h1.5M3.5 3.5l1 1M11.5 11.5l1 1M3.5 12.5l1-1M11.5 4.5l1-1" />
                </svg>
              )}
            </button>

            <button
              className="k-head-icon k-collapse"
              onClick={handleToggleSidebar}
              aria-label={
                typeof window !== 'undefined' && window.innerWidth <= 768
                  ? mobileNavOpen
                    ? 'Close navigation menu'
                    : 'Open navigation menu'
                  : sidebarCollapsed
                  ? 'Expand sidebar'
                  : 'Collapse sidebar'
              }
              title={
                typeof window !== 'undefined' && window.innerWidth <= 768
                  ? mobileNavOpen
                    ? 'Close navigation menu'
                    : 'Open navigation menu'
                  : sidebarCollapsed
                  ? 'Expand sidebar'
                  : 'Collapse sidebar'
              }
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="k-collapse-icon-desktop">
                {sidebarCollapsed ? <path d="M5 3l4 4-4 4" /> : <path d="M9 3L5 7l4 4" />}
              </svg>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" className="k-collapse-icon-mobile">
                {mobileNavOpen ? (
                  <path d="M4 4l8 8M12 4l-8 8" />
                ) : (
                  <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />
                )}
              </svg>
            </button>
          </div>
        </div>

        <SidebarNav
          projects={projects}
          setProjects={setProjects}
          settings={userSettings}
          activeTaskId={activeTaskId}
          setActiveTaskId={handleSelectTask}
          isSessionActive={isSessionActive}
          onStartTaskFocus={taskId => {
            handleStartTaskFocus(taskId);
            setMobileNavOpen(false);
          }}
          onToggleTimer={handleToggleTimer}
          onProgress={() => {
            setMobileNavOpen(false);
            setShowAnalytics(true);
          }}
          onSettings={() => {
            setMobileNavOpen(false);
            setShowSettings(true);
          }}
          onShortcuts={() => {
            setMobileNavOpen(false);
            setShowShortcuts(true);
          }}
          onToggleSoundStudio={() => {
            setMobileNavOpen(false);
            setSoundStudioOpen(v => !v);
          }}
          soundStudioOpen={soundStudioOpen}
          onTimeCapsule={() => {
            setMobileNavOpen(false);
            setShowCapsuleModal(true);
          }}
          capsuleCount={capsules.filter(c => !c.isUnlocked).length}
          onScience={() => {
            setMobileNavOpen(false);
            setShowScience(true);
          }}
        />

        {!sidebarCollapsed && (
          <div
            className="k-sidebar-resizer"
            onMouseDown={startResizingSidebar}
            onDoubleClick={resetSidebarWidth}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize sidebar"
            title="Drag to resize sidebar (Double-click to reset)"
          />
        )}
      </aside>

      {/* 2. Main Focus Stage & Sound Studio */}
      <main className="k-main">
        <section className="k-stage" id="focus-workspace">
          {/* Pinned Stage Utility Header (Coordinated in-flow, completely eliminating overlaps) */}
          <header className="k-stage-utility-header">
            <div className="k-stage-utility-left" />

            <div className="k-top-utility-bar" role="toolbar" aria-label="Stage utility actions">
              <button
                className={`k-zen-pill-btn ${zenMode ? 'is-active' : ''}`}
                onClick={toggleZenMode}
                aria-label={zenMode ? 'Exit Zen Mode (F)' : 'Enter Zen Mode (F)'}
                title={zenMode ? 'Exit Zen Mode (F)' : 'Enter Zen Mode (F)'}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  {zenMode ? (
                    <path d="M5 2v3H2M11 2v3h3M5 14v-3H2M11 14v-3h3" />
                  ) : (
                    <path d="M2 5V2h3M14 5V2h-3M2 11v3h3M14 11v3h-3" />
                  )}
                </svg>
                <span className="k-pill-label">{zenMode ? 'Exit Zen' : 'Zen'}</span>
                <kbd className="k-kbd-inline">F</kbd>
              </button>

              <button
                className={`k-sound-pill-btn ${audioSettings.isPlaying ? 'is-playing' : ''} ${soundStudioOpen ? 'is-open' : ''}`}
                onClick={() => setSoundStudioOpen(v => !v)}
                aria-label="Sound Studio"
                title="Toggle Sound Studio"
              >
                <span className="k-sound-pill-wave">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="k-pill-label">Sound Studio</span>
                {audioSettings.isPlaying && <span className="k-sound-pill-active-tag">Active</span>}
              </button>

              <button
                className={`k-capsule-pill-btn ${capsules.some(c => !c.isUnlocked) ? 'has-locked' : ''}`}
                onClick={() => setShowCapsuleModal(true)}
                aria-label="Time Capsule & Future Treat"
                title="Time Capsule — Seal a reward for future-you"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
                  <path d="M2 5l6 4 6-4" />
                </svg>
                <span className="k-pill-label">Future Treat</span>
                {capsules.filter(c => !c.isUnlocked).length > 0 && (
                  <span className="k-capsule-pill-badge">{capsules.filter(c => !c.isUnlocked).length}</span>
                )}
              </button>

              <button
                className="k-guide-pill-btn"
                onClick={() => setShowScience(true)}
                aria-label="Focus Guide & Pomodoro Science"
                title="The Science of Focus & Pomodoro Technique"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3.5A1.5 1.5 0 013.5 2H7v12H3.5A1.5 1.5 0 012 12.5v-9zM14 3.5A1.5 1.5 0 0012.5 2H9v12h3.5a1.5 1.5 0 001.5-1.5v-9z" />
                </svg>
                <span className="k-pill-label">Guide</span>
              </button>
            </div>
          </header>

          <Stage
            settings={userSettings}
            setSettings={setUserSettings}
            addSession={addSession}
            activeTarget={activeTarget}
            toggleAudio={toggleAudio}
            playCompletionCue={audioEngine.playCue}
            playTickCue={audioEngine.playTick}
            totalPomodoros={completedPomodoros}
            totalFocusMinutes={totalFocusMinutes}
            todaySummary={todaySummary}
            onActiveChange={setIsSessionActive}
            onOpenCapsule={() => setShowCapsuleModal(true)}
            nextReward={nextReward}
            startSessionTrigger={startSessionTrigger}
            toggleSessionTrigger={toggleSessionTrigger}
          />
        </section>

        {/* 3. Sound Studio Drawer / Panel */}
        <aside className={`k-sound-lib ${soundStudioOpen ? 'is-open' : 'is-closed'}`} aria-label="Sound library">
          <ControlPanel
            audioSettings={audioSettings}
            setAudioSettings={setAudioSettings}
            resumeAudio={audioEngine.resume}
            audioError={audioEngine.error}
            onClose={() => setSoundStudioOpen(false)}
          />
        </aside>

        {/* Backdrop for mobile drawer */}
        {soundStudioOpen && (
          <div
            className="k-sound-backdrop"
            onClick={() => setSoundStudioOpen(false)}
            aria-hidden="true"
          />
        )}

        {/* Mobile Navigation Drawer Backdrop */}
        {mobileNavOpen && (
          <div
            className="k-mobile-backdrop"
            onClick={() => setMobileNavOpen(false)}
            aria-hidden="true"
          />
        )}
      </main>

      {/* 4. Modals */}
      {showWelcome && (
        <WelcomeModal
          onClose={dismissWelcome}
          onOpenScience={() => {
            dismissWelcome();
            setShowScience(true);
          }}
          onOpenSettings={() => {
            dismissWelcome();
            setShowSettings(true);
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={userSettings}
          setSettings={setUserSettings}
          onClose={() => setShowSettings(false)}
          onToast={announceToast}
          theme={theme}
          setTheme={setTheme}
          palette={palette}
          setPalette={setPalette}
          logoVariant={logoVariant}
          setLogoVariant={setLogoVariant}
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
        <AnalyticsModal sessions={sessions} onClose={() => setShowAnalytics(false)} />
      )}

      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {showCapsuleModal && (
        <TimeCapsuleModal
          capsules={capsules}
          onSaveCapsule={handleSaveCapsule}
          onClose={() => {
            setShowCapsuleModal(false);
            setActiveUnsealedCapsule(null);
          }}
          activeUnsealed={activeUnsealedCapsule}
          onClaimTreat={handleClaimTreat}
          totalCompletedRounds={completedPomodoros}
        />
      )}

      {showScience && (
        <PomodoroScienceModal onClose={() => setShowScience(false)} />
      )}
    </div>
  );
};

/* First-run welcome */
const WelcomeModal: React.FC<{
  onClose: () => void;
  onOpenScience?: () => void;
  onOpenSettings?: () => void;
}> = ({ onClose, onOpenScience, onOpenSettings }) => (
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
            ['Quick Start', 'Start focusing immediately with Quick Focus, or add a project & task in the sidebar to organize your goals.'],
            ['Task Target Dots (●○○○)', 'The circles next to each task are estimated 25-minute Pomodoro rounds. Click them anytime to set your target (2, 4, 6, 8 rounds). As you complete sessions, the dots fill in solid red.'],
            ['Tune Your Pace', <>Drag the dial for any duration up to 60 minutes, then press <kbd>Space</kbd> or the red button. <kbd>S</kbd> skip · <kbd>R</kbd> reset · <kbd>E</kbd> extend +5m.</>],
            ['Atmospheric Sound Studio', 'Layer ambient rain, campfire, or real-time binaural brainwave frequencies using the Sound Studio toggle at top right.'],
            ['Track Your Evidence', 'Every completed session banks focus minutes and fills your year-at-a-glance focus heatmap in Progress. 100% private & local.'],
          ];
          return (
            <ol className="k-welcome-list">
              {steps.map(([title, body], i) => (
                <li key={i}>
                  <div className="k-welcome-text">
                    <b>{title}</b>
                    <span>{body}</span>
                  </div>
                </li>
              ))}
            </ol>
          );
        })()}
      </div>
      <footer className="k-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {onOpenScience && (
            <button
              type="button"
              className="k-btn"
              onClick={onOpenScience}
              style={{ fontSize: 12 }}
            >
              📚 Read the Science
            </button>
          )}
          {onOpenSettings && (
            <button
              type="button"
              className="k-btn"
              onClick={onOpenSettings}
              style={{ fontSize: 12 }}
              title="Import an existing JSON snapshot or configure cloud sync"
            >
              📥 Import Backup / Cloud Sync
            </button>
          )}
        </div>
        <button className="k-btn k-btn-primary" onClick={onClose}>
          Start focusing
        </button>
      </footer>
    </>
  </Modal>
);

export default App;
