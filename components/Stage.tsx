import { showSessionNotification } from '../utils/notify';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import type { FocusTarget, KairoSession, SessionType, UserSettings, StageLayoutVariation } from '../types';
import { Icon } from './Icon';
import {
  calculateElapsedSeconds,
  clearTimerSnapshot,
  readTimerSnapshot,
  remainingSeconds,
  type TimerSnapshot,
  writeTimerSnapshot,
} from '../utils/timerState';
import { workerTimer } from '../utils/workerTimer';
import { sharpenIntention } from '../utils/geminiAi';
import { InfoTip } from './InfoTip';
import { calculateFinishEstimate } from '../utils/subtaskTime';

interface StageProps {
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
  addSession: (session: KairoSession) => void;
  activeTarget: FocusTarget | null;
  toggleAudio: (isPlaying: boolean) => void | Promise<void>;
  playCompletionCue: () => Promise<void>;
  playTickCue?: (isMajor?: boolean) => void;
  totalPomodoros: number;
  totalFocusMinutes: number;
  todaySummary?: { minutes: number; sessions: number; streak: number };
  onActiveChange?: (active: boolean) => void;
  onOpenCapsule?: () => void;
  nextReward?: string | null;
  startSessionTrigger?: number;
  toggleSessionTrigger?: number;
  onToggleSubtask?: (subtaskId: string) => void;
}

const sessionCopy: Record<SessionType, { label: string; action: string }> = {
  focus: { label: 'Focus', action: 'Start focus' },
  shortBreak: { label: 'Short break', action: 'Start break' },
  longBreak: { label: 'Long break', action: 'Start break' },
};

export const Stage: React.FC<StageProps> = ({
  settings,
  setSettings,
  addSession,
  activeTarget,
  toggleAudio,
  playCompletionCue,
  playTickCue,
  totalPomodoros,
  totalFocusMinutes,
  todaySummary,
  onActiveChange,
  onOpenCapsule,
  nextReward,
  startSessionTrigger,
  toggleSessionTrigger,
  onToggleSubtask,
}) => {
  const [layoutVariation, setLayoutVariation] = useState<StageLayoutVariation>(() => {
    if (typeof window === 'undefined') return 'classic';
    try {
      const saved = localStorage.getItem('kairo_stage_variation');
      if (saved === 'zen' || saved === 'classic' || saved === 'cockpit') return saved;
    } catch {}
    return 'classic';
  });

  const handleVariationChange = (next: StageLayoutVariation) => {
    setLayoutVariation(next);
    try {
      localStorage.setItem('kairo_stage_variation', next);
    } catch {}
  };

  const restoredRef = useRef<TimerSnapshot | null>(readTimerSnapshot());
  const restored = restoredRef.current;
  const [sessionType, setSessionType] = useState<SessionType>(restored?.sessionType ?? 'focus');
  const [timeLeft, setTimeLeft] = useState(() => {
    return restored ? remainingSeconds(restored) : settings.focusDuration * 60;
  });
  const [isActive, setIsActive] = useState(restored?.isActive ?? false);
  const [completionMessage, setCompletionMessage] = useState('');
  const [completionTimestamp, setCompletionTimestamp] = useState(0);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const lastSnapshotWriteRef = useRef(0);
  const sessionIdRef = useRef(restored?.id ?? crypto.randomUUID());
  const deadlineRef = useRef<number | null>(restored?.deadline ?? null);
  const startedAtRef = useRef<number | null>(restored?.startedAt ?? null);
  const sessionDurationRef = useRef<number | null>(restored?.sessionDuration ?? null);
  const sessionTargetRef = useRef<FocusTarget | null>(restored?.target ?? null);

  const [intention, setIntention] = useState(restored?.intention ?? '');
  const [isSharpening, setIsSharpening] = useState(false);
  const sessionIntentionRef = useRef<string>(restored?.intention ?? '');

  // Interrupted / uncompleted session recovery prompt
  const [recoverySession, setRecoverySession] = useState<{
    id: string;
    elapsedMinutes: number;
    sessionDuration: number;
    targetName: string;
    target: FocusTarget | null;
    intention?: string;
    completedWhileAway: boolean;
    timeLeft: number;
  } | null>(() => {
    const snap = restoredRef.current;
    if (!snap || snap.sessionType !== 'focus' || !snap.startedAt) return null;
    const now = Date.now();
    const elapsedSecs = calculateElapsedSeconds(snap, now);
    const elapsedMins = Math.floor(elapsedSecs / 60);
    if (elapsedMins < 1) return null;

    const completedWhileAway = Boolean(snap.isActive && snap.deadline && now >= snap.deadline);
    if (snap.isActive && snap.deadline && now < snap.deadline) {
      // Seamless tab reload during active timer
      return null;
    }

    return {
      id: snap.id,
      elapsedMinutes: elapsedMins,
      sessionDuration: snap.sessionDuration ?? (settings.focusDuration * 60),
      targetName: snap.target ? snap.target.name : 'Quick Focus',
      target: snap.target,
      intention: snap.intention,
      completedWhileAway,
      timeLeft: remainingSeconds(snap, now),
    };
  });

  const handleResumeRecovered = () => {
    if (!recoverySession) return;
    const snap = restoredRef.current;
    const now = Date.now();
    const secs = Math.max(10, recoverySession.timeLeft);
    setTimeLeft(secs);
    deadlineRef.current = now + secs * 1000;
    startedAtRef.current = snap?.startedAt ?? (now - recoverySession.elapsedMinutes * 60000);
    sessionDurationRef.current = recoverySession.sessionDuration;
    sessionTargetRef.current = recoverySession.target;
    sessionIntentionRef.current = recoverySession.intention || '';
    if (recoverySession.intention) setIntention(recoverySession.intention);
    setIsActive(true);
    toggleAudio(true);
    setRecoverySession(null);
  };

  const handleBankRecovered = () => {
    if (!recoverySession) return;
    addSession({
      id: recoverySession.id,
      date: new Date().toISOString(),
      duration: recoverySession.elapsedMinutes,
      completed: recoverySession.completedWhileAway,
      type: 'focus',
      taskId: recoverySession.target?.kind === 'task' ? recoverySession.target.id : undefined,
      taskName: recoverySession.targetName,
      intention: recoverySession.intention,
    });
    clearTimerSnapshot();
    deadlineRef.current = null;
    startedAtRef.current = null;
    sessionDurationRef.current = null;
    sessionTargetRef.current = null;
    sessionIdRef.current = crypto.randomUUID();
    setIsActive(false);
    setTimeLeft(settings.focusDuration * 60);
    setRecoverySession(null);
    setCompletionMessage(`Banked ${recoverySession.elapsedMinutes}m focus session to history.`);
  };

  const handleDiscardRecovered = () => {
    clearTimerSnapshot();
    deadlineRef.current = null;
    startedAtRef.current = null;
    sessionDurationRef.current = null;
    sessionTargetRef.current = null;
    sessionIdRef.current = crypto.randomUUID();
    setIsActive(false);
    setTimeLeft(settings.focusDuration * 60);
    setRecoverySession(null);
  };

  const handleSharpenIntention = async (e: React.MouseEvent) => {
    e.preventDefault();
    const current = intention.trim();
    if (!current || isSharpening) return;
    setIsSharpening(true);
    try {
      const sharpened = await sharpenIntention(current);
      if (sharpened) {
        setIntention(sharpened);
      }
    } catch {
      // Non-blocking
    } finally {
      setIsSharpening(false);
    }
  };

  const durationFor = useCallback(
    (type: SessionType) => {
      if (type === 'focus') {
        if (activeTarget?.kind === 'task' && typeof activeTarget.pomodoroLength === 'number' && activeTarget.pomodoroLength > 0) {
          return activeTarget.pomodoroLength * 60;
        }
        return settings.focusDuration * 60;
      }
      if (type === 'longBreak') return settings.longBreakDuration * 60;
      return settings.shortBreakDuration * 60;
    },
    [settings.focusDuration, settings.longBreakDuration, settings.shortBreakDuration, activeTarget],
  );

  const totalTime = durationFor(sessionType);
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (timeLeft % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }, [timeLeft]);

  const selectSession = (type: SessionType) => {
    if (isActive) return;
    deadlineRef.current = null;
    startedAtRef.current = null;
    sessionDurationRef.current = null;
    sessionTargetRef.current = null;
    sessionIdRef.current = crypto.randomUUID();
    setSessionType(type);
    setTimeLeft(durationFor(type));
  };

  const completeSession = useCallback(() => {
    const completedMinutes = Math.max(1, Math.round((sessionDurationRef.current ?? totalTime) / 60));
    const completedTarget = sessionTargetRef.current ?? activeTarget;

    addSession({
      id: sessionIdRef.current,
      date: new Date().toISOString(),
      duration: completedMinutes,
      completed: true,
      type: sessionType,
      taskId: completedTarget?.kind === 'task' ? completedTarget.id : undefined,
      taskName: completedTarget ? completedTarget.name : 'Quick Focus',
      intention: sessionIntentionRef.current || undefined,
    });

    const nextFocusCount = sessionType === 'focus' ? totalPomodoros + 1 : totalPomodoros;
    const nextType: SessionType =
      sessionType === 'focus'
        ? nextFocusCount % settings.sessionsPerRound === 0
          ? 'longBreak'
          : 'shortBreak'
        : 'focus';
    const autoStart = sessionType === 'focus' && settings.autoStartBreaks;
    const nextDuration = durationFor(nextType);

    setSessionType(nextType);
    setTimeLeft(nextDuration);
    setIsActive(autoStart);
    const nextStartedAt = autoStart ? Date.now() : null;
    deadlineRef.current = autoStart ? nextStartedAt! + nextDuration * 1000 : null;
    startedAtRef.current = nextStartedAt;
    sessionDurationRef.current = autoStart ? nextDuration : null;
    sessionTargetRef.current = null;
    sessionIntentionRef.current = '';
    setIntention('');
    sessionIdRef.current = crypto.randomUUID();
    void playCompletionCue().catch(() => undefined);
    toggleAudio(false);
    const completedLabel = sessionType === 'focus' ? 'Focus session complete.' : 'Break complete.';
    setCompletionMessage(
      `${completedLabel} ${autoStart ? 'Break started automatically.' : 'Choose when to continue.'}`,
    );
    setCompletionTimestamp(Date.now());
    void showSessionNotification(
      sessionType === 'focus' ? 'Focus session complete' : 'Break complete',
      autoStart ? 'Your next break has started.' : 'Choose what to do next in Kairo.',
    );
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(80);
  }, [
    activeTarget,
    addSession,
    durationFor,
    playCompletionCue,
    sessionType,
    settings.autoStartBreaks,
    settings.sessionsPerRound,
    toggleAudio,
    totalPomodoros,
    totalTime,
  ]);

  useEffect(() => {
    if (!startedAtRef.current) return;
    const snapshot: TimerSnapshot = {
      version: 1,
      id: sessionIdRef.current,
      sessionType,
      timeLeft,
      isActive,
      deadline: deadlineRef.current,
      startedAt: startedAtRef.current,
      sessionDuration: sessionDurationRef.current,
      target: sessionTargetRef.current,
      intention: sessionIntentionRef.current,
      lastSavedAt: Date.now(),
    };
    const now = Date.now();
    if (isActive && now - lastSnapshotWriteRef.current < 15000) return;
    writeTimerSnapshot(snapshot);
    lastSnapshotWriteRef.current = now;
  }, [isActive, sessionType, timeLeft]);

  useEffect(() => {
    const onBeforeUnload = () => {
      if (!startedAtRef.current) return;
      const snapshot: TimerSnapshot = {
        version: 1,
        id: sessionIdRef.current,
        sessionType,
        timeLeft,
        isActive,
        deadline: deadlineRef.current,
        startedAt: startedAtRef.current,
        sessionDuration: sessionDurationRef.current,
        target: sessionTargetRef.current,
        intention: sessionIntentionRef.current,
        lastSavedAt: Date.now(),
      };
      writeTimerSnapshot(snapshot);
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isActive, sessionType, timeLeft]);

  useEffect(() => {
    onActiveChange?.(isActive);
  }, [isActive, onActiveChange]);

  useEffect(() => {
    if (!isActive) return;
    const timerId = workerTimer.setInterval(() => {
      const deadline = deadlineRef.current;
      if (!deadline) return;
      setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    return () => workerTimer.clearInterval(timerId);
  }, [isActive]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (isActive) {
      const typeLabel = sessionType === 'focus' ? 'Focus' : 'Break';
      document.title = `${formattedTime} • ${typeLabel} | Kairo`;
    } else if (startedAtRef.current && timeLeft > 0 && timeLeft < totalTime) {
      document.title = `(${formattedTime}) Paused | Kairo`;
    } else {
      document.title = 'Kairo — Make Space for One Thing';
    }
  }, [formattedTime, isActive, sessionType, timeLeft, totalTime]);

  useEffect(() => {
    if (isActive && timeLeft === 0) completeSession();
  }, [completeSession, isActive, timeLeft]);

  useEffect(() => {
    if (!isActive && !startedAtRef.current) setTimeLeft(durationFor(sessionType));
  }, [durationFor, isActive, sessionType]);

  useEffect(() => {
    if (!settings.deepFocusMode || !isActive) return;
    const onVisibilityChange = () => {
      if (!document.hidden) return;
      if (deadlineRef.current) {
        setTimeLeft(Math.max(0, Math.ceil((deadlineRef.current - Date.now()) / 1000)));
      }
      deadlineRef.current = null;
      setIsActive(false);
      toggleAudio(false);
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [isActive, settings.deepFocusMode, toggleAudio]);

  const toggleTimer = () => {
    if (isActive) {
      deadlineRef.current = null;
      setIsActive(false);
      toggleAudio(false);
      return;
    }

    const now = Date.now();
    if (!startedAtRef.current) {
      sessionIdRef.current = crypto.randomUUID();
      startedAtRef.current = now;
      sessionDurationRef.current = timeLeft;
      sessionTargetRef.current = activeTarget;
      sessionIntentionRef.current = intention.trim().slice(0, 200);
    }
    deadlineRef.current = now + timeLeft * 1000;
    setIsActive(true);
    if (sessionType === 'focus') toggleAudio(true);
  };

  useEffect(() => {
    if (!completionMessage || !toastRef.current) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        toastRef.current,
        { opacity: 0, y: 10, scale: 0.95 },
        { opacity: 1, y: 0, scale: 1, duration: 0.35, ease: 'back.out(1.4)' },
      );
    }, toastRef);

    const timer = setTimeout(() => {
      setCompletionMessage('');
    }, 6000);

    return () => {
      ctx.revert();
      clearTimeout(timer);
    };
  }, [completionMessage]);

  const prevStartTriggerRef = useRef<number | null>(null);
  useEffect(() => {
    if (startSessionTrigger && startSessionTrigger !== prevStartTriggerRef.current) {
      prevStartTriggerRef.current = startSessionTrigger;
      if (!isActive) {
        toggleTimer();
      }
    }
  }, [startSessionTrigger, isActive]);

  const prevToggleTriggerRef = useRef<number | null>(null);
  useEffect(() => {
    if (toggleSessionTrigger && toggleSessionTrigger !== prevToggleTriggerRef.current) {
      prevToggleTriggerRef.current = toggleSessionTrigger;
      toggleTimer();
    }
  }, [toggleSessionTrigger]);

  // Keep session target in sync if user changes target while focusing
  useEffect(() => {
    if (activeTarget && isActive) {
      sessionTargetRef.current = activeTarget;
    }
  }, [activeTarget, isActive]);

  const resetTimer = () => {
    const total = sessionDurationRef.current ?? totalTime;
    const elapsedSeconds = Math.max(0, total - timeLeft);
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);

    if (sessionType === 'focus' && elapsedMinutes >= 1 && startedAtRef.current) {
      const completedTarget = sessionTargetRef.current ?? activeTarget;
      addSession({
        id: sessionIdRef.current,
        date: new Date().toISOString(),
        duration: elapsedMinutes,
        completed: false,
        type: 'focus',
        taskId: completedTarget?.kind === 'task' ? completedTarget.id : undefined,
        taskName: completedTarget ? completedTarget.name : 'Quick Focus',
        intention: sessionIntentionRef.current || undefined,
      });
      setCompletionMessage(`Banked ${elapsedMinutes}m focus time before reset.`);
    }

    deadlineRef.current = null;
    startedAtRef.current = null;
    sessionDurationRef.current = null;
    sessionTargetRef.current = null;
    sessionIdRef.current = crypto.randomUUID();
    setIsActive(false);
    setTimeLeft(totalTime);
    toggleAudio(false);
    clearTimerSnapshot();
  };

  const skipBreak = () => {
    if (sessionType === 'focus') return;
    deadlineRef.current = null;
    startedAtRef.current = null;
    sessionDurationRef.current = null;
    sessionTargetRef.current = null;
    sessionIdRef.current = crypto.randomUUID();
    setSessionType('focus');
    setTimeLeft(durationFor('focus'));
    setIsActive(false);
    toggleAudio(false);
    clearTimerSnapshot();
    setCompletionMessage('Break skipped. Focus is ready when you are.');
  };

  const updateDuration = (
    key: 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration',
    value: number,
  ) => {
    const max = key === 'focusDuration' ? 180 : key === 'shortBreakDuration' ? 60 : 120;
    if (!Number.isFinite(value)) return;
    setSettings({ ...settings, [key]: Math.round(Math.min(max, Math.max(1, value))) });
  };

  const extendTimer = () => {
    if (sessionType !== 'focus') return;
    const bumped = Math.min(180 * 60, timeLeft + 5 * 60);
    setTimeLeft(bumped);
    if (isActive && deadlineRef.current) {
      deadlineRef.current += 5 * 60 * 1000;
      sessionDurationRef.current = (sessionDurationRef.current ?? totalTime) + 5 * 60;
    } else if (!startedAtRef.current) {
      updateDuration('focusDuration', Math.round(bumped / 60));
    }
  };

  const toggleTimerRef = useRef(toggleTimer);
  const resetTimerRef = useRef(resetTimer);
  const skipBreakRef = useRef(skipBreak);
  const extendTimerRef = useRef(extendTimer);
  const selectSessionRef = useRef(selectSession);
  toggleTimerRef.current = toggleTimer;
  resetTimerRef.current = resetTimer;
  skipBreakRef.current = skipBreak;
  extendTimerRef.current = extendTimer;
  selectSessionRef.current = selectSession;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = event.key.toLowerCase();
      if (event.key === ' ') {
        event.preventDefault();
        toggleTimerRef.current();
        return;
      }
      if (key === 'r') {
        event.preventDefault();
        resetTimerRef.current();
        return;
      }
      if (key === 's') {
        event.preventDefault();
        skipBreakRef.current();
        return;
      }
      if (key === 'e') {
        event.preventDefault();
        extendTimerRef.current();
        return;
      }
      if (event.key === '1') {
        event.preventDefault();
        selectSessionRef.current('focus');
        return;
      }
      if (event.key === '2') {
        event.preventDefault();
        selectSessionRef.current('shortBreak');
        return;
      }
      if (event.key === '3') {
        event.preventDefault();
        selectSessionRef.current('longBreak');
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const prevTargetIdRef = useRef<string | null>(null);
  useEffect(() => {
    const currentId = activeTarget?.id ?? null;
    if (currentId !== prevTargetIdRef.current) {
      prevTargetIdRef.current = currentId;
      // If idle, in focus mode, and not mid-session, adapt timer duration to activeTarget or default
      if (!isActive && !startedAtRef.current && sessionType === 'focus') {
        const nextSecs = activeTarget?.kind === 'task' && activeTarget.pomodoroLength
          ? activeTarget.pomodoroLength * 60
          : settings.focusDuration * 60;
        setTimeLeft(nextSecs);
      }
    }
  }, [activeTarget, isActive, sessionType, settings.focusDuration]);

  const activeTargetRounds = activeTarget?.kind === 'task' ? (activeTarget.targetRounds || 4) : null;
  const activePomoLen = activeTarget?.kind === 'task' ? (activeTarget.pomodoroLength || settings.focusDuration || 25) : settings.focusDuration;
  const activeDoneRounds = activeTarget?.kind === 'task' ? Math.floor((activeTarget.timeSpent || 0) / activePomoLen) : null;

  const activeTaskFinish = useMemo(() => {
    if (activeTarget?.kind !== 'task') return null;
    return calculateFinishEstimate([activeTarget], settings);
  }, [activeTarget, settings]);

  const targetLabel =
    activeTarget?.kind === 'task'
      ? activeTarget.name
      : activeTarget?.kind === 'project'
      ? activeTarget.name
      : 'Quick Focus';

  const breakChoices: Array<{ min: number; label: string }> = [
    { min: 5, label: '5m' },
    { min: 10, label: '10m' },
    { min: 15, label: '15m' },
  ];

  const renderDial = () => (
    <div className="k-hero-dial-wrapper">
      <AnalogDial
        totalTime={totalTime}
        timeLeft={timeLeft}
        formatted={formattedTime}
        isActive={isActive}
        disabled={isActive || Boolean(startedAtRef.current)}
        completionTimestamp={completionTimestamp}
        label={sessionType === 'focus' ? 'Focus duration' : sessionType === 'shortBreak' ? 'Short break duration' : 'Long break duration'}
        onTick={playTickCue}
        onSet={mins => {
          const seconds = Math.max(60, mins * 60);
          setTimeLeft(seconds);
          if (sessionType === 'focus') {
            updateDuration('focusDuration', Math.min(180, Math.max(1, Math.round(seconds / 60))));
          } else if (sessionType === 'shortBreak') {
            updateDuration('shortBreakDuration', Math.min(60, Math.max(1, Math.round(seconds / 60))));
          } else if (sessionType === 'longBreak') {
            updateDuration('longBreakDuration', Math.min(120, Math.max(1, Math.round(seconds / 60))));
          }
        }}
      />
    </div>
  );

  const renderModePills = () => (
    <div className="k-mode-pill-bar" role="tablist" aria-label="Session mode">
      {(['focus', 'shortBreak', 'longBreak'] as const).map(type => (
        <button
          key={type}
          role="tab"
          aria-selected={sessionType === type}
          disabled={isActive}
          className={`k-mode-pill ${sessionType === type ? 'active' : ''}`}
          onClick={() => selectSession(type)}
        >
          {sessionCopy[type].label}
        </button>
      ))}
      <InfoTip title="Focus & Break Modes" position="bottom">
        <p style={{ margin: '0 0 4px' }}><b>Focus:</b> 25m uninterrupted deep work round.</p>
        <p style={{ margin: '0 0 4px' }}><b>Short Break:</b> 5m restorative breath recharge.</p>
        <p style={{ margin: 0 }}><b>Long Break:</b> 15-20m deep reset every 4 rounds.</p>
      </InfoTip>
    </div>
  );

  const renderPrimaryButton = () => (
    <div className="k-dock-primary-row">
      <button
        onClick={toggleTimer}
        className={`k-btn-hero ${isActive ? 'is-active' : ''}`}
        aria-label={isActive ? 'Pause timer' : 'Start timer'}
      >
        <span className="k-hero-btn-icon">
          {isActive ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="4" width="4" height="16" rx="1.5" />
              <rect x="14" y="4" width="4" height="16" rx="1.5" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 4.5v15l12-7.5-12-7.5z" />
            </svg>
          )}
        </span>
        <span className="k-hero-btn-label">
          {isActive
            ? 'Pause'
            : sessionType === 'focus'
            ? 'Start Focus'
            : 'Start Break'}
        </span>
        <kbd className="k-hero-kbd">Space</kbd>
      </button>
    </div>
  );

  const renderSecondaryControls = () => (
    <div className="k-dock-secondary-row">
      {sessionType !== 'focus' && (
        <button onClick={skipBreak} className="k-btn-secondary" aria-label="Skip break">
          <span>Skip break</span>
          <kbd>S</kbd>
        </button>
      )}

      <button onClick={resetTimer} className="k-btn-secondary" aria-label="Reset timer">
        <span>Reset</span>
        <kbd>R</kbd>
      </button>

      {sessionType === 'focus' && (
        <button onClick={extendTimer} className="k-btn-secondary" aria-label="Extend 5 minutes">
          <span>+5m</span>
          <kbd>E</kbd>
        </button>
      )}
    </div>
  );

  const renderToast = () => (
    completionMessage ? (
      <div ref={toastRef} className="k-completion-toast" role="status">
        <span className="k-completion-dot" aria-hidden="true" />
        <span className="k-completion-text">{completionMessage}</span>
        <button
          type="button"
          className="k-completion-dismiss"
          onClick={() => setCompletionMessage('')}
          aria-label="Dismiss message"
        >
          ×
        </button>
      </div>
    ) : null
  );

  const renderTargetContext = () => (
    <div className="k-target-container">
      <div className="k-target-badge">
        <span className="k-target-icon">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6">
            <circle cx="8" cy="8" r="6" />
            <circle cx="8" cy="8" r="2" fill="currentColor" />
          </svg>
        </span>
        <span className="k-target-text" title={targetLabel}>
          {targetLabel}
        </span>
        {activeTarget?.kind === 'task' && activeTargetRounds !== null && (
          <span
            className={`k-target-pomo-chip ${activeDoneRounds! >= activeTargetRounds ? 'is-complete' : ''}`}
            title={`Pomodoro Target: ${activeDoneRounds} of ${activeTargetRounds} completed (${activePomoLen}m each)`}
          >
            🍅 {activeDoneRounds}/{activeTargetRounds} <small>({activePomoLen}m)</small>
          </span>
        )}
        {activeTaskFinish && activeTaskFinish.remainingPomos > 0 && (
          <span
            className="k-target-finish-pill"
            title={`Finish at ~${activeTaskFinish.finishTimeFormatted} (${activeTaskFinish.hoursFormatted} remaining incl. breaks)`}
          >
            Finish ~{activeTaskFinish.finishTimeFormatted}
          </span>
        )}
        {activeTarget?.kind === 'task' && !isActive && (
          <button
            type="button"
            className="k-target-start-btn"
            onClick={toggleTimer}
            title="Start countdown on this task now"
            aria-label="Start focus countdown on this task"
          >
            ▶ Start
          </button>
        )}
        {activeTarget?.kind === 'task' && isActive && (
          <span className="k-target-active-pill" title="Clock is actively counting down on this task">
            <span className="k-target-live-dot" aria-hidden="true" />
            <span>Counting down</span>
          </span>
        )}
        {!activeTarget && <span className="k-target-hint">Untracked</span>}
      </div>

      {sessionType === 'focus' && (
        <div className="k-intention-zen">
          <span className="k-intention-prefix">Goal</span>
          <input
            type="text"
            value={isActive ? sessionIntentionRef.current : intention}
            onChange={e => setIntention(e.target.value)}
            disabled={isActive}
            placeholder="What is your single focus for this session?"
            maxLength={200}
            aria-label="Session intention"
          />
          {!isActive && intention.trim().length > 2 && (
            <button
              type="button"
              className={`k-ai-sharpen-btn ${isSharpening ? 'is-loading' : ''}`}
              onClick={handleSharpenIntention}
              disabled={isSharpening}
              title="Sharpen this intention into an actionable 25-min goal (Chrome Gemini Nano or Cloud)"
              aria-label="Sharpen intention with AI"
            >
              {isSharpening ? (
                <span className="k-ai-spinner" aria-hidden="true" />
              ) : (
                <span className="k-ai-sparkle" aria-hidden="true">✨</span>
              )}
              <span>{isSharpening ? 'Sharpening...' : 'Sharpen'}</span>
            </button>
          )}
          {onOpenCapsule && !isActive && (
            <button
              type="button"
              className="k-intention-capsule-btn"
              onClick={onOpenCapsule}
              title="Seal a message and reward treat for your future self"
              aria-label="Time Capsule treat"
            >
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4a1 1 0 011-1h10a1 1 0 011 1v8a1 1 0 01-1 1H3a1 1 0 01-1-1V4z" />
                <path d="M2 5l6 4 6-4" />
              </svg>
              <span>Treat</span>
            </button>
          )}
        </div>
      )}

      {nextReward && onOpenCapsule && (
        <button
          type="button"
          className="k-stage-reward-pill"
          onClick={onOpenCapsule}
          title="Time Capsule active — click to inspect sealed reward"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="7" width="10" height="7" rx="1.5" />
            <path d="M5 7V4.5a3 3 0 016 0V7" />
          </svg>
          <span>Treat waiting: <b>{nextReward}</b></span>
        </button>
      )}
    </div>
  );

  const renderMetaStrip = () => (
    <div className="k-dock-meta-strip">
      <div className="k-meta-group">
        <span className="k-meta-subtle-label">Break:</span>
        <div className="k-chips-compact" role="group" aria-label="Break duration">
          {breakChoices.map(choice => (
            <button
              key={choice.min}
              className={`k-chip-compact ${settings.shortBreakDuration === choice.min ? 'active' : ''}`}
              aria-pressed={settings.shortBreakDuration === choice.min}
              onClick={() => {
                updateDuration('shortBreakDuration', choice.min);
                if (sessionType === 'shortBreak' && !isActive && !startedAtRef.current) {
                  setTimeLeft(choice.min * 60);
                }
              }}
            >
              {choice.label}
            </button>
          ))}

          <div className="k-break-stepper" title="Custom break duration stepper">
            <button
              type="button"
              className="k-break-stepper-btn"
              disabled={isActive || settings.shortBreakDuration <= 1}
              onClick={() => {
                const next = Math.max(1, settings.shortBreakDuration - 1);
                updateDuration('shortBreakDuration', next);
                if (sessionType === 'shortBreak' && !isActive && !startedAtRef.current) {
                  setTimeLeft(next * 60);
                }
              }}
              aria-label="Decrease break duration by 1 minute"
            >
              -
            </button>
            <span className="k-break-stepper-value" title="Custom break duration">
              {settings.shortBreakDuration}m
            </span>
            <button
              type="button"
              className="k-break-stepper-btn"
              disabled={isActive || settings.shortBreakDuration >= 60}
              onClick={() => {
                const next = Math.min(60, settings.shortBreakDuration + 1);
                updateDuration('shortBreakDuration', next);
                if (sessionType === 'shortBreak' && !isActive && !startedAtRef.current) {
                  setTimeLeft(next * 60);
                }
              }}
              aria-label="Increase break duration by 1 minute"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="k-meta-divider" aria-hidden="true" />

      <button
        className="k-toggle-compact"
        aria-pressed={settings.autoStartBreaks}
        onClick={() => setSettings({ ...settings, autoStartBreaks: !settings.autoStartBreaks })}
      >
        <span className="k-toggle-track" aria-hidden="true" />
        <span>Auto-start breaks</span>
      </button>

      <div className="k-meta-divider" aria-hidden="true" />

      <div className="k-momentum-stat">
        <span className="k-momentum-dot" />
        <span>
          Today: <b>{todaySummary?.sessions ?? 0}</b>{' '}
          {(todaySummary?.sessions ?? 0) === 1 ? 'session' : 'sessions'} ({todaySummary?.minutes ?? 0}m)
        </span>
      </div>
    </div>
  );

  return (
    <div className={`k-stage-zen is-variation-${layoutVariation}`}>
      {/* 1. Recovery Banner if unsaved/interrupted session exists */}
      {recoverySession && (
        <div className="k-recovery-banner" role="alert">
          <div className="k-recovery-info">
            <span className="k-recovery-dot" aria-hidden="true" />
            <span className="k-recovery-text">
              {recoverySession.completedWhileAway ? (
                <>
                  Focus completed while away: <b>{recoverySession.elapsedMinutes}m</b> on <i>{recoverySession.targetName}</i>
                </>
              ) : (
                <>
                  Unsaved session: <b>{recoverySession.elapsedMinutes}m elapsed</b> on <i>{recoverySession.targetName}</i>
                </>
              )}
            </span>
          </div>
          <div className="k-recovery-actions">
            {!recoverySession.completedWhileAway && (
              <button
                type="button"
                className="k-recovery-btn primary"
                onClick={handleResumeRecovered}
                title="Resume this session"
              >
                ▶ Resume
              </button>
            )}
            <button
              type="button"
              className="k-recovery-btn bank"
              onClick={handleBankRecovered}
              title="Bank elapsed time to task and stats"
            >
              💾 Bank {recoverySession.elapsedMinutes}m
            </button>
            <button
              type="button"
              className="k-recovery-btn discard"
              onClick={handleDiscardRecovered}
              title="Discard session"
              aria-label="Discard session"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Stage Toolbar: 3 Focus Layout Variations Switcher */}
      <div className="k-stage-toolbar">
        <div className="k-stage-variation-switcher" role="radiogroup" aria-label="Focus layout variation">
          <button
            type="button"
            role="radio"
            aria-checked={layoutVariation === 'zen'}
            className={`k-var-btn ${layoutVariation === 'zen' ? 'is-active' : ''}`}
            onClick={() => handleVariationChange('zen')}
            title="Zen Mode: Pure analog dial, minimal distractions"
          >
            <span className="k-var-icon">☯</span>
            <span className="k-var-label">Zen</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={layoutVariation === 'classic'}
            className={`k-var-btn ${layoutVariation === 'classic' ? 'is-active' : ''}`}
            onClick={() => handleVariationChange('classic')}
            title="Classic Mode: Balanced daily driver with mode tabs & task dock"
          >
            <span className="k-var-icon">⛩</span>
            <span className="k-var-label">Classic</span>
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={layoutVariation === 'cockpit'}
            className={`k-var-btn ${layoutVariation === 'cockpit' ? 'is-active' : ''}`}
            onClick={() => handleVariationChange('cockpit')}
            title="Cockpit Mode: High-information deck with live subtasks & pacing"
          >
            <span className="k-var-icon">☵</span>
            <span className="k-var-label">Cockpit</span>
          </button>
        </div>
      </div>

      {/* VARIATION 1: ZEN (Minimalist Pure Analog Focus) */}
      {layoutVariation === 'zen' && (
        <>
          <div className="k-zen-focus-pill">
            <span className="k-zen-mode-tag">{sessionCopy[sessionType].label}</span>
            <span className="k-zen-sep">•</span>
            <span className="k-zen-target-title" title={targetLabel}>{targetLabel}</span>
            {activeTarget?.kind === 'task' && activeTargetRounds !== null && (
              <span className="k-zen-pomo-dot" title={`Pomodoro ${activeDoneRounds}/${activeTargetRounds}`}>
                🍅 {activeDoneRounds}/{activeTargetRounds}
              </span>
            )}
            {nextReward && onOpenCapsule && (
              <button
                type="button"
                className="k-zen-reward-btn"
                onClick={onOpenCapsule}
                title={`Treat sealed: ${nextReward}`}
              >
                🎁
              </button>
            )}
          </div>

          {renderDial()}
          {renderToast()}

          <div className="k-zen-controls">
            {renderPrimaryButton()}
            <button onClick={resetTimer} className="k-btn-secondary" aria-label="Reset timer">
              <span>Reset</span>
              <kbd>R</kbd>
            </button>
            {sessionType !== 'focus' && (
              <button onClick={skipBreak} className="k-btn-secondary" aria-label="Skip break">
                <span>Skip</span>
                <kbd>S</kbd>
              </button>
            )}
          </div>
        </>
      )}

      {/* VARIATION 2: CLASSIC (Harmonious Workstation) */}
      {layoutVariation === 'classic' && (
        <>
          {renderModePills()}
          {renderTargetContext()}
          {renderDial()}
          <div className="k-control-dock">
            {renderToast()}
            {renderPrimaryButton()}
            {renderSecondaryControls()}
            {renderMetaStrip()}
          </div>
        </>
      )}

      {/* VARIATION 3: COCKPIT (Deep Study / High-Information Deck) */}
      {layoutVariation === 'cockpit' && (
        <div className="k-cockpit-grid">
          {/* Left Column: Target Intelligence */}
          <div className="k-cockpit-card k-cockpit-left">
            <div className="k-cockpit-card-title">
              <span>Target Intelligence</span>
              {activeTarget?.kind === 'task' && <span className="k-target-live-dot" />}
            </div>
            <div className="k-cockpit-target-name">{targetLabel}</div>
            {activeTarget?.kind === 'task' && activeTargetRounds !== null && (
              <div className="k-cockpit-pacing-pill">
                🍅 {activeDoneRounds} / {activeTargetRounds} completed ({activePomoLen}m)
              </div>
            )}
            {activeTaskFinish && activeTaskFinish.remainingPomos > 0 && (
              <div className="k-cockpit-pacing-pill">
                ⏱ Finish ~{activeTaskFinish.finishTimeFormatted} ({activeTaskFinish.hoursFormatted} left)
              </div>
            )}

            {/* Subtask checklist preview */}
            {activeTarget?.kind === 'task' && activeTarget.subTasks && activeTarget.subTasks.length > 0 && (
              <div className="k-cockpit-subtasks-preview custom-scrollbar">
                <span className="k-cockpit-sub-title">Subtasks:</span>
                {activeTarget.subTasks.map(st => (
                  <label key={st.id} className={`k-cockpit-subtask-item ${st.completed ? 'is-done' : ''}`}>
                    <input
                      type="checkbox"
                      checked={st.completed}
                      onChange={() => onToggleSubtask?.(st.id)}
                    />
                    <span className="k-cockpit-subtask-text">{st.name}</span>
                    {st.estimatedMinutes && <small className="k-cockpit-sub-est">{st.estimatedMinutes}m</small>}
                  </label>
                ))}
              </div>
            )}

            {/* Intention in cockpit */}
            {sessionType === 'focus' && (
              <div className="k-cockpit-intention-row">
                <span className="k-intention-prefix">Goal:</span>
                <input
                  type="text"
                  value={isActive ? sessionIntentionRef.current : intention}
                  onChange={e => setIntention(e.target.value)}
                  disabled={isActive}
                  placeholder="Session focus..."
                  maxLength={200}
                />
              </div>
            )}
          </div>

          {/* Center Column: Hero Dial & Primary Transport */}
          <div className="k-cockpit-center">
            {renderModePills()}
            {renderDial()}
            {renderToast()}
            {renderPrimaryButton()}
          </div>

          {/* Right Column: Telemetry & Secondary Controls */}
          <div className="k-cockpit-card k-cockpit-right">
            <div className="k-cockpit-card-title">
              <span>Focus Telemetry</span>
              <span>📊</span>
            </div>
            <div className="k-cockpit-stat-item">
              <b>{todaySummary?.minutes ?? 0}m</b> focused today
            </div>
            <div className="k-cockpit-stat-item">
              <b>{todaySummary?.streak ?? 0}</b> day streak 🔥
            </div>
            <div className="k-cockpit-stat-item">
              <b>{totalPomodoros}</b> total pomodoros banked
            </div>

            {nextReward && onOpenCapsule && (
              <button
                type="button"
                className="k-stage-reward-pill"
                onClick={onOpenCapsule}
                title="Time Capsule active"
              >
                🎁 <b>{nextReward}</b>
              </button>
            )}

            <div className="k-cockpit-sec-actions">
              {renderSecondaryControls()}
            </div>
          </div>
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {completionMessage}
      </p>
    </div>
  );
};

/* Analog dial with double-bezel concentric ring design, tactile dragging,
   mechanical haptic detents, and clean Swiss typography */
type DialProps = {
  totalTime: number;
  timeLeft: number;
  formatted: string;
  isActive: boolean;
  disabled: boolean;
  completionTimestamp?: number;
  onSet: (minutes: number) => void;
  onTick?: (isMajor?: boolean) => void;
  label?: string;
};

const AnalogDial: React.FC<DialProps> = ({
  totalTime,
  timeLeft,
  formatted,
  isActive,
  disabled,
  completionTimestamp,
  onSet,
  onTick,
  label,
}) => {
  const R = 130;
  const CENTER = 160;
  const CIRC = 2 * Math.PI * R;
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dialRootRef = useRef<HTMLDivElement | null>(null);
  const handleGroupRef = useRef<SVGGElement | null>(null);

  const minutesRemaining = timeLeft / 60;
  const currentMinutes = Math.max(1, Math.round(timeLeft / 60));
  const prevMinutesRef = useRef<number | null>(null);

  useEffect(() => {
    if (prevMinutesRef.current !== null && prevMinutesRef.current !== currentMinutes) {
      const isMajor = currentMinutes % 5 === 0;
      onTick?.(isMajor);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate?.(isMajor ? [6, 16, 6] : 3);
        } catch {
          // Ignored
        }
      }
    }
    prevMinutesRef.current = currentMinutes;
  }, [currentMinutes, onTick]);

  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActiveRef.current && dialRootRef.current) {
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        gsap.fromTo(
          dialRootRef.current,
          { scale: 1 },
          { scale: 1.025, duration: 0.22, ease: 'power2.out', yoyo: true, repeat: 1 },
        );
      }
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Celebratory breath animation on session completion
  useEffect(() => {
    if (!completionTimestamp || !dialRootRef.current) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      const tl = gsap.timeline();
      tl.to(dialRootRef.current, {
        scale: 1.035,
        duration: 0.35,
        ease: 'back.out(1.4)',
      }).to(dialRootRef.current, {
        scale: 1,
        duration: 0.45,
        ease: 'power2.out',
      });
    }, dialRootRef);

    return () => ctx.revert();
  }, [completionTimestamp]);

  // Tactile handle expansion on drag interaction
  useEffect(() => {
    if (!handleGroupRef.current) return;
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      if (dragging) {
        gsap.to('.k-dial-handle-outer', { scale: 1.22, duration: 0.18, ease: 'back.out(2)', transformOrigin: '50% 50%' });
        gsap.to('.k-dial-handle-inner', { scale: 1.35, duration: 0.18, ease: 'power2.out', transformOrigin: '50% 50%' });
      } else {
        gsap.to('.k-dial-handle-outer', { scale: 1, duration: 0.22, ease: 'power2.out', transformOrigin: '50% 50%' });
        gsap.to('.k-dial-handle-inner', { scale: 1, duration: 0.22, ease: 'power2.out', transformOrigin: '50% 50%' });
      }
    }, handleGroupRef);

    return () => ctx.revert();
  }, [dragging]);

  const dialFrac = Math.max(0, Math.min(1, minutesRemaining / 60));
  const arcLen = CIRC * dialFrac;
  const arcGap = CIRC - arcLen;
  const angleRad = -Math.PI / 2 + dialFrac * 2 * Math.PI;
  const handleX = CENTER + R * Math.cos(angleRad);
  const handleY = CENTER + R * Math.sin(angleRad);

  const setFromPointer = useCallback(
    (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 320 - CENTER;
      const y = ((clientY - rect.top) / rect.height) * 320 - CENTER;
      let angle = Math.atan2(y, x) + Math.PI / 2;
      if (angle < 0) angle += 2 * Math.PI;
      const minutes = Math.max(1, Math.round((angle / (2 * Math.PI)) * 60));
      onSet(minutes);
    },
    [onSet],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => setFromPointer(e.clientX, e.clientY);
    const onUp = () => setDragging(false);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, setFromPointer]);

  const beginDrag = (e: React.PointerEvent<Element>) => {
    if (disabled) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setDragging(true);
    setFromPointer(e.clientX, e.clientY);
  };

  const ticks = Array.from({ length: 60 }, (_, i) => i);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const map: Record<string, number> = {
      ArrowRight: 1,
      ArrowUp: 5,
      ArrowLeft: -1,
      ArrowDown: -5,
    };
    if (e.key in map) {
      e.preventDefault();
      onSet(Math.max(1, Math.min(60, currentMinutes + map[e.key])));
    } else if (e.key === 'Home') {
      e.preventDefault();
      onSet(1);
    } else if (e.key === 'End') {
      e.preventDefault();
      onSet(60);
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      onSet(Math.min(60, currentMinutes + 10));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      onSet(Math.max(1, currentMinutes - 10));
    }
  };

  return (
    <div
      ref={dialRootRef}
      className={`k-dial-zen ${isActive ? 'is-active' : ''} ${dragging ? 'is-dragging' : ''}`}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label={label ?? 'Focus duration'}
      aria-valuemin={1}
      aria-valuemax={60}
      aria-valuenow={currentMinutes}
      aria-valuetext={`${currentMinutes} minutes`}
      aria-disabled={disabled}
      onKeyDown={onKeyDown}
    >
      <svg ref={svgRef} viewBox="0 0 320 320" style={{ touchAction: 'none' }}>
        <defs>
          <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--shu)" />
            <stop offset="100%" stopColor="var(--shu-hover)" />
          </linearGradient>
          <radialGradient id="dialInnerShade" cx="50%" cy="50%" r="50%">
            <stop offset="60%" stopColor="var(--washi-card)" stopOpacity="0.4" />
            <stop offset="100%" stopColor="var(--stone-1)" stopOpacity="0.8" />
          </radialGradient>
          <filter id="dialGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="2" stdDeviation="5" floodColor="var(--shu)" floodOpacity="0.3" />
          </filter>
        </defs>

        {/* Outer Knurled Bezel Enclosure */}
        <circle cx={CENTER} cy={CENTER} r={R + 20} className="k-dial-outer-bezel" />
        <circle cx={CENTER} cy={CENTER} r={R + 19} className="k-dial-outer-rim" strokeDasharray="1.5, 4.5" />
        <circle cx={CENTER} cy={CENTER} r={R - 16} className="k-dial-inner-groove" />

        {/* Hitbox */}
        <circle
          className="k-dial-hitbox"
          cx={CENTER}
          cy={CENTER}
          r={R + 24}
          onPointerDown={beginDrag}
          style={{ pointerEvents: disabled ? 'none' : 'auto' }}
        />

        {/* Ticks with Illuminated Active Passage */}
        {ticks.map(i => {
          const isMajor = i % 15 === 0;
          const isMinor = i % 5 === 0;
          const a = -Math.PI / 2 + (i / 60) * 2 * Math.PI;
          const outer = R + 9;
          const inner = isMajor ? R - 4 : isMinor ? R + 1 : R + 4;
          const isPassed = (i / 60) <= dialFrac + 0.001;
          return (
            <line
              key={i}
              className={`k-dial-tick ${isMajor ? 'major' : isMinor ? 'minor' : 'subtle'} ${isPassed ? 'passed' : ''}`}
              x1={CENTER + Math.cos(a) * outer}
              y1={CENTER + Math.sin(a) * outer}
              x2={CENTER + Math.cos(a) * inner}
              y2={CENTER + Math.sin(a) * inner}
              strokeWidth={isMajor ? 1.8 : isMinor ? 1.3 : 0.8}
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
          );
        })}

        {/* Quadrant labels */}
        {[
          { text: '0', x: CENTER, y: CENTER - R - 18, passed: true },
          { text: '15', x: CENTER + R + 22, y: CENTER + 4, passed: dialFrac >= 0.25 },
          { text: '30', x: CENTER, y: CENTER + R + 24, passed: dialFrac >= 0.5 },
          { text: '45', x: CENTER - R - 22, y: CENTER + 4, passed: dialFrac >= 0.75 },
        ].map(l => (
          <text
            key={l.text}
            className={`k-dial-tick-label ${l.passed ? 'passed' : ''}`}
            x={l.x}
            y={l.y}
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            {l.text}
          </text>
        ))}

        {/* Track Ring */}
        <circle
          className="k-dial-track"
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          strokeWidth={4.5}
          style={{ pointerEvents: 'none' }}
        />

        {/* Active Progress Arc */}
        <circle
          className="k-dial-arc"
          cx={CENTER}
          cy={CENTER}
          r={R}
          fill="none"
          stroke="url(#dialGradient)"
          strokeWidth={5.5}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcGap}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          filter="url(#dialGlow)"
          style={{ pointerEvents: 'none' }}
        />

        {/* Center Digital Display */}
        <text
          className="k-dial-time"
          x={CENTER}
          y={CENTER + 16}
          textAnchor="middle"
          role="timer"
          aria-label={`${formatted} remaining`}
          style={{ pointerEvents: 'none' }}
        >
          {formatted}
        </text>

        {/* Complication Sub-label */}
        <text
          className="k-dial-sub-label"
          x={CENTER}
          y={CENTER + 36}
          textAnchor="middle"
          style={{ pointerEvents: 'none' }}
        >
          {isActive ? 'FOCUSING' : dragging ? 'DRAG TO SET' : 'POMODORO'}
        </text>

        {/* Interactive Tactile Handle */}
        <g
          ref={handleGroupRef}
          className={`k-dial-handle-group ${dragging ? 'is-dragging' : ''}`}
          style={{
            transform: `translate(${handleX}px, ${handleY}px)`,
            cursor: disabled ? 'default' : dragging ? 'grabbing' : 'grab',
            pointerEvents: disabled ? 'none' : 'auto',
          }}
          onPointerDown={beginDrag}
        >
          {/* Outer Halo */}
          <circle r={14} className="k-dial-handle-halo" />
          {/* Main Grip Circle */}
          <circle r={9.5} className="k-dial-handle-outer" />
          {/* Knurled Thumb Dimple Pip */}
          <circle r={3.2} className="k-dial-handle-inner" />

          {/* Floating minute HUD badge while dragging */}
          {dragging && (
            <g className="k-dial-hud-bubble" transform="translate(0, -22)">
              <rect x="-18" y="-12" width="36" height="18" rx="9" className="k-dial-hud-bg" />
              <text x="0" y="1" textAnchor="middle" dominantBaseline="middle" className="k-dial-hud-text">
                {currentMinutes}m
              </text>
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};
