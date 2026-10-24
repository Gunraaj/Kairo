import assert from 'node:assert/strict';
import test from 'node:test';
import { detectPresetCategory, PRESET_LIST, SLICE_PRESETS } from '../utils/slicePresets.ts';
import { breakdownProjectTasks, breakdownSubtasks } from '../utils/geminiAi.ts';

test('detectPresetCategory maps keywords to the right archetype', () => {
  // Study keywords
  assert.equal(detectPresetCategory('Calculus 2 Final Exam').id, 'study');
  assert.equal(detectPresetCategory('Biology flashcard revision').id, 'study');
  assert.equal(detectPresetCategory('Physics test prep').id, 'study');

  // Learning keywords
  assert.equal(detectPresetCategory('Learn TypeScript Generics').id, 'learning');
  assert.equal(detectPresetCategory('Docker Tutorial and Course').id, 'learning');
  assert.equal(detectPresetCategory('Japanese Language Skill').id, 'learning');

  // Writing keywords
  assert.equal(detectPresetCategory('Draft research paper thesis').id, 'writing');
  assert.equal(detectPresetCategory('Write Substack newsletter article').id, 'writing');

  // Working / Engineering defaults
  assert.equal(detectPresetCategory('Refactor backend API endpoints').id, 'working');
  assert.equal(detectPresetCategory('Customer onboarding dashboard').id, 'working');
});

test('PRESET_LIST includes all 4 primary study/learning/work archetypes', () => {
  assert.equal(PRESET_LIST.length, 4);
  const ids = PRESET_LIST.map(p => p.id);
  assert.ok(ids.includes('study'));
  assert.ok(ids.includes('learning'));
  assert.ok(ids.includes('working'));
  assert.ok(ids.includes('writing'));

  for (const preset of PRESET_LIST) {
    assert.ok(preset.projectTasks.length >= 3, `${preset.id} has at least 3 project tasks`);
    assert.ok(preset.subtaskSteps.length >= 3, `${preset.id} has at least 3 subtask steps`);
    for (const task of preset.projectTasks) {
      assert.ok(task.targetRounds >= 1, `${task.name} has at least 1 target round`);
    }
  }
});

test('breakdownProjectTasks and breakdownSubtasks produce tailored presets offline', async () => {
  const studyTasks = await breakdownProjectTasks('Organic Chemistry Midterm Exam');
  assert.ok(studyTasks.length >= 3);
  assert.ok(studyTasks.some(t => t.name.toLowerCase().includes('recall') || t.name.toLowerCase().includes('practice')));

  const codingTasks = await breakdownProjectTasks('Build Auth Service');
  assert.ok(codingTasks.length >= 3);
  assert.ok(codingTasks.some(t => t.name.toLowerCase().includes('architecture') || t.name.toLowerCase().includes('sprint') || t.name.toLowerCase().includes('test')));

  const subtasks = await breakdownSubtasks('Review Linear Algebra Formulas');
  assert.ok(subtasks.length >= 3);
  assert.ok(subtasks.some(st => st.toLowerCase().includes('recall') || st.toLowerCase().includes('concept') || st.toLowerCase().includes('drill')));
});
