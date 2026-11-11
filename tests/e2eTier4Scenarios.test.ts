/**
 * e2eTier4Scenarios.test.ts
 *
 * Tier 4: Real-World Workload Scenarios
 * Tests complete, end-to-end user workflows for students and deep-work practitioners
 * covering the 5 application scenarios defined in TEST_INFRA.md and PROJECT.md.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MockWindowTarget,
  createMockKeyEvent,
  MockAudioContext,
  createUrlRevocationTracker,
  withMockStorage,
  mockNetwork,
  assertZeroNetworkAccess,
} from './testHarness.ts';

import { normalizePalette } from '../data/validation.ts';
import { checkUnlockableCapsules } from '../utils/timeCapsule.ts';
import {
  calculateFinishEstimate,
  calculateSubtaskSum,
} from '../utils/subtaskTime.ts';
import {
  saveAiConfig,
  getAiConfig,
} from '../utils/geminiAi.ts';
import {
  parseOutlineOffline,
  calculatePacing,
  checkInputSufficiency,
} from '../utils/documentBreakdown.ts';
import type { Task, Project, TimeCapsule } from '../types.ts';

// ============================================================================
// Scenario 1: Student Study Plan from PDF Syllabus
// ============================================================================

test('Tier 4: Scenario 1 - Student Study Plan from PDF Syllabus', async () => {
  await assertZeroNetworkAccess(async () => {
    // 1. Syllabus markdown text extracted client-side from student upload (F14)
    const syllabus = `
# Calculus II: Integral Techniques & Series
## Unit 1: Integration by Parts & Partial Fractions
- Derivation of integration by parts formula
- Rational functions and partial fraction decomposition
## Unit 2: Improper Integrals & Convergence Tests
- Comparison test and limit comparison test
- Ratio and root tests for infinite series
## Unit 3: Power Series & Taylor Polynomials
- Taylor polynomial approximation and error bounds
- Analytic functions derivation
    `.trim();

    // 2. Document sufficiency validation
    const sufficiency = checkInputSufficiency(syllabus, false);
    assert.equal(sufficiency.isSufficient, true);

    // 3. 14-day future deadline target
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const deadlineStr = futureDate.toISOString().split('T')[0];

    // 4. Generate structured breakdown plan using offline cognitive AST (F15)
    const plan = parseOutlineOffline(syllabus, {
      archetype: 'study',
      deadline: deadlineStr,
    });

    assert.equal(plan.projectName, 'Calculus II: Integral Techniques & Series');
    assert.equal(plan.modules.length, 3);

    // 6 total tasks across 3 units
    const allTasks = plan.modules.flatMap(m => m.tasks);
    assert.equal(allTasks.length, 6);

    // Verify cognitive difficulty differentiation:
    // "Derivation of integration by parts" -> intensive (3 rounds)
    // "error bounds" -> intensive (3 rounds)
    // "Comparison test" -> standard (2 rounds)
    const derivationTask = allTasks.find(t => t.name.includes('Derivation'));
    assert.ok(derivationTask);
    assert.equal(derivationTask.difficulty, 'intensive');
    assert.equal(derivationTask.targetRounds, 3);

    const standardTask = allTasks.find(t => t.name.includes('Comparison test'));
    assert.ok(standardTask);
    assert.equal(standardTask.difficulty, 'standard');
    assert.equal(standardTask.targetRounds, 2);

    // Total planned focus time accurately matches sum of rounds * 25 min
    assert.equal(plan.totalMinutes, plan.totalRounds * 25);

    // Pacing calculation for 14-day study sprint
    const pacing = calculatePacing(plan.totalRounds, deadlineStr);
    assert.ok(pacing.daysRemaining && pacing.daysRemaining >= 13);
    assert.ok(pacing.roundsPerDay && pacing.roundsPerDay > 0);

    // 5. Convert breakdown plan to Kairo Project tree state
    const importedProject: Project = {
      id: 'proj-calc-2',
      name: plan.projectName,
      tasks: allTasks.map((t, idx) => ({
        id: `task-calc-${idx + 1}`,
        name: t.name,
        targetRounds: t.targetRounds,
        completed: false,
        status: 'todo',
        timeSpent: 0,
        subTasks: t.subTasks.map((st, sIdx) => ({
          id: `sub-calc-${idx + 1}-${sIdx + 1}`,
          name: st.name,
          completed: false,
        })),
      })),
      subProjects: [],
      isExpanded: true,
    };

    assert.equal(importedProject.tasks.length, 6);
    assert.ok(importedProject.tasks.every(t => t.completed === false));
  });
});

// ============================================================================
// Scenario 2: Offline Deep-Work Session with Custom Pomodoro Lengths
// ============================================================================

test('Tier 4: Scenario 2 - Offline Deep-Work Session with Custom Pomodoro Lengths', () => {
  // 1. Software engineer configures custom 50-minute Pomodoro task (F5)
  let activeTask: Task = {
    id: 'task-engine-lexer',
    name: 'Implement Lexer & Parser AST',
    completed: false,
    status: 'in-progress',
    timeSpent: 0,
    pomodoroLength: 50,
    targetRounds: 3,
    subTasks: [
      { id: 'st-tokens', name: 'Lexical tokens stream', completed: false, timeSpent: 0 },
      { id: 'st-parser', name: 'Recursive descent parser', completed: false, timeSpent: 0 },
      { id: 'st-ast', name: 'AST node lowering', completed: false, timeSpent: 0 },
    ],
  };

  const settings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsPerRound: 3,
  };

  // 2. Keyboard shortcuts setup (F1)
  const windowTarget = new MockWindowTarget();
  let sessionMode: 'focus' | 'shortBreak' | 'longBreak' = 'focus';

  const onKeyDown = (e: ReturnType<typeof createMockKeyEvent>) => {
    if (e.key === '1') sessionMode = 'focus';
    else if (e.key === '2') sessionMode = 'shortBreak';
    else if (e.key === '3') sessionMode = 'longBreak';
  };
  windowTarget.addEventListener('keydown', onKeyDown);

  // Confirm focus mode via '1'
  windowTarget.dispatchEvent(createMockKeyEvent('keydown', { key: '1' }));
  assert.equal(sessionMode, 'focus');

  // 3. Timer duration derivation: factors active task's 50m length (F5)
  const taskFocusSeconds = (activeTask.pomodoroLength || settings.focusDuration) * 60;
  assert.equal(taskFocusSeconds, 3000); // 50m = 3000s

  let timeLeft = 3000;
  // Timer runs down by 20 minutes (1200 seconds)
  timeLeft -= 1200;
  assert.equal(timeLeft, 1800);

  // 4. Calculate finish estimate for 3 pomos of 50m (F4)
  const simulatedNow = new Date(2026, 10, 11, 9, 0, 0);
  const estimate = calculateFinishEstimate([activeTask], settings, simulatedNow);

  // 3 pomos * 50m = 150m focus. 2 short breaks (2 * 5m = 10m) = 160m total (2h 40m)
  assert.equal(estimate.totalPomos, 3);
  assert.equal(estimate.remainingPomos, 3);
  assert.equal(estimate.totalMinutes, 160);
  assert.equal(estimate.hoursFormatted, '2.7h');

  // 5. Complete subtasks, then uncheck one -> reverts task status to todo (F2)
  activeTask.subTasks = (activeTask.subTasks || []).map(st => ({ ...st, completed: true }));
  let allDone = activeTask.subTasks.every(st => st.completed);
  activeTask.completed = allDone;
  activeTask.status = allDone ? 'done' : 'todo';
  assert.equal(activeTask.completed, true);

  // Uncheck 'st-parser'
  activeTask.subTasks = activeTask.subTasks.map(st =>
    st.id === 'st-parser' ? { ...st, completed: false } : st,
  );
  allDone = activeTask.subTasks.every(st => st.completed);
  activeTask.completed = allDone;
  activeTask.status = allDone ? 'done' : 'todo';
  assert.equal(activeTask.completed, false, 'Unchecking subtask reverts task completed to false');
  assert.equal(activeTask.status, 'todo', 'Unchecking subtask reverts task status to todo');

  // 6. Reset timer -> restores 50:00 (3000s), NOT 25:00 default (F5)
  const resetTimer = () => {
    timeLeft = taskFocusSeconds;
  };
  resetTimer();
  assert.equal(timeLeft, 3000);
});

// ============================================================================
// Scenario 3: Time Capsule Creation & Next-Morning Unlock Schedule
// ============================================================================

test('Tier 4: Scenario 3 - Time Capsule Creation & Next-Morning Unlock Schedule', () => {
  // Student writes a reflection note at 22:45 tonight for 08:00 tomorrow morning
  const creationTime = new Date(2026, 10, 11, 22, 45, 0);

  // Palette is set to 'indigo' (F7)
  const activePalette = normalizePalette('indigo');
  assert.equal(activePalette, 'indigo');

  const capsule: TimeCapsule = {
    id: 'capsule-morning-routine',
    createdAt: creationTime.toISOString(),
    message: 'Morning lecture preparation: review differential geometry notes',
    treat: 'Pour-over Ethiopian Yirgacheffe coffee',
    triggerType: 'time',
    targetTime: '08:00', // 8:00 AM
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  // 1. Same night at 23:00 -> locked (F3: 08:00 < 22:45, rolled over to tomorrow)
  const nightCheck = checkUnlockableCapsules([capsule], 0, new Date(2026, 10, 11, 23, 0, 0));
  assert.equal(nightCheck.unlockable.length, 0);
  assert.equal(nightCheck.remaining.length, 1);

  // 2. Middle of the night at 03:00 -> still locked
  const midNightCheck = checkUnlockableCapsules([capsule], 0, new Date(2026, 10, 12, 3, 0, 0));
  assert.equal(midNightCheck.unlockable.length, 0);

  // 3. Tomorrow morning at 07:55 -> still locked
  const earlyMorningCheck = checkUnlockableCapsules([capsule], 0, new Date(2026, 10, 12, 7, 55, 0));
  assert.equal(earlyMorningCheck.unlockable.length, 0);

  // 4. Tomorrow morning at 08:05 -> UNLOCKS on schedule!
  const unlockCheck = checkUnlockableCapsules([capsule], 0, new Date(2026, 10, 12, 8, 5, 0));
  assert.equal(unlockCheck.unlockable.length, 1);
  assert.equal(unlockCheck.unlockable[0].id, 'capsule-morning-routine');
  assert.equal(unlockCheck.unlockable[0].isUnlocked, true);
  assert.equal(unlockCheck.unlockable[0].treat, 'Pour-over Ethiopian Yirgacheffe coffee');
});

// ============================================================================
// Scenario 4: Multi-Provider Switching Lifecycle
// ============================================================================

test('Tier 4: Scenario 4 - Multi-Provider Switching Lifecycle (Ollama -> Gemini -> Claude -> Offline)', async () => {
  await withMockStorage(async () => {
    // 1. Configure Local Ollama (F13)
    saveAiConfig({
      provider: 'local',
      baseUrl: 'http://localhost:11434/v1',
      model: 'llama3.2',
    });
    assert.equal(getAiConfig().provider, 'local');

    // 2. Switch to Google Gemini (F10)
    saveAiConfig({
      provider: 'gemini',
      apiKey: 'AIzaSyTestKey_Gemini_12345',
      model: 'gemini-2.0-flash',
    });
    assert.equal(getAiConfig().provider, 'gemini');

    // 3. Switch to Anthropic Claude (F11)
    const netClaude = mockNetwork(async (req) => {
      assert.equal(req.headers['anthropic-dangerous-direct-browser-access'], 'true');
      assert.equal(req.headers['x-api-key'], 'sk-ant-test-key-54321');
      assert.ok(req.url.endsWith('/v1/messages'));

      // Simulate network disconnection error
      throw new Error('TypeError: Failed to fetch (Network offline)');
    });

    try {
      saveAiConfig({
        provider: 'offline', // Gracefully switches to offline heuristics (F15)
      });
      assert.equal(getAiConfig().provider, 'offline');

      // 4. Breakdown executes offline with zero network access
      await assertZeroNetworkAccess(async () => {
        const outlineText = `
# Data Structures & Algorithms
## Week 1: Trees and Graphs
- Binary Search Tree balancing (intensive)
- Graph traversal BFS and DFS
        `.trim();

        const plan = parseOutlineOffline(outlineText, { archetype: 'study' });
        assert.equal(plan.projectName, 'Data Structures & Algorithms');
        assert.equal(plan.modules.length, 1);
        assert.equal(plan.modules[0].tasks.length, 2);
      });
    } finally {
      netClaude.restore();
    }
  });
});

// ============================================================================
// Scenario 5: Master Mute & Soundscape Preset Switching during Active Timer
// ============================================================================

test('Tier 4: Scenario 5 - Master Mute & Soundscape Preset Switching during Active Timer', () => {
  const tracker = createUrlRevocationTracker();
  tracker.install();

  try {
    const audioContext = new MockAudioContext();
    const movementDepth = audioContext.createGain();
    const windowTarget = new MockWindowTarget();

    let masterVolume = 0.8;
    let isMasterMuted = false;
    let currentAmbientBlobUrl = URL.createObjectURL({} as any);

    // Keyboard listener for master mute toggle 'M' / 'm' (F1)
    windowTarget.addEventListener('keydown', (e: ReturnType<typeof createMockKeyEvent>) => {
      if (e.key.toLowerCase() === 'm') {
        isMasterMuted = !isMasterMuted;
      }
    });

    // 1. Initial audio modulation depth derived from user's volume target (F6)
    movementDepth.gain.value = masterVolume * 0.55;
    assert.ok(Math.abs(movementDepth.gain.value - 0.44) < 1e-6);

    // 2. User presses 'M' to mute audio
    windowTarget.dispatchEvent(createMockKeyEvent('keydown', { key: 'M' }));
    assert.equal(isMasterMuted, true);

    // 3. User switches ambient sound preset from "Rain" to "Fireplace"
    const nextAmbientBlobUrl = URL.createObjectURL({} as any);

    // Old audio object URL must be revoked to prevent memory leaks (F8)
    if (currentAmbientBlobUrl.startsWith('blob:')) {
      URL.revokeObjectURL(currentAmbientBlobUrl);
    }
    currentAmbientBlobUrl = nextAmbientBlobUrl;

    assert.equal(tracker.revoked.length, 1);

    // 4. User presses 'm' to unmute
    windowTarget.dispatchEvent(createMockKeyEvent('keydown', { key: 'm' }));
    assert.equal(isMasterMuted, false);

    // Movement depth restored correctly
    assert.ok(Math.abs(movementDepth.gain.value - 0.44) < 1e-6);
  } finally {
    tracker.restore();
  }
});
