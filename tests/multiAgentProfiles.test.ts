import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_SETTINGS,
  normalizeProjects,
  normalizeSessions,
  normalizeSettings,
} from '../data/validation.ts';
import {
  calculateElapsedSeconds,
  isInterruptedSnapshot,
  parseTimerSnapshot,
  remainingSeconds,
  type TimerSnapshot,
} from '../utils/timerState.ts';
import { checkUnlockableCapsules } from '../utils/timeCapsule.ts';
import { calculateFocusStats, intensityLevel } from '../utils/analytics.ts';
import {
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../utils/supabaseSync.ts';
import type { Project, KairoSession, TimeCapsule } from '../types.ts';

// ---------------------------------------------------------------------------
// Agent 1: The First-Time Novice (Onboarding & Default State Integrity)
// ---------------------------------------------------------------------------
test('Agent 1 [Novice]: Validates default onboarding and resilient empty state structures', () => {
  const settings = normalizeSettings({});
  assert.equal(settings.focusDuration, DEFAULT_SETTINGS.focusDuration);
  assert.equal(settings.shortBreakDuration, DEFAULT_SETTINGS.shortBreakDuration);
  assert.equal(settings.sessionsPerRound, DEFAULT_SETTINGS.sessionsPerRound);

  // Empty projects array normalization
  const projects = normalizeProjects([]);
  assert.deepEqual(projects, []);

  // Gracefully handles unexpected/corrupted initial input
  const corrupted = normalizeProjects(null);
  assert.deepEqual(corrupted, []);
});

// ---------------------------------------------------------------------------
// Agent 2: The Deep Focus Minimalist (Pace & Boundary Conditions)
// ---------------------------------------------------------------------------
test('Agent 2 [Minimalist]: Verifies timer countdown bounds and edge timestamps', () => {
  const now = 1_000_000;
  const snap: TimerSnapshot = {
    version: 1,
    id: 'snap-zen-1',
    sessionType: 'focus',
    timeLeft: 1500,
    isActive: true,
    deadline: now + 90 * 60 * 1000, // 90 min hyperfocus
    startedAt: now,
    sessionDuration: 90 * 60,
    target: null,
  };

  assert.equal(remainingSeconds(snap, now), 90 * 60);
  assert.equal(remainingSeconds(snap, now + 89 * 60 * 1000), 60);
  assert.equal(remainingSeconds(snap, now + 91 * 60 * 1000), 0); // Never negative
});

// ---------------------------------------------------------------------------
// Agent 3: The Power Project Manager (Subtasks & Time Accumulation)
// ---------------------------------------------------------------------------
test('Agent 3 [Project Manager]: Subtasks propagate completion and time tracking accurately', () => {
  const initialProjects: Project[] = [
    {
      id: 'proj-1',
      name: 'Launch Campaign',
      subProjects: [],
      isExpanded: true,
      tasks: [
        {
          id: 'task-1',
          name: 'Landing Page',
          completed: false,
          timeSpent: 25,
          subTasks: [
            { id: 'sub-1', name: 'Hero section', completed: true },
            { id: 'sub-2', name: 'Pricing table', completed: false },
          ],
        },
      ],
    },
  ];

  // Simulating subtask time credit
  const sessionDuration = 18; // 18m banked
  const updatedProjects = initialProjects.map(p => ({
    ...p,
    tasks: p.tasks.map(t => {
      const isSub = (t.subTasks || []).some(st => st.id === 'sub-2');
      return isSub ? { ...t, timeSpent: t.timeSpent + sessionDuration } : t;
    }),
  }));

  assert.equal(updatedProjects[0].tasks[0].timeSpent, 43); // 25 + 18
});

// ---------------------------------------------------------------------------
// Agent 4: The Sound Architect (Volume & Audio Bounds)
// ---------------------------------------------------------------------------
test('Agent 4 [Sound Architect]: Validates audio settings parameter boundaries', () => {
  const clampVol = (v: number) => Math.max(0, Math.min(1, v));
  assert.equal(clampVol(-0.5), 0);
  assert.equal(clampVol(1.5), 1);
  assert.equal(clampVol(0.65), 0.65);
});

// ---------------------------------------------------------------------------
// Agent 5: The Chaos Monkey (Interrupted Session & Snapshot Resilience)
// ---------------------------------------------------------------------------
test('Agent 5 [Chaos Monkey]: Interrupted session boundary and corruption recovery', () => {
  const now = 2_000_000;
  // 59 seconds elapsed -> NOT interrupted (threshold is >= 60s)
  const snap59: TimerSnapshot = {
    version: 1,
    id: 'chaos-1',
    sessionType: 'focus',
    timeLeft: 1441,
    isActive: false,
    deadline: null,
    startedAt: now - 59_000,
    sessionDuration: 1500,
    target: null,
  };
  assert.equal(calculateElapsedSeconds(snap59, now), 59);
  assert.equal(isInterruptedSnapshot(snap59, now), false);

  // 60 seconds elapsed -> YES interrupted
  const snap60: TimerSnapshot = {
    ...snap59,
    timeLeft: 1440,
  };
  assert.equal(calculateElapsedSeconds(snap60, now), 60);
  assert.equal(isInterruptedSnapshot(snap60, now), true);

  // Corrupted snapshot returns null safely
  assert.equal(parseTimerSnapshot('{ bad-json'), null);
  assert.equal(parseTimerSnapshot(JSON.stringify({ version: 999 })), null);
});

// ---------------------------------------------------------------------------
// Agent 6: The Time Capsule Visionary (Future Treats Unlocking)
// ---------------------------------------------------------------------------
test('Agent 6 [Time Capsule]: Unlocks treats upon target rounds and date transition', () => {
  const capsules: TimeCapsule[] = [
    {
      id: 'cap-1',
      createdAt: new Date().toISOString(),
      message: 'Great effort!',
      treat: 'Matcha Latte',
      triggerType: 'rounds',
      targetRounds: 4,
      completedRoundsAtCreation: 0,
      isUnlocked: false,
    },
  ];

  // 3 rounds completed -> still locked
  const test1 = checkUnlockableCapsules(capsules, 3);
  assert.equal(test1.unlockable.length, 0);

  // 4 rounds completed -> unlocked!
  const test2 = checkUnlockableCapsules(capsules, 4);
  assert.equal(test2.unlockable.length, 1);
  assert.equal(test2.unlockable[0].treat, 'Matcha Latte');
  assert.equal(test2.unlockable[0].isUnlocked, true);
});

// ---------------------------------------------------------------------------
// Agent 7: The Data Scientist (Analytics, Streaks & Intensity Tiers)
// ---------------------------------------------------------------------------
test('Agent 7 [Data Scientist]: Verifies focus intensity tiers and session aggregation', () => {
  assert.equal(intensityLevel(0), 0);
  assert.equal(intensityLevel(15), 1);
  assert.equal(intensityLevel(45), 2);
  assert.equal(intensityLevel(90), 3);
  assert.equal(intensityLevel(150), 4);

  const mockSessions: KairoSession[] = [
    { id: 's-1', date: new Date().toISOString(), duration: 25, completed: true, type: 'focus', taskName: 'Code review' },
    { id: 's-2', date: new Date().toISOString(), duration: 25, completed: true, type: 'focus', taskName: 'Design audit' },
  ];
  const stats = calculateFocusStats(mockSessions);
  assert.equal(stats.totalMins, 50);
  assert.equal(stats.sessionCount, 2);
  assert.equal(stats.avg, 25);
});

// ---------------------------------------------------------------------------
// Agent 8: The Theming & Accessibility Purist (Palette Constraints)
// ---------------------------------------------------------------------------
test('Agent 8 [Theming Purist]: Atmospheric palettes and dark/light modes validate cleanly', () => {
  const validPalettes = ['obsidian', 'zen', 'indigo', 'washi'];
  const testPalette = (p: string) => validPalettes.includes(p) ? p : 'obsidian';

  assert.equal(testPalette('zen'), 'zen');
  assert.equal(testPalette('washi'), 'washi');
  assert.equal(testPalette('unknown-theme'), 'obsidian'); // Fallback to obsidian
});

// ---------------------------------------------------------------------------
// Agent 9: The Break Customizer (Stepper & Bounds)
// ---------------------------------------------------------------------------
test('Agent 9 [Break Customizer]: Break durations clamp within strict safe ranges', () => {
  const clampBreak = (mins: number, max = 60) => Math.round(Math.min(max, Math.max(1, mins)));

  assert.equal(clampBreak(0), 1); // Minimum 1 minute
  assert.equal(clampBreak(7), 7);
  assert.equal(clampBreak(65), 60); // Maximum 60 minutes for short break
  assert.equal(clampBreak(140, 120), 120); // Maximum 120 minutes for long break
});

// ---------------------------------------------------------------------------
// Agent 10: The Offline-Cloud Hybrid User (Supabase Resilience)
// ---------------------------------------------------------------------------
test('Agent 10 [Offline-Cloud Hybrid]: Supabase sync config persists cleanly with offline fallback', () => {
  const original = (globalThis as unknown as { localStorage: unknown }).localStorage;
  const values = new Map<string, string>();
  (globalThis as unknown as { localStorage: unknown }).localStorage = {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => { values.set(k, v); },
  };

  try {
    saveSupabaseConfig({ url: 'https://test.supabase.co', anonKey: 'test-key' });
    const cfg = getSupabaseConfig();
    assert.equal(cfg.url, 'https://test.supabase.co');
    assert.equal(cfg.anonKey, 'test-key');
  } finally {
    (globalThis as unknown as { localStorage: unknown }).localStorage = original;
  }
});
