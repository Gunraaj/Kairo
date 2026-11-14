import assert from 'node:assert/strict';
import test from 'node:test';
import type { Project } from '../types.ts';
import { bridgeToImports, buildAiContext, decodePlanLink, encodePlanLink, parseAiPlan } from '../utils/aiBridge.ts';

const project: Project = {
  id: 'p1', name: 'Algebra', subProjects: [], isExpanded: true, deadline: '2026-03-20',
  tasks: [{ id: 't1', name: 'Vectors', completed: false, timeSpent: 25, targetRounds: 3 }],
};

test('context carries numbers and task names but nothing sensitive', () => {
  const text = buildAiContext({ projects: [project], sessions: [], today: '2026-03-10' });
  assert.match(text, /```json/);
  assert.match(text, /Algebra \(due 2026-03-20\): 1\/3 rounds done/);
  assert.match(text, /Vectors/);
  assert.doesNotMatch(text, /api[_-]?key|sk-|@|kairo_/i);
  assert.ok(text.length < 6000);
});

test('parseAiPlan accepts a fenced reply with chatter and drops bad deadlines', () => {
  const reply = 'Sure! Here you go:\n```json\n{"projects":[{"name":" Bio ","deadline":"soon","tasks":[{"name":"Cells","rounds":"3","subtasks":["a","b"]},{"name":"  ","rounds":1}]}]}\n```\nGood luck!';
  const { plan, errors } = parseAiPlan(reply);
  assert.deepEqual(errors, []);
  assert.equal(plan!.projects[0]!.name, 'Bio');
  assert.equal(plan!.projects[0]!.deadline, undefined);
  assert.deepEqual(plan!.projects[0]!.tasks.map(t => [t.name, t.rounds]), [['Cells', 3]]);
});

test('parseAiPlan rejects malformed and empty plans with readable errors', () => {
  assert.match(parseAiPlan('I cannot do that').errors[0]!, /No JSON/);
  assert.ok(parseAiPlan('{"projects":[{"name":"X"}]}').errors.length > 0);
  assert.equal(parseAiPlan('{"projects":[]}').plan, null);
  assert.deepEqual(parseAiPlan('[{"name":"Bare array","tasks":[{"name":"T","rounds":2}]}]').errors, []);
});

test('hostile text stays inert data and numbers are clamped', () => {
  const { plan } = parseAiPlan(JSON.stringify({ projects: [{ name: '<img src=x onerror=alert(1)>', tasks: [{ name: '"><script>x</script>', rounds: 9999, subtasks: ['javascript:alert(1)'] }] }] }));
  assert.equal(plan!.projects[0]!.tasks[0]!.rounds, 12);
  assert.equal(plan!.projects[0]!.name, '<img src=x onerror=alert(1)>');
});

test('imports merge into an existing project by name, case-insensitively', () => {
  const { plan } = parseAiPlan('{"projects":[{"name":"algebra","deadline":"2026-04-01","tasks":[{"name":"New","rounds":2,"subtasks":["s"]}]},{"name":"Chem","tasks":[{"name":"C","rounds":1}]}]}');
  const imports = bridgeToImports(plan!, [project]);
  assert.equal(imports[0]!.targetProjectId, 'p1');
  assert.equal(imports[0]!.deadline, '2026-04-01');
  assert.equal(imports[0]!.tasks[0]!.subTasks[0]!.name, 's');
  assert.equal(imports[1]!.targetProjectId, undefined);
});

test('share links round-trip unicode and reject junk and oversize input', () => {
  const { plan } = parseAiPlan('{"projects":[{"name":"भौतिकी — 物理","tasks":[{"name":"Café ☕","rounds":2}]}]}');
  const link = encodePlanLink(plan!)!;
  assert.match(link, /^#import=[A-Za-z0-9_-]+$/);
  assert.deepEqual(decodePlanLink(link).plan, plan);
  assert.ok(decodePlanLink('#import=!!!').errors.length > 0);
  assert.ok(decodePlanLink('#import=' + 'a'.repeat(25_000)).errors.length > 0);
  assert.ok(decodePlanLink('#other=abc').errors.length > 0);
  assert.ok(decodePlanLink('#import=' + btoa('not json').replace(/=+$/, '')).errors.length > 0);
});
