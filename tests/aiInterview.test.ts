import assert from 'node:assert/strict';
import test from 'node:test';
import { aiBuildPlan, aiFollowUp, fitPlan, parseHours, parseWhen, planFromAnswers, roundsAvailable, scriptedNext, splitTopics } from '../utils/aiInterview.ts';

const TODAY = '2026-03-10';
const local = { provider: 'local' as const, apiKey: '', baseUrl: 'http://x/v1', model: 'm', temperature: 0 };
const reply = (obj: unknown) => (async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] }))) as unknown as typeof fetch;

test('parsing dates, hours and topics the way students type them', () => {
  assert.equal(parseWhen('2026-04-01', TODAY), '2026-04-01');
  assert.equal(parseWhen('Tomorrow', TODAY), '2026-03-11');
  assert.equal(parseWhen('In 3 days', TODAY), '2026-03-13');
  assert.equal(parseWhen('in 2 weeks', TODAY), '2026-03-24');
  assert.equal(parseWhen('about a month', TODAY), '2026-04-09');
  assert.equal(parseWhen('soon-ish', TODAY), undefined);
  assert.deepEqual(['3', '2-3 hours', '90 min', '1.5h', 'none'].map(parseHours), [3, 2, 1.5, 1.5, undefined]);
  assert.deepEqual(splitTopics('## Unit 1\n- Thermodynamics\n- Optics, Waves; 3. Modern physics\nUnit 2:'), ['Thermodynamics', 'Optics', 'Waves', 'Modern physics']);
});

test('fixed questions run in order and the weak-topic question offers their own topics', () => {
  assert.equal(scriptedNext({})!.id, 'subject');
  assert.equal(scriptedNext({ subject: 'Physics' })!.question.input, 'date');
  const weak = scriptedNext({ subject: 'P', date: 'In 1 week', topics: 'Optics, Waves' })!;
  assert.equal(weak.id, 'weak');
  assert.deepEqual(weak.question.options, ['Optics', 'Waves', 'None really']);
  assert.equal(scriptedNext({ subject: 'P', date: 'x', topics: '', weak: undefined })!.id, 'hours');
  assert.equal(scriptedNext({ subject: 'P', date: 'x', topics: 'a, b', weak: 'a', hours: '2', papers: 'No' }), null);
});

test('plan without AI: weak topics first with more rounds, past papers, final revision, deadline', () => {
  const r = planFromAnswers({ subject: 'Physics ESE', date: 'In 1 week', topics: 'Thermodynamics, Optics, Electrostatics', weak: 'Optics', hours: '3', papers: 'Yes' }, TODAY);
  const p = r.plan.projects[0]!;
  assert.equal(p.name, 'Physics ESE');
  assert.equal(p.deadline, '2026-03-17');
  assert.deepEqual(p.tasks.map(t => [t.name, t.rounds]), [
    ['Optics', 3], ['Thermodynamics', 2], ['Electrostatics', 2],
    ['Timed past paper', 3], ['Review past paper mistakes', 2], ['Final revision: mistake list and key formulas', 2],
  ]);
  assert.equal(p.tasks[0]!.subtasks![0], 'Recall: write what you know, notes closed');
  assert.equal(r.overflow, 0);
});

test('plans are cut down to the time actually available', () => {
  assert.equal(roundsAvailable({ hoursPerDay: 2, today: TODAY, deadline: '2026-03-13' }), 10);
  const r = planFromAnswers({ subject: 'X', date: 'Tomorrow', topics: Array.from({ length: 12 }, (_, i) => `Topic ${i}`).join(', '), hours: '1', papers: 'No' }, TODAY);
  assert.equal(r.available, 1);
  assert.ok(r.plan.projects[0]!.tasks.every(t => t.rounds >= 1));
  assert.ok(r.overflow > 0, 'reports that it still does not fit');
  const fit = fitPlan({ projects: [{ name: 'P', tasks: [{ name: 'a', rounds: 8 }, { name: 'b', rounds: 4 }] }] }, 6);
  assert.equal(fit.total, 6);
  assert.equal(fit.scaledFrom, 12);
});

test('AI follow-up: one adaptive question, or none, and never a repeat of the basics', async () => {
  const answers = { subject: 'Physics', date: 'In 1 week', topics: 'Optics, Waves', weak: 'Optics', hours: '3', papers: 'Yes' };
  let prompt = '';
  const capture = (obj: unknown) => (async (_u: unknown, init?: RequestInit) => { prompt = JSON.parse(String(init?.body)).messages[1].content; return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(obj) } }] })); }) as unknown as typeof fetch;
  const q = await aiFollowUp({ answers, profile: 'p', today: TODAY }, { config: local, fetchImpl: capture({ ask: true, message: 'Is the exam mostly numericals or theory?', input: 'choice', options: ['Numericals', 'Theory', 'Both'] }) });
  assert.deepEqual([q?.message, q?.options.length], ['Is the exam mostly numericals or theory?', 3]);
  assert.match(prompt, /Exam date: 2026-03-17 \(7 days from today\)/);
  assert.match(prompt, /Weak topics: Optics/);
  assert.equal(await aiFollowUp({ answers, profile: 'p', today: TODAY }, { config: local, fetchImpl: reply({ ask: false, message: '', input: 'text', options: [] }) }), null);
  assert.equal(await aiFollowUp({ answers, profile: 'p', today: TODAY }, { config: local, fetchImpl: reply({ ask: true, message: 'How many hours per day can you study?', input: 'text', options: [] }) }), null);
});

test('AI plan: Kairo keeps the facts (date, budget, weak topics first) whatever the model does', async () => {
  const answers = { subject: 'Chem', date: 'In 3 days', topics: 'Bonding, SN1/SN2', weak: 'SN1/SN2', hours: '2', papers: 'No' };
  const r = await aiBuildPlan({ answers, profile: 'p', today: TODAY }, {
    config: local,
    fetchImpl: reply({ name: 'Chemistry', tasks: [{ name: 'Bonding', rounds: 10, subtasks: ['Recall'] }, { name: ' ', rounds: 2, subtasks: [] }, { name: 'SN1/SN2 mechanisms', rounds: 10, subtasks: [] }] }),
  });
  const p = r.plan.projects[0]!;
  assert.equal(p.deadline, '2026-03-13');
  assert.deepEqual(p.tasks.map(t => t.name), ['SN1/SN2 mechanisms', 'Bonding']);
  assert.equal(r.available, 10);
  assert.equal(r.scaledFrom, 20);
  assert.equal(p.tasks.reduce((s, t) => s + t.rounds, 0), 10);
});
