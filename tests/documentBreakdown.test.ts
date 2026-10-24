import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseOutlineOffline,
  inferCognitiveLoad,
  calculatePacing,
  checkInputSufficiency,
  SAMPLE_TEMPLATES,
} from '../utils/documentBreakdown.ts';

test('inferCognitiveLoad classifies text based on cognitive keywords', () => {
  // Light keywords (1 round = 25m)
  assert.deepEqual(inferCognitiveLoad('Introduction to Microeconomics Overview'), {
    difficulty: 'light',
    targetRounds: 1,
  });
  assert.deepEqual(inferCognitiveLoad('Vocabulary definitions & glossary review notes'), {
    difficulty: 'light',
    targetRounds: 1,
  });

  // Intensive keywords (3 rounds = 75m)
  assert.deepEqual(inferCognitiveLoad('Taylor Series comprehensive proof and exam problem set'), {
    difficulty: 'intensive',
    targetRounds: 3,
  });
  assert.deepEqual(inferCognitiveLoad('Full-stack distributed architecture refactor'), {
    difficulty: 'intensive',
    targetRounds: 3,
  });

  // Standard (2 rounds = 50m default)
  assert.deepEqual(inferCognitiveLoad('Implement JWT authentication middleware'), {
    difficulty: 'standard',
    targetRounds: 2,
  });
});

test('calculatePacing handles valid and edge-case dates gracefully', () => {
  // Empty or invalid deadline
  assert.deepEqual(calculatePacing(20, undefined), {});
  assert.deepEqual(calculatePacing(20, 'invalid-date-string'), {});

  // Future deadline: 10 days away
  const future = new Date();
  future.setDate(future.getDate() + 10);
  const futureStr = future.toISOString().split('T')[0];

  const pacing = calculatePacing(30, futureStr);
  assert.ok(pacing.daysRemaining && pacing.daysRemaining >= 9 && pacing.daysRemaining <= 11);
  assert.ok(pacing.roundsPerDay && pacing.roundsPerDay >= 3);
});

test('parseOutlineOffline parses markdown syllabus into modules, tasks, and subtasks', () => {
  const markdown = `# Operating Systems Syllabus
## Module 1: Processes and Threads
- Process Control Blocks and State Transitions (review notes)
  - Understand PCB fields and context switching
  - Trace state changes: Ready, Running, Waiting
- Thread Pools and Concurrency Race Conditions
  - Mutex locks vs Semaphores
  - Deadlock prevention Banker algorithm practice

## Module 2: Memory Management & Virtual Memory
- Paging and Page Table Architecture
  - Multi-level page tables
  - TLB hit ratio derivations
- Page Replacement Algorithms lab exercises
  - FIFO, LRU, and Optimal comparison`;

  const plan = parseOutlineOffline(markdown, { archetype: 'study' });

  assert.equal(plan.projectName, 'Operating Systems Syllabus');
  assert.equal(plan.modules.length, 2);
  assert.equal(plan.modules[0].name, 'Module 1: Processes and Threads');
  assert.equal(plan.modules[1].name, 'Module 2: Memory Management & Virtual Memory');

  // Verify Tasks in Module 1
  const mod1Tasks = plan.modules[0].tasks;
  assert.equal(mod1Tasks.length, 2);
  assert.equal(mod1Tasks[0].name, 'Process Control Blocks and State Transitions (review notes)');
  assert.equal(mod1Tasks[0].difficulty, 'light'); // from "review notes"
  assert.equal(mod1Tasks[0].targetRounds, 1);
  assert.equal(mod1Tasks[0].subTasks.length, 2);
  assert.equal(mod1Tasks[0].subTasks[0].name, 'Understand PCB fields and context switching');

  // Verify Tasks in Module 2
  const mod2Tasks = plan.modules[1].tasks;
  assert.equal(mod2Tasks.length, 2);
  assert.equal(mod2Tasks[0].difficulty, 'intensive'); // from "Architecture"
  assert.equal(mod2Tasks[0].targetRounds, 3);
  assert.equal(mod2Tasks[1].difficulty, 'standard'); // from "lab exercises"
  assert.equal(mod2Tasks[1].targetRounds, 2);

  // Total rounds
  assert.equal(plan.totalRounds, 1 + 2 + 3 + 2); // 8 rounds
  assert.equal(plan.totalMinutes, 8 * 25); // 200 minutes
});

test('SAMPLE_TEMPLATES parse cleanly with zero errors', () => {
  for (const template of SAMPLE_TEMPLATES) {
    const plan = parseOutlineOffline(template.content, { archetype: template.archetype });
    assert.ok(plan.projectName.length > 0);
    assert.ok(plan.modules.length >= 2, `${template.id} has at least 2 modules`);
    assert.ok(plan.totalRounds > 0);
    for (const m of plan.modules) {
      assert.ok(m.tasks.length > 0);
      for (const t of m.tasks) {
        assert.ok(t.subTasks.length > 0);
      }
    }
  }
});

test('checkInputSufficiency catches sparse or ambiguous input to prevent boilerplate BS', () => {
  const short1 = checkInputSufficiency('math');
  assert.equal(short1.isSufficient, false);
  assert.ok(short1.reason?.includes('math'));

  const short2 = checkInputSufficiency('exam prep');
  assert.equal(short2.isSufficient, false);

  // File uploads are treated as having data
  const fileCheck = checkInputSufficiency('', true);
  assert.equal(fileCheck.isSufficient, true);

  // Structured multi-line syllabus is sufficient
  const good = checkInputSufficiency(`
    # Linear Algebra
    - Vector Spaces & Subspaces
    - Linear Independence & Bases
    - Matrix Inverses & Determinants
  `);
  assert.equal(good.isSufficient, true);
});
