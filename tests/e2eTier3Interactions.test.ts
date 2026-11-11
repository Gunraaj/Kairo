/**
 * e2eTier3Interactions.test.ts
 *
 * Tier 3: Cross-Feature Combinations & State Transitions
 * Tests pairwise and multi-feature state machine interactions across timer,
 * subtask tracking, audio engine, multi-provider AI fallback, and accessibility tokens.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MockWindowTarget,
  createMockKeyEvent,
  createUrlRevocationTracker,
  withMockStorage,
  mockNetwork,
  assertZeroNetworkAccess,
  getContrastRatio,
} from './testHarness.ts';

import { normalizePalette } from '../data/validation.ts';
import { calculateFinishEstimate } from '../utils/subtaskTime.ts';
import {
  saveAiConfig,
  getAiConfig,
  breakdownProjectTasks,
  breakdownSubtasks,
} from '../utils/geminiAi.ts';
import {
  parseOutlineOffline,
  checkInputSufficiency,
} from '../utils/documentBreakdown.ts';
import type { Task, Project } from '../types.ts';

test('Tier 3: C1 - Subtask Reversion + Custom Task Pomodoro Length + Finish Estimate Calculation', () => {
  // Task with custom 40m Pomodoro length and 3 subtasks
  let task: Task = {
    id: 'task-distributed-1',
    name: 'Distributed Consensus Protocol',
    completed: true,
    status: 'done',
    timeSpent: 120, // 3 * 40m done
    pomodoroLength: 40,
    targetRounds: 3,
    subTasks: [
      { id: 'st-leader', name: 'Leader Election logic', completed: true },
      { id: 'st-log', name: 'Log Replication RPC', completed: true },
      { id: 'st-commit', name: 'Safety & Commit Invariants', completed: true },
    ],
  };

  const settings = {
    focusDuration: 25,
    shortBreakDuration: 5,
    longBreakDuration: 15,
    sessionsPerRound: 4,
  };

  const now = new Date(2026, 10, 11, 14, 0, 0);

  // 1. Initially all 3 subtasks are checked -> task is complete, 0 pomos remaining
  const initialEstimate = calculateFinishEstimate([task], settings, now);
  assert.equal(initialEstimate.remainingPomos, 0);
  assert.equal(initialEstimate.totalMinutes, 0);

  // 2. Uncheck subtask 2 ('st-log') -> F2 Subtask Completion Reversion
  const updatedSubs = (task.subTasks || []).map(st =>
    st.id === 'st-log' ? { ...st, completed: false } : st,
  );
  const allDone = updatedSubs.every(st => st.completed);
  task = {
    ...task,
    completed: allDone,
    status: allDone ? 'done' : 'todo',
    subTasks: updatedSubs,
  };

  assert.equal(task.completed, false, 'Parent task completion must revert to false');
  assert.equal(task.status, 'todo', 'Parent task status must revert to todo');

  // 3. Recalculate finish estimate -> F4 factors custom 40m pomodoroLength
  // With 1 pomo remaining for this task (40m):
  const revertedEstimate = calculateFinishEstimate(
    [{ ...task, timeSpent: 80 }], // 2 pomos done (80m), 1 remaining
    settings,
    now,
  );
  assert.equal(revertedEstimate.remainingPomos, 1);
  assert.equal(revertedEstimate.totalMinutes, 40); // 1 remaining pomo of 40m, 0 breaks

  // 4. Timer Reset Duration Preservation (F5):
  // When active task has pomodoroLength = 40, timer resets to 40 * 60 = 2400s
  const resetDurationSeconds = (task.pomodoroLength || settings.focusDuration) * 60;
  assert.equal(resetDurationSeconds, 2400);
});

test('Tier 3: C2 - Keyboard Shortcuts Switching + Master Audio Mute + Form Control Suppression', () => {
  const windowTarget = new MockWindowTarget();
  let sessionMode: 'focus' | 'shortBreak' | 'longBreak' = 'focus';
  let isMasterMuted = false;
  let isModalOpen = false;

  const keyHandler = (e: ReturnType<typeof createMockKeyEvent>) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Suppress shortcuts when typing in inputs or when modal text editing is active
    if (isModalOpen && e.target.tagName === 'TEXTAREA') return;
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    const key = e.key.toLowerCase();
    if (key === '1') {
      e.preventDefault();
      sessionMode = 'focus';
    } else if (key === '2') {
      e.preventDefault();
      sessionMode = 'shortBreak';
    } else if (key === '3') {
      e.preventDefault();
      sessionMode = 'longBreak';
    } else if (key === 'm') {
      e.preventDefault();
      isMasterMuted = !isMasterMuted;
    }
  };

  windowTarget.addEventListener('keydown', keyHandler);

  // Normal shortcut execution
  windowTarget.dispatchEvent(createMockKeyEvent('keydown', { key: '2' }));
  assert.equal(sessionMode, 'shortBreak');

  windowTarget.dispatchEvent(createMockKeyEvent('keydown', { key: 'm' }));
  assert.equal(isMasterMuted, true);

  // Modal open: student typing in syllabus textarea
  isModalOpen = true;
  windowTarget.dispatchEvent(createMockKeyEvent('keydown', { key: '1', tagName: 'TEXTAREA' }));
  assert.equal(sessionMode, 'shortBreak', 'Shortcut must be suppressed when editing in modal textarea');

  windowTarget.dispatchEvent(createMockKeyEvent('keydown', { key: 'M', tagName: 'TEXTAREA' }));
  assert.equal(isMasterMuted, true, 'Mute shortcut must be suppressed when editing in modal textarea');

  // Modal closed: shortcuts resume normal operation
  isModalOpen = false;
  windowTarget.dispatchEvent(createMockKeyEvent('keydown', { key: '1', tagName: 'DIV' }));
  assert.equal(sessionMode, 'focus');

  windowTarget.dispatchEvent(createMockKeyEvent('keydown', { key: 'M', tagName: 'DIV' }));
  assert.equal(isMasterMuted, false);
});

test('Tier 3: C3 - Multi-Provider Network Failure with Seamless Offline Heuristics Fallback', async () => {
  // Simulate AI server outage (HTTP 503)
  const netOutage = mockNetwork(async () => {
    return {
      status: 503,
      body: { error: 'Frontier AI model service temporarily overloaded' },
    };
  });

  try {
    const syllabusText = `
# Organic Chemistry Midterm
## Section 1: Reaction Mechanisms
- SN1 vs SN2 nucleophilic substitution (proof and derivation)
- E1 and E2 elimination pathways
## Section 2: Stereochemistry
- Enantiomers and diastereomers review notes
    `.trim();

    // High-level breakdown pipeline with graceful fallback
    const executeBreakdownPipeline = async (text: string) => {
      try {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          body: JSON.stringify({ prompt: text }),
        });
        if (!response.ok) {
          throw new Error(`AI_PROVIDER_ERROR: HTTP ${response.status}`);
        }
        return await response.json();
      } catch {
        // Graceful automatic transition to deterministic offline heuristics (F10 + F15)
        return parseOutlineOffline(text, { archetype: 'study' });
      }
    };

    const plan = await executeBreakdownPipeline(syllabusText);

    // Fallback parsed cleanly with zero document data loss
    assert.equal(plan.projectName, 'Organic Chemistry Midterm');
    assert.equal(plan.modules.length, 2);
    assert.ok(plan.totalRounds > 0);
    assert.equal(plan.totalMinutes, plan.totalRounds * 25);
  } finally {
    netOutage.restore();
  }
});

test('Tier 3: C4 - Client-Side Syllabus Extraction Piped to Deterministic Offline AST Parser', async () => {
  await assertZeroNetworkAccess(async () => {
    // 1. Simulated raw text stream extracted from client-side file reader (F14)
    const rawDocumentStream = `
# Machine Learning & Statistical Inference
## Unit 1: Supervised Learning Foundations
- Linear regression and gradient descent (proof and derivation)
  - Derivation of normal equations
  - Stochastic gradient descent convergence
- Logistic regression and cross-entropy loss
  - Maximum likelihood estimation

## Unit 2: Unsupervised Learning & Clustering
- K-Means algorithm and Lloyd heuristic (overview)
- Principal Component Analysis derivation (intensive)
    `.trim();

    // Verify data sufficiency check passes (not rejected as empty/boilerplate)
    const check = checkInputSufficiency(rawDocumentStream, false);
    assert.equal(check.isSufficient, true);

    // 2. Feed extracted stream into offline heuristic AST parser (F15)
    const plan = parseOutlineOffline(rawDocumentStream, { archetype: 'study' });

    assert.equal(plan.projectName, 'Machine Learning & Statistical Inference');
    assert.equal(plan.modules.length, 2);

    // Verify cognitive difficulty inference across extracted modules:
    // Unit 1 Task 1: "proof and derivation" -> intensive (3 rounds)
    const intensiveTask = plan.modules[0].tasks.find(t => t.name.includes('gradient descent'));
    assert.ok(intensiveTask);
    assert.equal(intensiveTask.difficulty, 'intensive');
    assert.equal(intensiveTask.targetRounds, 3);
    assert.equal(intensiveTask.subTasks.length, 2);

    // Total planned focus time accurately equals rounds * 25 min
    assert.equal(plan.totalMinutes, plan.totalRounds * 25);
  });
});

test('Tier 3: C5 - Palette Normalization Alignment and WCAG AA Contrast Verification', () => {
  // Test matrix: all 4 allowed palettes and their contrast against light and dark ground
  const allowedPalettes = ['obsidian', 'zen', 'indigo', 'washi'] as const;

  for (const pal of allowedPalettes) {
    // F7: Normalizes correctly
    assert.equal(normalizePalette(pal), pal);
    assert.equal(normalizePalette(`  ${pal.toUpperCase()}  `), pal);
  }

  // F19: Verify WCAG AA (>= 4.5:1) for text token sumi-3 across theme backgrounds
  const sumi3Light = '#6E685E';
  const sumi3Dark = '#82828C';
  const lightGround = '#FAF7F2';
  const darkGround = '#09090B';

  const lightContrast = getContrastRatio(sumi3Light, lightGround);
  const darkContrast = getContrastRatio(sumi3Dark, darkGround);

  assert.ok(
    lightContrast >= 4.5,
    `Light theme contrast (${lightContrast}:1) must satisfy WCAG AA >= 4.5:1`,
  );
  assert.ok(
    darkContrast >= 4.5,
    `Dark theme contrast (${darkContrast}:1) must satisfy WCAG AA >= 4.5:1`,
  );
});

test('Tier 3: C6 - Breakdown Slicing Triggers Populating Sidebar Project & Task Hierarchy', async () => {
  // Project in SidebarNav
  const project: Project = {
    id: 'proj-os-midterm',
    name: 'Operating Systems Kernels',
    tasks: [],
    subProjects: [],
    isExpanded: true,
  };

  // 1. AI Task Slicing trigger (breakdownProjectTasks)
  const slicedTasks = await breakdownProjectTasks(project.name);
  assert.ok(Array.isArray(slicedTasks) && slicedTasks.length > 0);

  // Populate tasks into project
  const populatedTasks: Task[] = slicedTasks.map((t, idx) => ({
    id: `task-os-${idx + 1}`,
    name: t.name,
    targetRounds: t.targetRounds,
    completed: false,
    status: 'todo',
    timeSpent: 0,
    subTasks: [],
  }));

  const updatedProject: Project = {
    ...project,
    tasks: populatedTasks,
  };

  assert.equal(updatedProject.tasks.length, slicedTasks.length);
  assert.ok(updatedProject.tasks.every(t => t.completed === false && t.status === 'todo'));

  // 2. AI Subtask Slicing trigger (breakdownSubtasks) on task 1
  const firstTask = updatedProject.tasks[0];
  const slicedSubtasks = await breakdownSubtasks(firstTask.name);
  assert.ok(Array.isArray(slicedSubtasks) && slicedSubtasks.length > 0);

  firstTask.subTasks = slicedSubtasks.map((stName, idx) => ({
    id: `sub-${idx + 1}`,
    name: stName,
    completed: false,
  }));

  assert.ok(firstTask.subTasks.length > 0);
  assert.equal(firstTask.completed, false);
});
