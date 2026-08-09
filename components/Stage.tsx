import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { gsap } from 'gsap';
import type { FocusTarget, KairoSession, SessionType, UserSettings } from '../types';
import { Icon } from './Icon';
import {
  readTimerSnapshot,
  remainingSeconds,
  type TimerSnapshot,
  writeTimerSnapshot,
} from '../utils/timerState';

interface StageProps {
  settings: UserSettings;
  setSettings: (settings: UserSettings) => void;
  addSession: (session: KairoSession) => void;
  activeTarget: FocusTarget | null;
  toggleAudio: (isPlaying: boolean) => void | Promise<void>;
  playCompletionCue: () => Promise<void>;
  totalPomodoros: number;
  totalFocusMinutes: number;
  todaySummary?: { minutes: number; sessions: number; streak: number };
  onActiveChange?: (active: boolean) => void;
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
  totalPomodoros,
  totalFocusMinutes,
  todaySummary,
  onActiveChange,
}) => {
  const restoredRef = useRef<TimerSnapshot | null>(readTimerSnapshot());
  const restored = restoredRef.current;
  const [sessionType, setSessionType] = useState<SessionType>(restored?.sessionType ?? 'focus');
  const [timeLeft, setTimeLeft] = useState(() => {
    return restored ? remainingSeconds(restored) : settings.focusDuration * 60;
  });
  const [isActive, setIsActive] = useState(restored?.isActive ?? false);
  const [editingDurations, setEditingDurations] = useState(false);
  const [completionMessage, setCompletionMessage] = useState('');
  const lastSnapshotWriteRef = useRef(0);
  const sessionIdRef = useRef(restored?.id ?? crypto.randomUUID());
  const deadlineRef = useRef<number | null>(restored?.deadline ?? null);
  const startedAtRef = useRef<number | null>(restored?.startedAt ?? null);
  const sessionDurationRef = useRef<number | null>(restored?.sessionDuration ?? null);
  const sessionTargetRef = useRef<FocusTarget | null>(restored?.target ?? null);

  // Implementation-intention field. Captured before the session starts,
  // frozen into the session record at start, then cleared when the timer
  // completes. Evidence base: Gollwitzer 1999 -- naming a specific
  // intention significantly raises follow-through.
  const [intention, setIntention] = useState('');
  const sessionIntentionRef = useRef<string>('');

  const durationFor = useCallback((type: SessionType) => {
    if (type === 'focus') return settings.focusDuration * 60;
    if (type === 'longBreak') return settings.longBreakDuration * 60;
    return settings.shortBreakDuration * 60;
  }, [settings.focusDuration, settings.longBreakDuration, settings.shortBreakDuration]);

  const totalTime = durationFor(sessionType);
  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;
  const progressPercent = Math.min(100, Math.max(0, Math.round(progress)));
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(timeLeft / 60).toString().padStart(2, '0');
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
      taskName: completedTarget?.name,
      intention: sessionIntentionRef.current || undefined,
    });

    const nextFocusCount = sessionType === 'focus'
      ? totalPomodoros + 1
      : totalPomodoros;
    const nextType: SessionType = sessionType === 'focus'
      ? (nextFocusCount % settings.sessionsPerRound === 0 ? 'longBreak' : 'shortBreak')
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
    setCompletionMessage(`${completedLabel} ${autoStart ? 'Break started automatically.' : 'Choose when to continue.'}`);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(sessionType === 'focus' ? 'Focus session complete' : 'Break complete', {
        body: autoStart ? 'Your next break has started.' : 'Choose what to do next in Kairo.',
      });
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.(80);
  }, [activeTarget, addSession, durationFor, playCompletionCue, sessionType, settings.autoStartBreaks, settings.sessionsPerRound, toggleAudio, totalPomodoros, totalTime]);

  useEffect(() => {
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
    };
    const now = Date.now();
    if (isActive && now - lastSnapshotWriteRef.current < 15000) return;
    writeTimerSnapshot(snapshot);
    lastSnapshotWriteRef.current = now;
  }, [isActive, sessionType, timeLeft]);

  useEffect(() => {
    onActiveChange?.(isActive);
  }, [isActive, onActiveChange]);

  useEffect(() => {
    if (!isActive) return;
    const timer = window.setInterval(() => {
      const deadline = deadlineRef.current;
      if (!deadline) return;
      setTimeLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    }, 250);
    return () => window.clearInterval(timer);
  }, [isActive]);

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

  const needsTarget = sessionType === 'focus' && activeTarget?.kind !== 'task';

  const resetTimer = () => {
    deadlineRef.current = null;
    startedAtRef.current = null;
    sessionDurationRef.current = null;
    sessionTargetRef.current = null;
    sessionIdRef.current = crypto.randomUUID();
    setIsActive(false);
    setTimeLeft(totalTime);
    toggleAudio(false);
  };

  /* Keyboard shortcuts + drag-to-extend are wired below the skipBreak /
     updateDuration definitions to avoid TDZ issues at first render. */

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
    setCompletionMessage('Break skipped. Focus is ready when you are.');
  };

  const updateDuration = (key: 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration', value: number) => {
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
  toggleTimerRef.current = toggleTimer;
  resetTimerRef.current = resetTimer;
  skipBreakRef.current = skipBreak;
  extendTimerRef.current = extendTimer;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.isContentEditable) return;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const key = event.key.toLowerCase();
      if (event.key === ' ') { event.preventDefault(); toggleTimerRef.current(); return; }
      if (key === 'r') { event.preventDefault(); resetTimerRef.current(); return; }
      if (key === 's') { event.preventDefault(); skipBreakRef.current(); return; }
      if (key === 'e') { event.preventDefault(); extendTimerRef.current(); return; }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const targetLabel = activeTarget?.kind === 'task' ? activeTarget.name : 'Choose a task to focus on';
  const showEmptyHero = !activeTarget && (todaySummary?.sessions ?? 0) === 0 && totalPomodoros === 0;
  const breakChoices: Array<{ min: number; label: string }> = [
    { min: 5, label: '5 min' },
    { min: 10, label: '10 min' },
    { min: 15, label: '15 min' },
  ];

  if (showEmptyHero) {
    return (
      <div className="k-empty-hero">
        <div className="k-empty-glyph" aria-hidden="true">
          <svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <circle cx="32" cy="32" r="26" strokeDasharray="140 24" transform="rotate(-54 32 32)" />
            <circle cx="32" cy="32" r="4" fill="currentColor" stroke="none" />
          </svg>
        </div>
        <h1 className="k-empty-title">Make space for one thing.</h1>
        <p className="k-empty-copy">
          Start by adding a project in the sidebar, then give it a task. That task
          becomes the one thing your first focus session belongs to.
        </p>
        <p className="k-empty-hint">
          <span>Type a name in <b>New project</b></span>
          <span aria-hidden="true">·</span>
          <span>Press <kbd>Enter</kbd></span>
        </p>
      </div>
    );
  }

  return (
    <>
      <h1 className={`k-task-title ${activeTarget?.kind === 'task' ? '' : 'empty'}`}>{targetLabel}</h1>

      {sessionType === 'focus' && activeTarget?.kind === 'task' && (
        <label className="k-intention">
          <span className="k-intention-cue">I will</span>
          <input
            type="text"
            value={isActive ? sessionIntentionRef.current : intention}
            onChange={e => setIntention(e.target.value)}
            disabled={isActive}
            placeholder="write one sentence about what this session is for"
            maxLength={200}
            aria-label="Session intention"
          />
        </label>
      )}

      <div className="k-timer-frame">
        <div className="k-timer-actions">
          <button
            onClick={toggleTimer}
            disabled={needsTarget}
            className="k-btn k-btn-primary"
            aria-label={isActive ? 'Pause focus' : 'Start focus'}
          >
            {isActive ? 'Pause focus' : 'Start focus'}
          </button>
          <button onClick={skipBreak} disabled={sessionType === 'focus'} className="k-btn" aria-label="Skip break">
            Skip
          </button>
          <button onClick={resetTimer} className="k-btn" aria-label="Reset timer">
            Reset
          </button>
          <div style={{ paddingTop: 4, color: 'var(--sumi-3)', fontSize: 11 }}>
            Sessions today <b style={{ color: 'var(--sumi)', fontWeight: 500 }}>{todaySummary?.sessions ?? 0}</b>
          </div>
        </div>

        <AnalogDial
          totalTime={totalTime}
          timeLeft={timeLeft}
          formatted={formattedTime}
          isActive={isActive}
          disabled={sessionType !== 'focus' || isActive || Boolean(startedAtRef.current)}
          onSet={mins => {
            const seconds = Math.max(60, Math.min(180 * 60, mins * 60));
            setTimeLeft(seconds);
            updateDuration('focusDuration', Math.max(1, Math.round(seconds / 60)));
          }}
        />

        <div className="k-timer-meta">
          <div className="k-meta-block">
            <span className="k-meta-label">Break length</span>
            <div className="k-chips" role="group" aria-label="Break length">
              {breakChoices.map(choice => (
                <button
                  key={choice.min}
                  className={`k-chip ${settings.shortBreakDuration === choice.min ? 'active' : ''}`}
                  aria-pressed={settings.shortBreakDuration === choice.min}
                  onClick={() => updateDuration('shortBreakDuration', choice.min)}
                >
                  {choice.label}
                </button>
              ))}
            </div>
          </div>

          <button
            className="k-toggle"
            aria-pressed={settings.autoStartBreaks}
            onClick={() => setSettings({ ...settings, autoStartBreaks: !settings.autoStartBreaks })}
          >
            <span className="k-toggle-track" aria-hidden="true" />
            <span>Skip breaks</span>
          </button>
        </div>
      </div>

      <p className="k-shortcuts" aria-label="Keyboard shortcuts">
        <span><kbd>Space</kbd>{isActive ? 'pause' : 'start'}</span>
        <span><kbd>S</kbd>skip</span>
        <span><kbd>R</kbd>reset</span>
        <span><kbd>E</kbd>extend +5m</span>
      </p>

      <p className="sr-only" role="status" aria-live="polite">{completionMessage}</p>
    </>
  );
};

/* Analog dial — click-drag or click-and-hold on the outer ring to set the
   focus duration. The red arc + handle track the pointer. Idle only:
   dragging is a no-op mid-session so nothing breaks a running timer. */
type DialProps = {
  totalTime: number;
  timeLeft: number;
  formatted: string;
  isActive: boolean;
  disabled: boolean;
  onSet: (minutes: number) => void;
};

const AnalogDial: React.FC<DialProps> = ({ totalTime, timeLeft, formatted, isActive, disabled, onSet }) => {
  const R = 130;
  const CENTER = 160;
  const CIRC = 2 * Math.PI * R;
  const [dragging, setDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dialRootRef = useRef<HTMLDivElement | null>(null);

  // A brief "settle" beat when the timer flips to active, so the commitment
  // moment is felt not just observed. Reduced-motion is honored by GSAP's
  // matchMedia; without it, we fall back to no animation.
  const wasActiveRef = useRef(isActive);
  useEffect(() => {
    if (isActive && !wasActiveRef.current && dialRootRef.current) {
      const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      if (!prefersReduced) {
        gsap.fromTo(dialRootRef.current,
          { scale: 1 },
          { scale: 1.02, duration: 0.18, ease: 'power2.out', yoyo: true, repeat: 1 });
      }
    }
    wasActiveRef.current = isActive;
  }, [isActive]);

  // Arc is scaled to the DIAL FACE (60 min), not the session length. So
  // setting 30 minutes always gives a half-circle -- like a kitchen timer.
  // As the timer runs down, the arc and handle both shrink toward 12.
  const minutesRemaining = timeLeft / 60;
  const dialFrac = Math.max(0, Math.min(1, minutesRemaining / 60));
  const arcLen = CIRC * dialFrac;
  const arcGap = CIRC - arcLen;
  const angleRad = -Math.PI / 2 + dialFrac * 2 * Math.PI;
  const handleX = CENTER + R * Math.cos(angleRad);
  const handleY = CENTER + R * Math.sin(angleRad);

  const setFromPointer = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    // viewBox is 0..320 in both axes
    const x = ((clientX - rect.left) / rect.width) * 320 - CENTER;
    const y = ((clientY - rect.top) / rect.height) * 320 - CENTER;
    let angle = Math.atan2(y, x) + Math.PI / 2;
    if (angle < 0) angle += 2 * Math.PI;
    const minutes = Math.max(1, Math.round((angle / (2 * Math.PI)) * 60));
    onSet(minutes);
  }, [onSet]);

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

  // Keyboard alternative to dragging: the whole dial acts as a slider from
  // 1..60 minutes when idle. Arrow keys nudge by 1 (fine) or 5 (coarse),
  // Home/End jump to the extremes. Ignored while a session is running.
  const currentMinutes = Math.max(1, Math.round(timeLeft / 60));
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    const map: Record<string, number> = {
      ArrowRight: 1, ArrowUp: 5,
      ArrowLeft: -1, ArrowDown: -5,
    };
    if (e.key in map) {
      e.preventDefault();
      onSet(Math.max(1, Math.min(60, currentMinutes + map[e.key])));
    } else if (e.key === 'Home') { e.preventDefault(); onSet(1); }
    else if (e.key === 'End') { e.preventDefault(); onSet(60); }
    else if (e.key === 'PageUp') { e.preventDefault(); onSet(Math.min(60, currentMinutes + 10)); }
    else if (e.key === 'PageDown') { e.preventDefault(); onSet(Math.max(1, currentMinutes - 10)); }
  };

  return (
    <div
      ref={dialRootRef}
      className="k-dial"
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-label="Focus duration"
      aria-valuemin={1}
      aria-valuemax={60}
      aria-valuenow={currentMinutes}
      aria-valuetext={`${currentMinutes} minutes`}
      aria-disabled={disabled}
      onKeyDown={onKeyDown}
    >
      <svg ref={svgRef} viewBox="0 0 320 320" style={{ touchAction: 'none' }}>
        {/* Invisible hitbox first so it sits UNDER the visible track/arc
            but ABOVE the SVG background; pointer events land on it because
            fill="transparent" (not "none") makes it hit-testable. */}
        <circle
          className="k-dial-hitbox"
          cx={CENTER} cy={CENTER} r={R + 22}
          onPointerDown={beginDrag}
          style={{ pointerEvents: disabled ? 'none' : 'auto' }}
        />

        {/* Ticks */}
        {ticks.map(i => {
          const isMajor = i % 15 === 0;
          const isMinor = i % 5 === 0;
          const a = (-Math.PI / 2) + (i / 60) * 2 * Math.PI;
          const outer = R + 10;
          const inner = isMajor ? R - 2 : isMinor ? R + 2 : R + 5;
          return (
            <line
              key={i}
              className={isMajor || isMinor ? 'k-dial-tick-major' : 'k-dial-tick'}
              x1={CENTER + Math.cos(a) * outer}
              y1={CENTER + Math.sin(a) * outer}
              x2={CENTER + Math.cos(a) * inner}
              y2={CENTER + Math.sin(a) * inner}
              strokeWidth={isMajor ? 1.5 : 1}
              strokeLinecap="round"
              style={{ pointerEvents: 'none' }}
            />
          );
        })}

        {/* Quarter labels — pushed outside R+10 tick zone with clearance */}
        {[
          { text: '0',  x: CENTER,          y: CENTER - R - 22 },
          { text: '15', x: CENTER + R + 26, y: CENTER + 5 },
          { text: '30', x: CENTER,          y: CENTER + R + 30 },
          { text: '45', x: CENTER - R - 26, y: CENTER + 5 },
        ].map(l => (
          <text
            key={l.text}
            className="k-dial-tick-label"
            x={l.x} y={l.y}
            textAnchor="middle"
            style={{ pointerEvents: 'none' }}
          >
            {l.text}
          </text>
        ))}

        {/* Track ring */}
        <circle
          className="k-dial-track"
          cx={CENTER} cy={CENTER} r={R}
          fill="none"
          strokeWidth={4}
          style={{ pointerEvents: 'none' }}
        />

        {/* Progress arc — sweeps clockwise from 12 o'clock as time elapses.
            We draw `arcLen` (remaining) and skip `arcGap` (elapsed). */}
        <circle
          className="k-dial-arc"
          cx={CENTER} cy={CENTER} r={R}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          strokeDasharray={`${arcLen} ${arcGap}`}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          style={{ pointerEvents: 'none' }}
        />

        {/* Center time */}
        <text
          className="k-dial-time"
          x={CENTER} y={CENTER + 22}
          textAnchor="middle"
          role="timer"
          aria-label={`${formatted} remaining`}
          style={{ pointerEvents: 'none' }}
        >
          {formatted}
        </text>

        {/* Handle sits on top so it always receives pointerdown */}
        <circle
          className={`k-dial-handle ${dragging ? 'dragging' : ''}`}
          cx={handleX} cy={handleY} r={10}
          onPointerDown={beginDrag}
          style={{ pointerEvents: disabled ? 'none' : 'auto', opacity: disabled && !isActive ? 0.4 : 1 }}
        />
      </svg>
    </div>
  );
};
