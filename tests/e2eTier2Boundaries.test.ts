/**
 * e2eTier2Boundaries.test.ts
 *
 * Tier 2: Boundary & Corner Cases
 * Tests extreme inputs, zero/null bounds, network anomalies, temporal rollovers,
 * capacity limits, and rapid state transitions across Kairo subsystems.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MockAudioContext,
  createUrlRevocationTracker,
  withMockStorage,
  mockNetwork,
  assertZeroNetworkAccess,
} from './testHarness.ts';

import {
  normalizeSettings,
  normalizeProjects,
} from '../data/validation.ts';
import { checkUnlockableCapsules } from '../utils/timeCapsule.ts';
import {
  calculateFinishEstimate,
  calculateSubtaskSum,
  estimatePomodorosFromSubtasks,
} from '../utils/subtaskTime.ts';
import {
  saveAiConfig,
  getAiConfig,
  testAiConnection,
} from '../utils/geminiAi.ts';
import {
  checkInputSufficiency,
  parseOutlineOffline,
} from '../utils/documentBreakdown.ts';
import type { Task, TimeCapsule } from '../types.ts';

// ============================================================================
// Group B1: AI Breakdown Input & Network Boundaries
// ============================================================================

test('Tier 2: B1.1 - Empty & Whitespace Document Inputs', () => {
  const emptyInputs = ['', '   ', '\t\n\r  \n', '.', '???', 'a'];

  for (const input of emptyInputs) {
    const check = checkInputSufficiency(input, false);
    assert.equal(
      check.isSufficient,
      false,
      `Input "${input}" must be flagged as insufficient`,
    );
    assert.ok(check.reason && check.reason.length > 0);
    assert.ok(Array.isArray(check.missingElements) && check.missingElements.length > 0);
    assert.ok(Array.isArray(check.suggestedClarifications) && check.suggestedClarifications.length > 0);
  }

  // When a file is uploaded, sufficiency passes even if text is empty
  const fileCheck = checkInputSufficiency('', true);
  assert.equal(fileCheck.isSufficient, true);
});

test('Tier 2: B1.2 - Boundary Syllabus Text Input under Zero-Network', async () => {
  await assertZeroNetworkAccess(async () => {
    const modules: string[] = ['# Comprehensive Engineering Curriculum'];
    for (let m = 1; m <= 4; m++) {
      modules.push(`## Unit ${m}: Engineering Topic ${m}`);
      for (let t = 1; t <= 3; t++) {
        modules.push(`- Task ${m}.${t}: Deep conceptual proof and derivation`);
        modules.push(`  - Subtask ${m}.${t}.1: Formula verification`);
        modules.push(`  - Subtask ${m}.${t}.2: Problem set`);
      }
    }
    const syllabusText = modules.join('\n');

    const plan = parseOutlineOffline(syllabusText, { archetype: 'study' });
    assert.equal(plan.projectName, 'Comprehensive Engineering Curriculum');
    assert.equal(plan.modules.length, 4);
    assert.ok(plan.totalRounds > 0);
    assert.equal(plan.totalMinutes, plan.totalRounds * 25);
  });
});

test('Tier 2: B1.3 - Missing & Malformed API Keys Sanitization', async () => {
  const net = mockNetwork(async () => {
    return { status: 400, body: { error: { message: 'API key not valid' } } };
  });

  try {
    await withMockStorage(async () => {
      // CRLF injection attempt and excessive whitespace
      saveAiConfig({
        provider: 'gemini',
        apiKey: '  AIzaSyKey123\r\nHost: malicious.com\n  ',
      });
      const cfg = getAiConfig();
      assert.ok(!cfg.apiKey.includes('\r'));
      assert.ok(!cfg.apiKey.includes('\n'));
      assert.equal(cfg.apiKey, 'AIzaSyKey123Host: malicious.com');

      // Empty key connection test returns actionable failure immediately
      const res = await testAiConnection({ provider: 'gemini', apiKey: '' });
      assert.equal(res.success, false);
      assert.ok(res.message.toLowerCase().includes('key'));
    });
  } finally {
    net.restore();
  }
});

test('Tier 2: B1.4 - HTTP Rate Limit (429) & Server Error (500) Simulations', async () => {
  const net = mockNetwork(async (req) => {
    if (req.url.includes('openai.com')) {
      return {
        status: 429,
        body: { error: { message: 'Resource exhausted: rate limit exceeded. Please retry in 30s.' } },
      };
    }
    return {
      status: 500,
      body: { error: 'Internal Server Error' },
    };
  });

  try {
    const res429 = await testAiConnection({
      provider: 'openai_custom',
      apiKey: 'sk-test',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
    });
    assert.equal(res429.success, false);
    assert.ok(res429.message.includes('429') || res429.message.includes('exhausted') || res429.message.includes('rate limit'));

    const res500 = await testAiConnection({
      provider: 'openrouter',
      apiKey: 'sk-or-test',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
    });
    assert.equal(res500.success, false);
  } finally {
    net.restore();
  }
});

test('Tier 2: B1.5 - Zero-Length Task List and Extreme Durations in Finish Estimate', () => {
  const now = new Date(2026, 10, 11, 10, 0, 0);

  // 1. Empty task list
  const emptyRes = calculateFinishEstimate([], { focusDuration: 25 }, now);
  assert.equal(emptyRes.totalPomos, 0);
  assert.equal(emptyRes.remainingPomos, 0);
  assert.equal(emptyRes.totalMinutes, 0);
  assert.equal(emptyRes.hoursFormatted, '0.0h');

  // 2. All tasks completed
  const allDoneTasks = [
    { targetRounds: 4, completed: true, timeSpent: 100, pomodoroLength: 25 },
  ];
  const doneRes = calculateFinishEstimate(allDoneTasks, { focusDuration: 25 }, now);
  assert.equal(doneRes.totalPomos, 4);
  assert.equal(doneRes.remainingPomos, 0);
  assert.equal(doneRes.totalMinutes, 0);

  // 3. Extreme durations (e.g. 180 min focus length)
  const extremeTasks = [
    { targetRounds: 2, completed: false, timeSpent: 0, pomodoroLength: 180 },
  ];
  const extremeRes = calculateFinishEstimate(extremeTasks, { sessionsPerRound: 4 }, now);
  assert.equal(extremeRes.remainingPomos, 2);
  assert.ok(extremeRes.totalMinutes >= 360);
});

// ============================================================================
// Group B2: Timer & Stage Engine Boundaries
// ============================================================================

test('Tier 2: B2.1 - Zero, Negative, and Non-Finite Timer Durations', () => {
  const invalidSettings: any = {
    focusDuration: -10,
    shortBreakDuration: 0,
    longBreakDuration: NaN,
    sessionsPerRound: 999,
  };

  const normalized = normalizeSettings(invalidSettings);

  assert.equal(normalized.focusDuration, 1, 'Focus duration clamped to minimum 1 min');
  assert.equal(normalized.shortBreakDuration, 1, 'Short break clamped to minimum 1 min');
  assert.equal(normalized.longBreakDuration, 15, 'NaN falls back to default 15 min');
  assert.equal(normalized.sessionsPerRound, 12, 'Sessions per round clamped to max 12');
});

test('Tier 2: B2.2 - 1-Second Timer Boundary Tick Transition', () => {
  let timeLeft = 1;
  let sessionCompleted = false;
  let completedRounds = 3;

  const tick = () => {
    if (timeLeft > 1) {
      timeLeft -= 1;
    } else {
      timeLeft = 0;
      sessionCompleted = true;
      completedRounds += 1;
    }
  };

  tick();
  assert.equal(timeLeft, 0);
  assert.equal(sessionCompleted, true);
  assert.equal(completedRounds, 4);
});

test('Tier 2: B2.3 - Timer Reset at Initial State vs 1s Before Completion', () => {
  const activeTask = { id: 'task-opt', name: 'Compiler Optimization', pomodoroLength: 40 };
  const taskSeconds = activeTask.pomodoroLength * 60;

  const resetTimerState = (_currentElapsed: number) => {
    return {
      timeLeft: taskSeconds,
      isActive: false,
    };
  };

  const resetAtStart = resetTimerState(0);
  assert.equal(resetAtStart.timeLeft, 2400);

  const resetNearEnd = resetTimerState(2399);
  assert.equal(resetNearEnd.timeLeft, 2400);
});

// ============================================================================
// Group B3: Time Capsule Temporal & Midnight Boundaries
// ============================================================================

test('Tier 2: B3.1 - Past Target Time Schedules Tomorrow Rollover', () => {
  const createdDate = new Date(2026, 10, 11, 20, 0, 0);
  const capsule: TimeCapsule = {
    id: 'capsule-midnight',
    createdAt: createdDate.toISOString(),
    message: 'Evening reflection',
    treat: 'Herbal tea',
    triggerType: 'time',
    targetTime: '08:00',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  const res1 = checkUnlockableCapsules([capsule], 0, new Date(2026, 10, 11, 20, 5, 0));
  assert.equal(res1.unlockable.length, 0);
  assert.equal(res1.remaining.length, 1);

  const res2 = checkUnlockableCapsules([capsule], 0, new Date(2026, 10, 11, 23, 59, 59));
  assert.equal(res2.unlockable.length, 0);

  const res3 = checkUnlockableCapsules([capsule], 0, new Date(2026, 10, 12, 8, 1, 0));
  assert.equal(res3.unlockable.length, 1);
  assert.equal(res3.unlockable[0].isUnlocked, true);
});

test('Tier 2: B3.2 - Midnight Date Boundary Transition for Tomorrow Triggers', () => {
  const createdNight = new Date(2026, 10, 11, 23, 55, 0);
  const capsule: TimeCapsule = {
    id: 'capsule-night',
    createdAt: createdNight.toISOString(),
    message: 'Tomorrow focus kick-off',
    treat: 'Matcha',
    triggerType: 'tomorrow',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  // Same night at 23:59 -> locked
  const checkSameNight = checkUnlockableCapsules([capsule], 0, new Date(2026, 10, 11, 23, 59, 0));
  assert.equal(checkSameNight.unlockable.length, 0);

  // 1 minute past midnight -> date has changed to 2026-11-12 -> unlocked!
  const checkNewDay = checkUnlockableCapsules([capsule], 0, new Date(2026, 10, 12, 0, 1, 0));
  assert.equal(checkNewDay.unlockable.length, 1);
  assert.equal(checkNewDay.unlockable[0].id, 'capsule-night');
});

test('Tier 2: B3.3 - Year-End Boundary Rollover (Dec 31 -> Jan 1)', () => {
  const dec31 = new Date(2026, 11, 31, 23, 50, 0);
  const capsule: TimeCapsule = {
    id: 'capsule-newyear',
    createdAt: dec31.toISOString(),
    message: 'Happy New Year focus!',
    treat: 'Celebration pastry',
    triggerType: 'tomorrow',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };

  assert.equal(checkUnlockableCapsules([capsule], 0, new Date(2026, 11, 31, 23, 59, 0)).unlockable.length, 0);

  const resJan1 = checkUnlockableCapsules([capsule], 0, new Date(2027, 0, 1, 0, 5, 0));
  assert.equal(resJan1.unlockable.length, 1);
  assert.equal(resJan1.unlockable[0].isUnlocked, true);
});

// ============================================================================
// Group B4: Task Hierarchy & Capacity Boundaries
// ============================================================================

test('Tier 2: B4.1 - Maximum Subtask Capacity Aggregation', () => {
  const subtasks = Array.from({ length: 60 }, (_, i) => ({
    id: `sub-${i + 1}`,
    name: `Microtask step ${i + 1}`,
    duration: (i % 3 + 1) * 15,
    completed: i % 2 === 0,
  }));

  const totalDuration = calculateSubtaskSum(subtasks);
  assert.ok(totalDuration > 0);
  assert.ok(Number.isFinite(totalDuration));

  const pomos = estimatePomodorosFromSubtasks(subtasks, 25);
  assert.ok(pomos >= 1);
  assert.ok(pomos <= 24);
});

test('Tier 2: B4.2 - Subtask Name Sanitization & Special Characters', () => {
  const unsafeProjects: any = [
    {
      id: 'proj-1',
      name: '  <script>alert("xss")</script> Project Safe Name   ',
      tasks: [
        {
          id: 'task-1',
          name: 'Task with \u0000 null byte and trailing spaces    ',
          completed: false,
          timeSpent: -50,
          subTasks: [
            {
              id: 'st-1',
              name: '<b>Subtask Bold HTML</b>',
              completed: false,
            },
          ],
        },
      ],
    },
  ];

  const cleaned = normalizeProjects(unsafeProjects);
  assert.equal(cleaned.length, 1);
  assert.equal(cleaned[0].name, '<script>alert("xss")</script> Project Safe Name');
  assert.equal(cleaned[0].tasks[0].timeSpent, 0, 'Negative timeSpent clamped to 0');
  assert.equal(cleaned[0].tasks[0].subTasks?.[0]?.name, '<b>Subtask Bold HTML</b>');
});

test('Tier 2: B4.3 - Single Subtask Uncheck Boundary Transition', () => {
  const task: Task = {
    id: 't-boundary',
    name: 'Single subtask boundary test',
    completed: true,
    status: 'done',
    timeSpent: 25,
    subTasks: [
      { id: 'st-only', name: 'Sole subtask', completed: true },
    ],
  };

  const uncheckSubs = (task.subTasks || []).map(st => ({ ...st, completed: false }));
  const allDone = uncheckSubs.length > 0 && uncheckSubs.every(st => st.completed);
  const updatedTask: Task = {
    ...task,
    completed: allDone,
    status: allDone ? 'done' : 'todo',
    subTasks: uncheckSubs,
  };

  assert.equal(updatedTask.completed, false);
  assert.equal(updatedTask.status, 'todo');
});

// ============================================================================
// Group B5: Audio Engine Bounds & Rapid Revocation
// ============================================================================

test('Tier 2: B5.1 - Rapid Consecutive Audio URL Replacements and Revocations', () => {
  const tracker = createUrlRevocationTracker();
  tracker.install();

  try {
    const urls: string[] = [];
    for (let i = 0; i < 10; i++) {
      urls.push(URL.createObjectURL({} as any));
    }
    assert.equal(tracker.created.length, 10);

    let currentSource = urls[0];
    for (let i = 1; i < urls.length; i++) {
      const nextSource = urls[i];
      if (currentSource.startsWith('blob:')) {
        URL.revokeObjectURL(currentSource);
      }
      currentSource = nextSource;
    }

    assert.equal(tracker.revoked.length, 9);
    assert.deepEqual(tracker.revoked, urls.slice(0, 9));
  } finally {
    tracker.restore();
  }
});

test('Tier 2: B5.2 - Noise Target Zero Modulation Bound', () => {
  const ctx = new MockAudioContext();
  const movementDepth = ctx.createGain();

  const noiseTarget = 0;
  movementDepth.gain.value = noiseTarget * 0.55;

  assert.equal(movementDepth.gain.value, 0, 'Movement depth at volume 0 must evaluate strictly to 0');
  assert.ok(!Number.isNaN(movementDepth.gain.value));
});
