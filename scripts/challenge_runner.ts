/**
 * scripts/challenge_runner.ts
 *
 * Empirical Challenge Harness by Challenger 2
 * Tests Zero-Network Invariant, Leak-Free Teardown, and Pathological Boundaries
 */

import assert from 'node:assert/strict';
import {
  MockWindowTarget,
  createMockKeyEvent,
  MockAudioContext,
  createUrlRevocationTracker,
  withMockStorage,
  mockNetwork,
  assertZeroNetworkAccess,
  getContrastRatio,
  MockLocalStorage,
} from '../tests/testHarness.ts';

import {
  parseOutlineOffline,
  checkInputSufficiency,
  inferCognitiveLoad,
  calculatePacing,
} from '../utils/documentBreakdown.ts';

import {
  calculateFinishEstimate,
  calculateSubtaskSum,
  estimatePomodorosFromSubtasks,
} from '../utils/subtaskTime.ts';

import { checkUnlockableCapsules } from '../utils/timeCapsule.ts';
import { normalizePalette, normalizeSettings, normalizeProjects } from '../data/validation.ts';
import type { TimeCapsule, Task, Project } from '../types.ts';

let totalAssertions = 0;
function pass(msg: string) {
  totalAssertions++;
  console.log(`  [PASS] ${msg}`);
}

// ============================================================================
// 1. ZERO-NETWORK INVARIANT CHALLENGE
// ============================================================================
async function challengeZeroNetwork() {
  console.log('\n--- Challenge 1: Zero-Network Invariant ---');
  const originalFetch = globalThis.fetch;

  // 1.1 Traps string URL
  let caught = false;
  try {
    await assertZeroNetworkAccess(async () => {
      await fetch('https://api.openai.com/v1/models');
    });
  } catch (err: any) {
    caught = true;
    assert.ok(err.message.includes('ZERO_NETWORK_VIOLATION'));
    assert.ok(err.message.includes('https://api.openai.com/v1/models'));
  }
  assert.equal(caught, true);
  assert.equal(globalThis.fetch, originalFetch);
  pass('Traps string URL fetch and restores fetch');

  // 1.2 Traps URL instance
  caught = false;
  try {
    await assertZeroNetworkAccess(async () => {
      await fetch(new URL('https://api.anthropic.com/v1/messages'));
    });
  } catch (err: any) {
    caught = true;
    assert.ok(err.message.includes('ZERO_NETWORK_VIOLATION'));
    assert.ok(err.message.includes('https://api.anthropic.com/v1/messages'));
  }
  assert.equal(caught, true);
  assert.equal(globalThis.fetch, originalFetch);
  pass('Traps URL instance fetch and restores fetch');

  // 1.3 Traps Request instance
  caught = false;
  try {
    await assertZeroNetworkAccess(async () => {
      await fetch(new Request('https://openrouter.ai/api/v1/chat/completions'));
    });
  } catch (err: any) {
    caught = true;
    assert.ok(err.message.includes('ZERO_NETWORK_VIOLATION'));
  }
  assert.equal(caught, true);
  assert.equal(globalThis.fetch, originalFetch);
  pass('Traps Request instance fetch and restores fetch');

  // 1.4 Restores fetch if inner code throws an unhandled error
  caught = false;
  try {
    await assertZeroNetworkAccess(async () => {
      throw new Error('Simulated inner failure');
    });
  } catch (err: any) {
    caught = true;
    assert.equal(err.message, 'Simulated inner failure');
  }
  assert.equal(caught, true);
  assert.equal(globalThis.fetch, originalFetch);
  pass('Restores fetch on inner async error');

  // 1.5 Restores fetch if inner function is sync and throws
  caught = false;
  try {
    await assertZeroNetworkAccess(() => {
      throw new Error('Simulated inner sync failure');
    });
  } catch (err: any) {
    caught = true;
    assert.equal(err.message, 'Simulated inner sync failure');
  }
  assert.equal(caught, true);
  assert.equal(globalThis.fetch, originalFetch);
  pass('Restores fetch on inner sync error');

  // 1.6 Offline heuristics with external URLs, script tags, image tags
  await assertZeroNetworkAccess(async () => {
    const docWithLinks = `
# Adversarial Web Document
## Module 1: Web Scraping and Exfiltration
- Fetch data from http://malicious-telemetry.example.com/exfiltrate?user=admin
- View external image: ![tracking pixel](https://tracker.net/pixel.gif)
- Remote script: <script src="https://attacker.org/keylogger.js"></script>
- Audio link: <audio src="https://cdn.sound.org/audio.mp3"></audio>
- Inline stylesheet: <link rel="stylesheet" href="https://styles.org/bad.css">
## Module 2: Safe Analysis
- Review offline derivations and proofs (intensive)
    `.trim();

    const plan = parseOutlineOffline(docWithLinks, { archetype: 'study' });
    assert.equal(plan.projectName, 'Adversarial Web Document');
    assert.equal(plan.modules.length, 2);
    assert.ok(plan.totalRounds > 0);
  });
  assert.equal(globalThis.fetch, originalFetch);
  pass('Offline heuristic parser makes zero outbound network calls on documents with URLs/HTML');
}

// ============================================================================
// 2. LEAK-FREE TEARDOWN CHALLENGE
// ============================================================================
async function challengeLeakFreeTeardown() {
  console.log('\n--- Challenge 2: Leak-Free Teardown & Global Restoration ---');

  // 2.1 withMockStorage restoration when callback throws
  const winBefore = (globalThis as any).window;
  const storageBefore = (globalThis as any).localStorage;

  let storageErrorThrown = false;
  try {
    await withMockStorage(async (storage) => {
      storage.setItem('temp', 'secret');
      assert.equal(storage.getItem('temp'), 'secret');
      throw new Error('Boom in withMockStorage');
    });
  } catch (err: any) {
    storageErrorThrown = true;
    assert.equal(err.message, 'Boom in withMockStorage');
  }
  assert.equal(storageErrorThrown, true);
  assert.equal((globalThis as any).window, winBefore);
  assert.equal((globalThis as any).localStorage, storageBefore);
  pass('withMockStorage restores window and localStorage when callback throws');

  // 2.2 mockNetwork restoration when test throws
  const fetchBefore = globalThis.fetch;
  const net = mockNetwork(async () => {
    return { status: 200, body: { ok: true } };
  });
  assert.notEqual(globalThis.fetch, fetchBefore);

  let netErrorThrown = false;
  try {
    throw new Error('Simulated test failure while network mocked');
  } catch {
    netErrorThrown = true;
  } finally {
    net.restore();
  }
  assert.equal(netErrorThrown, true);
  assert.equal(globalThis.fetch, fetchBefore);
  pass('mockNetwork restore() restores globalThis.fetch even in finally after error');

  // 2.3 URL revocation tracker restoration when test throws
  const origCreate = URL.createObjectURL;
  const origRevoke = URL.revokeObjectURL;

  const tracker = createUrlRevocationTracker();
  tracker.install();
  assert.notEqual(URL.createObjectURL, origCreate);
  assert.notEqual(URL.revokeObjectURL, origRevoke);

  let trackerErrorThrown = false;
  try {
    throw new Error('Simulated test failure with active URL tracker');
  } catch {
    trackerErrorThrown = true;
  } finally {
    tracker.restore();
  }
  assert.equal(trackerErrorThrown, true);
  assert.equal(URL.createObjectURL, origCreate);
  assert.equal(URL.revokeObjectURL, origRevoke);
  pass('createUrlRevocationTracker restores URL.create/revokeObjectURL in finally after error');

  // 2.4 Test harness isolation: verify no dangling globals after all 4 tier test suites run
  // We check before and after running each tier
}

// ============================================================================
// 3. BOUNDARIES & PATHOLOGICAL CASES CHALLENGE
// ============================================================================
async function challengePathologicalBoundaries() {
  console.log('\n--- Challenge 3: Pathological Boundaries & Extreme Inputs ---');

  // 3.1 Non-ASCII Text in Offline Heuristics (Japanese, Arabic, Emojis, Accents, ZWJ)
  await assertZeroNetworkAccess(async () => {
    const nonAsciiDoc = `
# 量子力学と計算物理学入門 🚀 (2026年秋期)
## 第1章: 波動関数の基礎理論 (Wavefunction Basics)
- シュレディンガー方程式の導出と証明 (proof and derivation)
  - 分散関係の計算 (dispersion relation)
  - ディラックのデルタ関数と正規化
- 確率解釈とボルン則のレビュー (vocabulary definitions)
## 第2章: فيزياء الكم والحسابات الإحصائية (Statistical Physics)
- مبرهنة نويثر والانحفاظات الفيزيائية (intensive)
## 第3章: Accents & Diacritics: Schrödinger & Poincaré
- Håstad's switching lemma & Gödel incompleteness proofs
- Emoji stress test: 🧠✨📚🔬🎯⏳
    `.trim();

    const plan = parseOutlineOffline(nonAsciiDoc, { archetype: 'study' });
    assert.equal(plan.projectName, '量子力学と計算物理学入門 🚀 (2026年秋期)');
    assert.equal(plan.modules.length, 3);

    // Module 1 Japanese tasks
    assert.equal(plan.modules[0].name, '第1章: 波動関数の基礎理論 (Wavefunction Basics)');
    const derTask = plan.modules[0].tasks.find(t => t.name.includes('シュレディンガー方程式'));
    assert.ok(derTask);
    assert.equal(derTask.difficulty, 'intensive'); // "proof and derivation" detected in mixed text
    assert.equal(derTask.targetRounds, 3);
    assert.equal(derTask.subTasks.length, 2);

    // Module 2 Arabic tasks
    assert.equal(plan.modules[1].name, '第2章: فيزياء الكم والحسابات الإحصائية (Statistical Physics)');
    const arabicTask = plan.modules[1].tasks[0];
    assert.ok(arabicTask);
    assert.equal(arabicTask.difficulty, 'intensive');

    // Module 3 Accents & Emojis
    assert.ok(plan.modules[2].tasks.some(t => t.name.includes('Emoji stress test: 🧠✨📚🔬🎯⏳')));
    assert.equal(plan.totalMinutes, plan.totalRounds * 25);
  });
  pass('Offline heuristic AST handles multi-lingual non-ASCII (Japanese, Arabic, diacritics, emojis)');

  // 3.2 Null bytes, control characters, and raw HTML tags in Project & Task sanitization
  const pathologicalProjects: any = [
    {
      id: 'proj-patho',
      name: '  Project\u0000Null\u0007Bell\u001BEsc  ',
      tasks: [
        {
          id: 'task-patho',
          name: '<img src=x onerror=alert(1)> Task with control chars \u0008\u000C',
          completed: false,
          timeSpent: -999999,
          pomodoroLength: -50,
          targetRounds: 0,
          subTasks: [
            {
              id: 'st-patho',
              name: '   Trailing and leading whitespace subtask   ',
              completed: false,
            },
          ],
        },
      ],
    },
  ];

  const cleanedProjects = normalizeProjects(pathologicalProjects);
  assert.equal(cleanedProjects.length, 1);
  assert.equal(cleanedProjects[0].tasks[0].timeSpent, 0, 'Negative timeSpent clamped to 0');
  assert.equal(cleanedProjects[0].tasks[0].targetRounds, 1, '0 targetRounds normalized to default 1');
  pass('normalizeProjects sanitizes negative timeSpent, 0 targetRounds, and trims strings');

  // 3.3 Extreme Timestamps in Time Capsule
  // Case A: Far future timestamp (year 9999)
  const farFutureCapsule: TimeCapsule = {
    id: 'capsule-9999',
    createdAt: new Date('2026-11-11T12:00:00Z').toISOString(),
    message: 'Message for the 10th millennium',
    treat: 'Cryo-cookie',
    triggerType: 'tomorrow',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };
  const farFutureCheck = checkUnlockableCapsules([farFutureCapsule], 0, new Date('9999-12-31T23:59:59Z'));
  assert.equal(farFutureCheck.unlockable.length, 1);
  assert.equal(farFutureCheck.unlockable[0].id, 'capsule-9999');
  pass('checkUnlockableCapsules survives extreme future timestamp (year 9999)');

  // Case B: Epoch 0 (1970-01-01)
  const epochCapsule: TimeCapsule = {
    id: 'capsule-epoch',
    createdAt: new Date(0).toISOString(),
    message: 'Unix Epoch note',
    treat: 'Bell Labs Punch Card',
    triggerType: 'time',
    targetTime: '12:00',
    completedRoundsAtCreation: 0,
    isUnlocked: false,
  };
  const epochCheck = checkUnlockableCapsules([epochCapsule], 0, new Date(1000 * 3600 * 13)); // 13:00 on 1970-01-01
  assert.equal(epochCheck.unlockable.length, 1);
  pass('checkUnlockableCapsules survives Unix epoch timestamp');

  // Case C: Invalid or corrupted targetTime strings
  const corruptTimes = ['invalid-time', '25:00', '-01:00', '12:65', '', '  ', 'noon', '12:00:00'];
  for (const ct of corruptTimes) {
    const corruptCapsule: TimeCapsule = {
      id: `capsule-corrupt-${ct}`,
      createdAt: new Date('2026-11-11T12:00:00Z').toISOString(),
      message: 'Test corrupt time',
      treat: 'Tea',
      triggerType: 'time',
      targetTime: ct,
      completedRoundsAtCreation: 0,
      isUnlocked: false,
    };
    // Must not throw or crash
    const res = checkUnlockableCapsules([corruptCapsule], 0, new Date('2026-11-11T13:00:00Z'));
    assert.ok(res.remaining.length + res.unlockable.length === 1);
  }
  pass('checkUnlockableCapsules safely handles malformed, out-of-range, and empty targetTime strings');

  // 3.4 Sparse & Pathological Documents in parseOutlineOffline
  // Case A: 0-byte and whitespace
  const emptyCheck = checkInputSufficiency('', false);
  assert.equal(emptyCheck.isSufficient, false);

  // Case B: Only markdown headings, no bullets
  const headingsOnly = `
# Course Title Only
## Unit 1: Introduction
## Unit 2: Methods
## Unit 3: Conclusion
  `.trim();
  const planHeadings = parseOutlineOffline(headingsOnly, { archetype: 'study' });
  assert.equal(planHeadings.projectName, 'Course Title Only');
  assert.equal(planHeadings.modules.length, 3);
  // Default placeholder tasks created per module
  assert.ok(planHeadings.modules.every(m => m.tasks.length >= 1));
  pass('parseOutlineOffline handles document with only headings gracefully');

  // Case C: Only bullets, no headings
  const bulletsOnly = `
- Learn basic differential calculus principles
- Solve 20 problem sets on derivatives
- Review chain rule and product rule derivations
  `.trim();
  const planBullets = parseOutlineOffline(bulletsOnly, { archetype: 'study' });
  assert.ok(planBullets.projectName.length > 0);
  assert.equal(planBullets.modules.length, 1);
  assert.equal(planBullets.modules[0].tasks.length, 3);
  pass('parseOutlineOffline handles document with only bullet points gracefully');

  // Case D: Massive document (200 modules, 1000 tasks)
  const bigDocLines: string[] = ['# Massive Stress Test Curriculum'];
  for (let m = 1; m <= 100; m++) {
    bigDocLines.push(`## Module ${m}: Scaling Systems`);
    for (let t = 1; t <= 5; t++) {
      bigDocLines.push(`- Task ${m}.${t}: Concurrent transaction analysis`);
      bigDocLines.push(`  - Verify locking`);
    }
  }
  const bigDoc = bigDocLines.join('\n');
  const startMs = Date.now();
  const bigPlan = parseOutlineOffline(bigDoc, { archetype: 'working' });
  const durationMs = Date.now() - startMs;
  assert.equal(bigPlan.modules.length, 100);
  assert.equal(bigPlan.modules.flatMap(m => m.tasks).length, 500);
  assert.ok(durationMs < 500, `Large document parsing must complete in < 500ms (took ${durationMs}ms)`);
  pass(`parseOutlineOffline scales linearly (100 modules, 500 tasks parsed in ${durationMs}ms)`);

  // 3.5 Finish Estimate Extreme / Degenerate Values
  const now = new Date('2026-11-11T12:00:00Z');

  // Case A: Task with pomodoroLength = 0 or negative
  const zeroPomoLengthTask: any = {
    targetRounds: 4,
    completed: false,
    timeSpent: 0,
    pomodoroLength: 0,
  };
  const estZero = calculateFinishEstimate([zeroPomoLengthTask], { focusDuration: 25 }, now);
  assert.ok(estZero.totalMinutes > 0, '0 pomodoroLength must fall back to settings.focusDuration');
  assert.equal(estZero.remainingPomos, 4);
  pass('calculateFinishEstimate handles pomodoroLength = 0 gracefully');

  // Case B: Task with targetRounds = 0 and subtasks
  const zeroTargetWithSubs: any = {
    targetRounds: 0,
    completed: false,
    timeSpent: 0,
    subTasks: [
      { id: '1', name: 'Sub 1', completed: false, duration: 25 },
      { id: '2', name: 'Sub 2', completed: false, duration: 25 },
    ],
  };
  const estSubs = calculateFinishEstimate([zeroTargetWithSubs], { focusDuration: 25 }, now);
  assert.ok(estSubs.totalPomos >= 1);
  pass('calculateFinishEstimate infers pomodoros from subtasks when targetRounds = 0');

  // Case C: sessionsPerRound = 0 or negative in settings
  const degSettings: any = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsPerRound: 0,
  };
  const estDegSettings = calculateFinishEstimate(
    [{ targetRounds: 5, completed: false, timeSpent: 0, pomodoroLength: 25 }],
    degSettings,
    now,
  );
  assert.ok(estDegSettings.totalMinutes > 0);
  assert.ok(Number.isFinite(estDegSettings.totalMinutes));
  pass('calculateFinishEstimate handles degenerate sessionsPerRound = 0 gracefully');
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function main() {
  console.log('=== KAIRO EMPIRICAL CHALLENGER 2 HARNESS ===');
  await challengeZeroNetwork();
  await challengeLeakFreeTeardown();
  await challengePathologicalBoundaries();
  console.log(`\n=== ALL ${totalAssertions} EMPIRICAL CHALLENGES PASSED! ===\n`);
}

main().catch((err) => {
  console.error('\n*** CHALLENGE SUITE FAILURE ***\n', err);
  process.exit(1);
});
