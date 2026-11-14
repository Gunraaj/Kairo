import assert from 'node:assert/strict';
import test from 'node:test';
import { listModels } from '../utils/modelCatalog.ts';

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });
const cfg = (provider: any, extra: any = {}) => ({ provider, apiKey: 'k', baseUrl: 'https://api.example.com/v1', model: 'm', temperature: 0, ...extra });

test('openai list drops non-chat models; local marks everything free', async () => {
  const fetchImpl = (async () => json({ data: [{ id: 'gpt-5-mini' }, { id: 'text-embedding-3-large' }, { id: 'whisper-1' }, { id: 'o4-mini' }] })) as typeof fetch;
  const openai = await listModels(cfg('openai'), { fetchImpl, storage: mem() });
  assert.deepEqual(openai.map(m => m.id), ['gpt-5-mini', 'o4-mini']);
  const local = await listModels(cfg('local', { apiKey: '' }), { fetchImpl: (async () => json({ data: [{ id: 'llama3.2:3b' }] })) as typeof fetch, storage: mem() });
  assert.deepEqual(local, [{ id: 'llama3.2:3b', label: 'llama3.2:3b', free: true }]);
});

test('gemini list keeps generateContent models and strips the models/ prefix', async () => {
  const fetchImpl = (async () => json({ models: [
    { name: 'models/gemini-x', displayName: 'Gemini X', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/embedding-001', displayName: 'Embed', supportedGenerationMethods: ['embedContent'] },
  ] })) as typeof fetch;
  assert.deepEqual(await listModels(cfg('gemini'), { fetchImpl, storage: mem() }), [{ id: 'gemini-x', label: 'Gemini X' }]);
});

test('anthropic and openrouter parse their shapes', async () => {
  const claude = await listModels(cfg('anthropic'), { fetchImpl: (async () => json({ data: [{ id: 'claude-sonnet-5-5', display_name: 'Claude Sonnet 5.5' }] })) as typeof fetch, storage: mem() });
  assert.deepEqual(claude, [{ id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5' }]);
  const router = await listModels(cfg('openrouter'), { fetchImpl: (async () => json({ data: [{ id: 'a/b:free', name: 'B' }, { id: 'c/d', name: 'D', pricing: { prompt: '0.1', completion: '0.2' } }] })) as typeof fetch, storage: mem() });
  assert.deepEqual(router.map(m => [m.id, m.free]), [['a/b:free', true], ['c/d', false]]);
});

test('cache is used for 24h, forced refresh bypasses it, failures fall back', async () => {
  const storage = mem();
  let calls = 0;
  const fetchImpl = (async () => { calls += 1; return json({ data: [{ id: 'gpt-5-mini' }] }); }) as typeof fetch;
  await listModels(cfg('openai'), { fetchImpl, storage, now: 1000 });
  await listModels(cfg('openai'), { fetchImpl, storage, now: 2000 });
  assert.equal(calls, 1);
  await listModels(cfg('openai'), { fetchImpl, storage, now: 2000, force: true });
  assert.equal(calls, 2);
  await listModels(cfg('openai'), { fetchImpl, storage, now: 1000 + 25 * 3600_000 });
  assert.equal(calls, 3);

  const failing = (async () => json({}, 500)) as typeof fetch;
  const stale = await listModels(cfg('openai'), { fetchImpl: failing, storage, now: 1000 + 60 * 3600_000 });
  assert.equal(stale[0]!.id, 'gpt-5-mini');
  const none = await listModels(cfg('anthropic'), { fetchImpl: failing, storage: mem() });
  assert.ok(none.length > 0);
  const noKey = await listModels(cfg('openai', { apiKey: '' }), { fetchImpl: (async () => { throw new Error('no network'); }) as typeof fetch, storage: mem() });
  assert.ok(noKey.length > 0);
});
