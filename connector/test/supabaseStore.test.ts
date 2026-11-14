import assert from 'node:assert/strict';
import test from 'node:test';
import { supabaseStore } from '../src/supabaseStore.ts';

const USER = '123e4567-e89b-42d3-a456-426614174000';
const make = (handler: (url: string, init: RequestInit) => Response) => {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchImpl = (async (url: string, init: RequestInit) => { calls.push({ url, init }); return handler(url, init); }) as unknown as typeof fetch;
  return { store: supabaseStore({ url: 'https://abc.supabase.co/', serviceKey: 'SERVICE', fetchImpl }), calls };
};

test('load scopes the query to the user, sends the service key, and normalizes the rows', async () => {
  const { store, calls } = make(() => new Response(JSON.stringify([{
    projects: [{ id: 'p', name: 'Algebra', deadline: '2026-03-20', tasks: [{ id: 't', name: 'Vectors', targetRounds: 3 }] }, { junk: true }],
    sessions: [{ id: 's', date: '2026-03-09T10:00:00.000Z', duration: 25, completed: true, type: 'focus' }],
  }])));
  const state = await store.load(USER);
  assert.equal(calls[0]!.url, `https://abc.supabase.co/rest/v1/kairo_state?user_id=eq.${USER}&select=projects,sessions`);
  assert.equal((calls[0]!.init.headers as Record<string, string>).apikey, 'SERVICE');
  assert.equal(state.projects[0]!.tasks[0]!.name, 'Vectors');
  assert.equal(state.projects[0]!.deadline, '2026-03-20');
  assert.equal(state.sessions.length, 1);
});

test('a user with no row gets an empty state, and server errors surface', async () => {
  const empty = make(() => new Response('[]'));
  assert.deepEqual(await empty.store.load(USER), { projects: [], sessions: [] });
  const down = make(() => new Response('{}', { status: 500 }));
  await assert.rejects(down.store.load(USER), /HTTP 500/);
  await assert.rejects(down.store.saveProjects(USER, []), /HTTP 500/);
});

test('save upserts only the projects column for that user', async () => {
  const { store, calls } = make(() => new Response(null, { status: 201 }));
  await store.saveProjects(USER, [{ id: 'p', name: 'Algebra', tasks: [], subProjects: [], isExpanded: true }]);
  const call = calls[0]!;
  assert.match(call.url, /on_conflict=user_id$/);
  assert.match((call.init.headers as Record<string, string>).Prefer!, /merge-duplicates/);
  const body = JSON.parse(String(call.init.body));
  assert.equal(body.user_id, USER);
  assert.equal(body.projects[0].name, 'Algebra');
  assert.equal('sessions' in body, false);
});

test('a malformed user id is rejected before any request is made', async () => {
  const { store, calls } = make(() => new Response('[]'));
  for (const bad of ['', 'abc', `${USER}&select=*`, `${USER}' or 1=1`]) {
    await assert.rejects(store.load(bad), /Invalid user id/);
    await assert.rejects(store.saveProjects(bad, []), /Invalid user id/);
  }
  assert.equal(calls.length, 0);
});
