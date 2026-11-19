import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { Stage } from './components/Stage';
import { ControlPanel } from './components/ControlPanel';
import { SettingsModal } from './components/SettingsModal';
import { AnalyticsModal } from './components/AnalyticsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { FaqModal } from './components/FaqModal';
import { TodayScreen } from './components/TodayScreen';
import { AiBridgeModal } from './components/AiBridgeModal';
import { ReplanModal } from './components/ReplanModal';
import { SprintModal, type SprintRequest } from './components/SprintModal';
import { PHASE_ADVICE } from './utils/examMode';
import { taskRounds } from './utils/todayPlan';
import { ProjectHistoryModal } from './components/ProjectHistoryModal';
import { applyReplanOps, type ReplanOp } from './utils/replan';
import { decodePlanLink, type BridgePlan } from './utils/aiBridge';
import { PlanInterviewModal } from './components/PlanInterviewModal';
import { WelcomeGuide } from './components/WelcomeGuide';
import { backupDue, downloadSnapshot, LAST_BACKUP_KEY } from './utils/backup';
import { completeSignInFromUrl } from './utils/kairoCloud';
import { FocusSetupModal } from './components/FocusSetupModal';
import { DocumentBreakdownModal } from './components/DocumentBreakdownModal';
import { buildTodayState } from './utils/todayPlan';
import { applyImportedPlan, type ImportedPlan } from './utils/importPlan';
import { SidebarNav } from './components/SidebarNav';
import { TimeCapsuleModal } from './components/TimeCapsuleModal';
import { BrandLogo, getLogoSvgDataUri, type LogoVariant } from './components/BrandLogo';
import type { Project, Task, KairoSession, UserSettings, AudioSettings, FocusTarget, TimeCapsule, Palette } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';
import { useAudioEngine } from './hooks/useAudioEngine';
import { CastMenu } from './components/CastMenu';
import { publishAudio, publishExtras, useCastStatus } from './utils/castDisplay';
import { TvMode } from './components/TvDisplay';
import { checkUnlockableCapsules } from './utils/timeCapsule';
import { calculateEffectiveTaskTime, calculateFinishEstimate, directTimeOf, updateSubtaskMinutes } from './utils/subtaskTime';
import { calculateTodaySummary } from './utils/analytics';
import { ALLOWED_PALETTES, DEFAULT_SETTINGS, normalizeActiveTaskId, normalizePalette, normalizeProjects, normalizeSessions, normalizeSettings } from './data/validation';

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

const SIDEBAR_DEFAULT = 304;
const SIDEBAR_KEY = 'kairo_sidebar_width_v2';

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
  const [showFaq, setShowFaq] = useState(false);
  const [showInterview, setShowInterview] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [afterSession, setAfterSession] = useState<{ taskId?: string; name?: string; reached: boolean; done: number; target: number } | null>(null);
  const [undo, setUndo] = useState<{ snapshot: Project[]; label: string } | null>(null);
  const [localFlags, setLocalFlags] = useState(() => {
    const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
    return { lastBackup: read(LAST_BACKUP_KEY), backupSnooze: read('kairo_backup_snooze'), triedSound: read('kairo_tried_sound'), startedHidden: read('kairo_started_hidden'), focusSetup: read('kairo_focus_setup') };
  });
  const setFlag = useCallback((key: string, field: string, value: string) => {
    try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
    setLocalFlags(prev => ({ ...prev, [field]: value }));
  }, []);
  const [showFocusSetup, setShowFocusSetup] = useState(() => {
    return false;
  });
  const [showFileImport, setShowFileImport] = useState(false);
  const [showBridge, setShowBridge] = useState(false);
  const [replanProjectId, setReplanProjectId] = useState<string | null>(null);
  const [sprint, setSprint] = useState<SprintRequest | null>(null);
  const [historyProjectId, setHistoryProjectId] = useState<string | null>(null);
  const [linkedPlan, setLinkedPlan] = useState<BridgePlan | null>(() => {
    if (typeof location === 'undefined' || !location.hash.startsWith('#import=')) return null;
    return decodePlanLink(location.hash).plan;
  });
  const [showExtras, setShowExtras] = useLocalStorage<boolean>('kairo_extras', false, {
    version: 1,
    normalize: value => value === true,
  });
  const [view, setView] = useState<'today' | 'focus'>(() =>
    projects.some(project => project.tasks.some(task => !task.completed)) ? 'today' : 'focus');
  const todayState = useMemo(() => buildTodayState({ projects, sessions }), [projects, sessions]);
  const todayFinish = useMemo(
    () => calculateFinishEstimate(todayState.blocks.map(b => ({ targetRounds: b.rounds, timeSpent: 0, pomodoroLength: userSettings.focusDuration })), userSettings),
    [todayState, userSettings],
  );
  const remainingTasks = useCallback((projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    return (project?.tasks ?? []).filter(t => !t.completed).map(t => {
      const { target, done } = taskRounds(t);
      return { id: t.id, name: t.name, rounds: Math.max(0, target - done) };
    }).filter(t => t.rounds > 0);
  }, [projects]);
  const openSprint = useCallback((target: { kind: 'today' } | { kind: 'project'; projectId: string } | { kind: 'exam' }) => {
    if (target.kind === 'today') {
      setSprint({ title: "Sprint: today's plan", subtitle: 'Your planned sessions for today, timed with breaks.', tasks: todayState.blocks.map(b => ({ id: b.taskId, name: b.taskName, rounds: b.rounds })), minutes: Math.max(30, todayFinish.totalMinutes) });
      return;
    }
    const projectId = target.kind === 'exam' ? todayState.exam?.projectId : target.projectId;
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const exam = target.kind === 'exam' ? todayState.exam : undefined;
    setSprint({
      title: exam ? `${PHASE_ADVICE[exam.phase].title}: ${project.name}` : `Sprint: ${project.name}`,
      subtitle: exam ? `${exam.daysLeft <= 0 ? 'Exam today.' : `${exam.daysLeft} day${exam.daysLeft === 1 ? '' : 's'} to go.`} ${PHASE_ADVICE[exam.phase].advice}` : 'Mixed topics, active recall and practice, with breaks.',
      tasks: remainingTasks(project.id),
    });
  }, [projects, remainingTasks, todayFinish.totalMinutes, todayState]);
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
  // Wide enough that project and task names read in full. Only a width the user dragged to is remembered
  // (the old key saved 260px for everyone, so it is ignored).
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const num = Number(localStorage.getItem(SIDEBAR_KEY));
      return num ? Math.max(240, Math.min(480, num)) : SIDEBAR_DEFAULT;
    } catch {
      return SIDEBAR_DEFAULT;
    }
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);

  const startResizingSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);
    const startX = e.clientX;
    const startW = sidebarWidth;
    let latest = startW;

    const onMouseMove = (moveEvent: MouseEvent) => {
      latest = Math.max(240, Math.min(480, startW + (moveEvent.clientX - startX)));
      setSidebarWidth(latest);
    };

    const onMouseUp = () => {
      setIsResizingSidebar(false);
      try { localStorage.setItem(SIDEBAR_KEY, String(latest)); } catch { /* storage unavailable */ }
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [sidebarWidth]);

  const resetSidebarWidth = useCallback(() => {
    setSidebarWidth(SIDEBAR_DEFAULT);
    try { localStorage.removeItem(SIDEBAR_KEY); } catch { /* storage unavailable */ }
  }, []);

  const [soundStudioOpen, setSoundStudioOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('sound') === '1';
    }
    return false;
  });
  const [toast, setToast] = useState<string | null>(null);
  const [toastLeaving, setToastLeaving] = useState(false);
  const toastTimerRef = useRef<number | null>(null);
  const toastFadeRef = useRef<number | null>(null);

  const clearToastTimers = useCallback(() => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    if (toastFadeRef.current) window.clearTimeout(toastFadeRef.current);
  }, []);
  /** Fades out, then removes. Called by the timer and by the close button. */
  const hideToast = useCallback(() => {
    clearToastTimers();
    setToastLeaving(true);
    toastFadeRef.current = window.setTimeout(() => { setToast(null); setToastLeaving(false); }, 220);
  }, [clearToastTimers]);
  const startToastTimer = useCallback((ms: number) => {
    clearToastTimers();
    toastTimerRef.current = window.setTimeout(hideToast, ms);
  }, [clearToastTimers, hideToast]);

  const announceToast = useCallback((msg: string) => {
    setToast(msg);
    setToastLeaving(false);
    startToastTimer(4500);
  }, [startToastTimer]);

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
  const [palette, setPalette] = useLocalStorage<Palette>(
    'kairo_palette',
    'obsidian',
    {
      version: 1,
      normalize: normalizePalette,
    },
  );
  const [logoVariant] = useLocalStorage<LogoVariant>(
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

  const lastVolumeRef = useRef<number>(audioSettings.masterVolume > 0 ? audioSettings.masterVolume : 0.7);

  const toggleMasterMute = useCallback(() => {
    setAudioSettings(prev => {
      if (prev.masterVolume > 0) {
        lastVolumeRef.current = prev.masterVolume;
        announceToast('Master audio muted (M)');
        return { ...prev, masterVolume: 0 };
      } else {
        const restored = lastVolumeRef.current || 0.7;
        announceToast('Master audio unmuted (M)');
        return { ...prev, masterVolume: restored };
      }
    });
  }, [announceToast]);

  // Global key listener for shortcuts and Zen mode
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        setShowShortcuts(v => !v);
      } else if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleZenMode();
      } else if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        toggleMasterMute();
      } else if (e.key === 'Escape' && zenMode) {
        e.preventDefault();
        setZenMode(false);
        if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [toggleZenMode, toggleMasterMute, zenMode]);

  useEffect(() => {
    document.documentElement.style.setProperty('--text-scale', String(userSettings.textScale));
  }, [userSettings.textScale]);

  // Reflect the theme & atmospheric palette choice onto <html data-theme data-palette>
  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    const paramTheme = params.get('theme');
    const activeTheme = paramTheme === 'light' || paramTheme === 'dark' ? paramTheme : theme;
    const paramPalette = params.get('palette');
    const activePalette = (ALLOWED_PALETTES as readonly string[]).includes(paramPalette || '')
      ? (paramPalette as Palette)
      : palette;

    const root = document.documentElement;
    root.setAttribute('data-theme', activeTheme);

    if (activePalette) root.setAttribute('data-palette', activePalette);
  }, [theme, palette]);

  // First-visit welcome
  useEffect(() => {
    const search = typeof window !== 'undefined' ? window.location.search : '';
    const params = new URLSearchParams(search);
    if (params.get('welcome') === '0') {
      return;
    }
    // If user already has projects or sessions, they are an existing user with data — never show welcome
    if (projects.length > 0 || sessions.length > 0) {
      try {
        localStorage.setItem('kairo_seen_welcome', '1');
      } catch {}
      return;
    }
    if (!localStorage.getItem('kairo_seen_welcome')) setShowGuide(true);
  }, [projects.length, sessions.length]);


  const [isSessionActive, setIsSessionActive] = useState(false);
  const [startSessionTrigger, setStartSessionTrigger] = useState<number>(0);
  const [toggleSessionTrigger, setToggleSessionTrigger] = useState<number>(0);

  const handleStartTaskFocus = useCallback((taskId: string) => {
    setActiveTaskId(taskId);
    setStartSessionTrigger(Date.now());
  }, [setActiveTaskId]);

  const handleStartFromToday = useCallback((taskId: string) => {
    setView('focus');
    handleStartTaskFocus(taskId);
  }, [handleStartTaskFocus]);

  const handleSetDeadline = useCallback((projectId: string, deadline: string) => {
    setProjects(previous => previous.map(project =>
      project.id === projectId ? { ...project, deadline: deadline || undefined } : project));
  }, [setProjects]);

  const finishTask = useCallback((taskId: string) => {
    setProjects(previous => previous.map(p => ({ ...p, tasks: p.tasks.map(t => (t.id === taskId ? { ...t, completed: true, status: 'done' as const } : t)) })));
  }, [setProjects]);
  const addOneSession = useCallback((taskId: string) => {
    setProjects(previous => previous.map(p => ({ ...p, tasks: p.tasks.map(t => (t.id === taskId ? { ...t, targetRounds: Math.max(1, t.targetRounds ?? 1) + 1 } : t)) })));
  }, [setProjects]);

  const previousProjects = useRef(projects);
  const skipUndo = useRef(false);
  useEffect(() => {
    const previous = previousProjects.current;
    previousProjects.current = projects;
    if (skipUndo.current) { skipUndo.current = false; return; }
    const count = (list: Project[]) => list.reduce((sum, p) => sum + 1 + p.tasks.reduce((n, t) => n + 1 + (t.subTasks?.length ?? 0), 0), 0);
    const removed = count(previous) - count(projects);
    if (removed <= 0) return;
    setUndo({ snapshot: previous, label: projects.length < previous.length ? 'Project deleted' : removed === 1 ? 'Deleted' : `${removed} items removed` });
  }, [projects]);

  // The undo bar fades after 10 seconds; hovering or focusing it pauses the countdown.
  const [undoPaused, setUndoPaused] = useState(false);
  useEffect(() => {
    if (!undo || undoPaused) return;
    const timer = window.setTimeout(() => setUndo(null), 10000);
    return () => window.clearTimeout(timer);
  }, [undo, undoPaused]);

  useEffect(() => {
    if (soundStudioOpen && !localFlags.triedSound) setFlag('kairo_tried_sound', 'triedSound', '1');
  }, [soundStudioOpen, localFlags.triedSound, setFlag]);

  useEffect(() => {
    completeSignInFromUrl()
      .then(ok => { if (ok) { announceToast('Signed in to Kairo Cloud. Open Settings to sync.'); setShowInterview(false); setShowGuide(false); } })
      .catch(error => announceToast(error instanceof Error && error.message ? `Sign-in did not finish: ${error.message}` : 'Sign-in did not finish. Try again from Settings.'));
  }, [announceToast]);

  const closeInterview = useCallback(() => {
    try {
      localStorage.setItem('kairo_seen_welcome', '1');
      localStorage.setItem('kairo_focus_setup', '1');
    } catch { /* storage unavailable */ }
    setShowInterview(false);
  }, []);

  const handleImportedPlan = useCallback((imported: ImportedPlan) => {
    const result = applyImportedPlan(projects, imported);
    setProjects(result.projects);
    if (result.firstTaskId) setActiveTaskId(result.firstTaskId);
    setView('today');
  }, [projects, setProjects, setActiveTaskId]);

  const handleToggleTimer = useCallback(() => {
    setToggleSessionTrigger(Date.now());
  }, []);

  const [tvMode, setTvMode] = useState(false);
  const { soundOnTv } = useCastStatus();
  // While the TV plays the sound, this device stays quiet so it is not heard twice.
  const localAudio = useMemo(() => (soundOnTv ? { ...audioSettings, isPlaying: false } : audioSettings), [audioSettings, soundOnTv]);
  const audioEngine = useAudioEngine(localAudio);
  useEffect(() => { publishExtras({ theme, palette }); }, [theme, palette]);
  useEffect(() => { publishAudio(audioSettings); }, [audioSettings]);
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
  }, [userSettings.focusDuration]);

  const activeTarget = getActiveTarget(projects, activeTaskId);
  const completedPomodoros = sessions.filter(s => s.type === 'focus' && s.completed).length;
  const totalFocusMinutes = sessions
    .filter(s => s.type === 'focus' && s.completed)
    .reduce((total, s) => total + s.duration, 0);

  const todaySummary = useMemo(() => calculateTodaySummary(sessions), [sessions]);

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
      if (session.type === 'focus' && session.completed) {
        const task = projects.flatMap(p => p.tasks).find(t => t.id === session.taskId);
        if (task) {
          const length = task.pomodoroLength || userSettings.focusDuration || 25;
          const target = Math.max(1, task.targetRounds ?? 1);
          const done = Math.floor(((task.timeSpent || 0) + session.duration) / length);
          setAfterSession({ taskId: task.id, name: task.name, reached: !task.completed && done >= target, done, target });
        } else {
          setAfterSession({ reached: false, done: 0, target: 0 });
        }
      }
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
                if (hasSubs) {
                  const updated: Task = { ...task, directTimeSpent: directTimeOf(task) + session.duration };
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
    [announceToast, capsules, completedPomodoros, projects, setCapsules, setProjects, setSessions, userSettings.focusDuration],
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
      const tone: Partial<AudioSettings> = !isPlaying ? {}
        : userSettings.focusSound === 'brown' ? { mode: 'noise', noiseType: 'brown', noiseVolume: 0.5 }
        : userSettings.focusSound === 'alpha' ? { mode: 'binaural', beatFrequency: 10, binauralVolume: 0.25 }
        : userSettings.focusSound === 'beta' ? { mode: 'binaural', beatFrequency: 14, binauralVolume: 0.25 }
        : {};
      setAudioSettings(previous => ({ ...previous, ...tone, isPlaying }));
    },
    [audioEngine, userSettings.focusSound],
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
            title="Kairo"
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
          onNotify={announceToast}
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
          onNewPlan={() => {
            setMobileNavOpen(false);
            setShowInterview(true);
          }}
          onToday={() => {
            setMobileNavOpen(false);
            setView('today');
          }}
          onFocus={() => {
            setMobileNavOpen(false);
            setView('focus');
          }}
          currentView={view}
          onTimeCapsule={showExtras ? () => {
            setMobileNavOpen(false);
            setShowCapsuleModal(true);
          } : undefined}
          capsuleCount={capsules.filter(c => !c.isUnlocked).length}
          onHelp={() => {
            setMobileNavOpen(false);
            setShowFaq(true);
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
        <h1 className="sr-only">Kairo focus timer</h1>
        {view === 'today' && (
          <TodayScreen
            state={todayState}
            onStartBlock={handleStartFromToday}
            onSetDeadline={handleSetDeadline}
            onNewPlan={() => setShowInterview(true)}
            onOpenFocus={() => setView('focus')}
            onReplan={setReplanProjectId}
            onExamSprint={() => openSprint({ kind: 'exam' })}
            onSprint={openSprint}
            finish={todayFinish}
            backup={todayState.hasPlan && backupDue({ sessionCount: sessions.length, lastBackup: localFlags.lastBackup, snoozedUntil: localFlags.backupSnooze }) ? {
              onDownload: () => { downloadSnapshot('kairo-backup'); setFlag(LAST_BACKUP_KEY, 'lastBackup', String(Date.now())); announceToast('Backup saved to your downloads'); },
              onLater: () => setFlag('kairo_backup_snooze', 'backupSnooze', String(Date.now() + 24 * 60 * 60 * 1000)),
            } : undefined}
            started={(() => {
              const steps = [
                { label: 'Make a plan', done: todayState.hasPlan || projects.length > 0 },
                { label: 'Finish your first focus session', done: sessions.some(x => x.type === 'focus' && x.completed) },
                { label: 'Try a background sound (speaker icon)', done: Boolean(localFlags.triedSound) },
              ];
              return localFlags.startedHidden || steps.every(x => x.done) ? undefined : { steps, onDismiss: () => setFlag('kairo_started_hidden', 'startedHidden', '1') };
            })()}
            onHistory={setHistoryProjectId}
          />
        )}
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

              <CastMenu onTvMode={() => setTvMode(true)} onMessage={announceToast} />

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

              {showExtras && (
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
              )}

            </div>
          </header>

          <Stage
            showLayouts={showExtras}
            settings={userSettings}
            setSettings={setUserSettings}
            addSession={addSession}
            activeTarget={activeTarget}
            toggleAudio={toggleAudio}
            playTickCue={audioEngine.playTick}
            totalPomodoros={completedPomodoros}
            totalFocusMinutes={totalFocusMinutes}
            todaySummary={todaySummary}
            onActiveChange={setIsSessionActive}
            onOpenCapsule={showExtras ? () => setShowCapsuleModal(true) : undefined}
            nextReward={nextReward}
            startSessionTrigger={startSessionTrigger}
            toggleSessionTrigger={toggleSessionTrigger}
            onToggleSubtask={subtaskId => {
              if (activeTarget?.kind === 'task') {
                setProjects(prev =>
                  prev.map(p => ({
                    ...p,
                    tasks: p.tasks.map(t => {
                      if (t.id !== activeTarget.id) return t;
                      const currentSubs = t.subTasks || [];
                      const updatedSubs = currentSubs.map(st =>
                        st.id === subtaskId ? { ...st, completed: !st.completed } : st,
                      );
                      const allDone = updatedSubs.length > 0 && updatedSubs.every(st => st.completed);
                      return {
                        ...t,
                        completed: allDone,
                        status: (allDone ? 'done' : 'todo') as 'todo' | 'done',
                        subTasks: updatedSubs,
                      };
                    }),
                  })),
                );
              }
            }}
          />
          {tvMode && <TvMode onExit={() => setTvMode(false)} onToggleTimer={() => setToggleSessionTrigger(Date.now())} />}
        </section>

        {/* 3. Sound Studio Drawer / Panel */}
        <aside className={`k-sound-lib ${soundStudioOpen ? 'is-open' : 'is-closed'}`} aria-label="Sound library">
          <ControlPanel
            focusSound={userSettings.focusSound}
            onFocusSound={focusSound => setUserSettings({ ...userSettings, focusSound })}
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

      <nav className="k-tabbar" aria-label="Main">
        {([
          ['today', 'Today', () => setView('today'), view === 'today'],
          ['focus', 'Focus', () => setView('focus'), view === 'focus'],
          ['plan', 'Plan', () => setMobileNavOpen(open => !open), mobileNavOpen],
          ['progress', 'Progress', () => setShowAnalytics(true), false],
        ] as const).map(([key, label, onClick, active]) => (
          <button key={key} type="button" className={`k-tabbar-item ${active ? 'is-active' : ''}`} onClick={onClick} aria-current={active ? 'page' : undefined}>
            <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {key === 'today' && <><rect x="2.5" y="3.5" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" /></>}
              {key === 'focus' && <><circle cx="8" cy="8.5" r="5" /><path d="M8 5.5v3l2 1.2M6.5 1.5h3" /></>}
              {key === 'plan' && <><path d="M3 4h10M3 8h10M3 12h6" /></>}
              {key === 'progress' && <><path d="M3 13V8M7 13V4M11 13V9M14 13H2" /></>}
            </svg>
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* 4. Modals */}

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
          showExtras={showExtras}
          setShowExtras={setShowExtras}
        />
      )}

      {afterSession && (() => {
        const next = todayState.blocks.find(b => b.taskId !== afterSession.taskId || !afterSession.reached);
        return (
          <div className="k-after-session" role="status">
            <div>
              {afterSession.reached
                ? <b>{afterSession.name}: {afterSession.done} of {afterSession.target} sessions done. Finished?</b>
                : <b>Session done{afterSession.name ? `: ${afterSession.name} (${afterSession.done}/${afterSession.target})` : ''}.</b>}
              {next && <small>Up next: {next.taskName}</small>}
            </div>
            <div className="k-after-session-actions">
              {afterSession.reached && afterSession.taskId && (
                <>
                  <button type="button" className="k-btn k-btn-primary" onClick={() => { finishTask(afterSession.taskId!); setAfterSession(null); }}>Yes, done</button>
                  <button type="button" className="k-btn" onClick={() => { addOneSession(afterSession.taskId!); setAfterSession(null); }}>Need 1 more</button>
                </>
              )}
              {next && !afterSession.reached && (
                <button type="button" className="k-btn" onClick={() => { setActiveTaskId(next.taskId); setAfterSession(null); }}>Line it up</button>
              )}
              <button type="button" className="k-link-btn" onClick={() => setAfterSession(null)} aria-label="Dismiss">Close</button>
            </div>
          </div>
        );
      })()}

      {undo && (
        <div
          className="k-undo-bar"
          role="status"
          onMouseEnter={() => setUndoPaused(true)}
          onMouseLeave={() => setUndoPaused(false)}
          onFocus={() => setUndoPaused(true)}
          onBlur={() => setUndoPaused(false)}
        >
          <span>{undo.label}</span>
          <button type="button" className="k-btn" onClick={() => { skipUndo.current = true; setProjects(undo.snapshot); setUndo(null); }}>Undo</button>
          <button type="button" className="k-toast-close" onClick={() => setUndo(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {toast && (
        <div
          className={`k-toast ${toastLeaving ? 'is-leaving' : ''} ${undo || afterSession ? 'is-raised' : ''}`}
          role="status"
          aria-live="polite"
          onMouseEnter={clearToastTimers}
          onMouseLeave={() => startToastTimer(2000)}
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l3.5 3.5L13 5" />
          </svg>
          <span>{toast}</span>
          <button type="button" className="k-toast-close" onClick={hideToast} aria-label="Dismiss message">×</button>
        </div>
      )}

      {showAnalytics && (
        <AnalyticsModal sessions={sessions} onClose={() => setShowAnalytics(false)} />
      )}

      {showShortcuts && (
        <ShortcutsModal onClose={() => setShowShortcuts(false)} />
      )}

      {(showBridge || linkedPlan) && (
        <AiBridgeModal
          projects={projects}
          sessions={sessions}
          initialPlan={linkedPlan}
          onClose={() => {
            setShowBridge(false);
            if (linkedPlan) {
              setLinkedPlan(null);
              history.replaceState(null, '', location.pathname + location.search);
            }
          }}
          onImport={plans => plans.forEach(handleImportedPlan)}
        />
      )}

      {sprint && (
        <SprintModal {...sprint} onClose={() => setSprint(null)} onStart={handleStartFromToday} />
      )}

      {historyProjectId && (() => {
        const project = projects.find(p => p.id === historyProjectId);
        return project ? <ProjectHistoryModal project={project} sessions={sessions} onClose={() => setHistoryProjectId(null)} /> : null;
      })()}

      {replanProjectId && (() => {
        const project = projects.find(p => p.id === replanProjectId);
        const plan = todayState.projects.find(p => p.projectId === replanProjectId);
        return project && plan ? (
          <ReplanModal
            project={project}
            plan={plan}
            multiplier={todayState.multiplier}
            onClose={() => setReplanProjectId(null)}
            onApply={(projectId: string, ops: ReplanOp[]) =>
              setProjects(previous => previous.map(p => (p.id === projectId ? applyReplanOps(p, ops) : p)))}
          />
        ) : null;
      })()}

      {showFocusSetup && !showInterview && (
        <FocusSetupModal
          settings={userSettings}
          setSettings={setUserSettings}
          onDone={() => {
            try { localStorage.setItem('kairo_focus_setup', '1'); } catch { /* storage unavailable */ }
            setShowFocusSetup(false);
          }}
        />
      )}

      {showGuide && (
        <WelcomeGuide
          settings={userSettings}
          setSettings={setUserSettings}
          onFinish={next => {
            try {
              localStorage.setItem('kairo_seen_welcome', '1');
              localStorage.setItem('kairo_focus_setup', '1');
            } catch { /* storage unavailable */ }
            setFlag('kairo_focus_setup', 'focusSetup', '1');
            setShowGuide(false);
            if (next === 'plan') setShowInterview(true);
            else setView('focus');
          }}
        />
      )}

      {showInterview && (
        <PlanInterviewModal
          projects={projects}
          sessions={sessions}
          onClose={closeInterview}
          onImport={plans => plans.forEach(handleImportedPlan)}
          onSessionLength={minutes => setUserSettings({ ...userSettings, focusDuration: minutes })}
          onSkip={() => { closeInterview(); setView('focus'); }}
          setup={localFlags.focusSetup ? undefined : {
            settings: userSettings,
            setSettings: setUserSettings,
            onDone: () => { setFlag('kairo_focus_setup', 'focusSetup', '1'); setShowFocusSetup(false); },
          }}
          onUploadFile={() => { closeInterview(); setShowFileImport(true); }}
          onUseChatbot={() => { closeInterview(); setShowBridge(true); }}
        />
      )}

      {showFileImport && (
        <DocumentBreakdownModal
          onClose={() => setShowFileImport(false)}
          onImportPlan={handleImportedPlan}
          existingProjects={projects}
        />
      )}

      {showFaq && (
        <FaqModal
          onClose={() => setShowFaq(false)}
          onOpenSettings={() => {
            setShowFaq(false);
            setShowSettings(true);
          }}
        />
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

    </div>
  );
};

/* First-run welcome */

export default App;
