import assert from 'node:assert/strict';
import test from 'node:test';
import { conform, extractJson, generateStructured, StructuredOutputError, type JsonSchema } from '../utils/structuredAi.ts';

const schema: JsonSchema = {
  type: 'object',
  properties: {
    tasks: {
      type: 'array',
      minItems: 1,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', maxLength: 10 },
          rounds: { type: 'integer', minimum: 1, maximum: 6 },
        },
        required: ['name', 'rounds'],
      },
    },
  },
  required: ['tasks'],
};

const local = { provider: 'local' as const, apiKey: '', baseUrl: 'http://localhost:11434/v1', model: 'm', temperature: 0 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const chat = (content: string) => json({ choices: [{ message: { content } }] });

test('conform repairs safe problems and reports real ones', () => {
  const ok = conform({ tasks: [{ name: 'abcdefghijklmnop', rounds: '9', junk: 1 }, { name: 'b', rounds: 2 }, { name: 'c', rounds: 0 }, { name: 'd', rounds: 1 }] }, schema);
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.value, { tasks: [{ name: 'abcdefghij', rounds: 6 }, { name: 'b', rounds: 2 }, { name: 'c', rounds: 1 }] });

  const bad = conform({ tasks: [{ name: 5 }] }, schema);
  assert.equal(bad.errors.length, 2);
  assert.equal(conform({ tasks: [] }, schema).errors.length, 1);
  assert.equal(conform([], schema).errors.length, 1);
});

test('extractJson handles fences and surrounding prose', () => {
  assert.deepEqual(extractJson('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(extractJson('Sure! Here it is: {"a":[1,2]} Hope that helps.'), { a: [1, 2] });
  assert.throws(() => extractJson('no json here'));
});

test('generateStructured returns validated output and wraps bare arrays', async () => {
  const bodies: Array<Record<string, any>> = [];
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    return chat('[{"name":"Read","rounds":2}]');
  }) as typeof fetch;
  const out = await generateStructured<{ tasks: unknown[] }>({ schema, schemaName: 'plan', system: 's', prompt: 'p' }, { config: local, fetchImpl });
  assert.deepEqual(out, { tasks: [{ name: 'Read', rounds: 2 }] });
  assert.equal(bodies[0]!.response_format.type, 'json_schema');
  assert.equal(bodies[0]!.response_format.json_schema.schema.additionalProperties, false);
});

test('generateStructured degrades request shape when the endpoint rejects schemas', async () => {
  const formats: unknown[] = [];
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    formats.push(body.response_format?.type ?? 'none');
    if (body.response_format) return json({ error: { message: 'unsupported' } }, 400);
    return chat('Here you go: {"tasks":[{"name":"A","rounds":1}]}');
  }) as typeof fetch;
  const out = await generateStructured<{ tasks: unknown[] }>({ schema, schemaName: 'plan', system: 's', prompt: 'p' }, { config: local, fetchImpl });
  assert.deepEqual(formats, ['json_schema', 'json_object', 'none']);
  assert.equal(out.tasks.length, 1);
});

test('generateStructured retries once with the validation errors, then gives up', async () => {
  const prompts: string[] = [];
  let reply = '{"tasks":[{"name":"A"}]}';
  const fetchImpl = (async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body));
    prompts.push(body.messages[1].content);
    const current = reply;
    reply = '{"tasks":[{"name":"A","rounds":3}]}';
    return chat(current);
  }) as typeof fetch;
  const out = await generateStructured<{ tasks: Array<{ rounds: number }> }>({ schema, schemaName: 'plan', system: 's', prompt: 'p' }, { config: local, fetchImpl });
  assert.equal(out.tasks[0]!.rounds, 3);
  assert.equal(prompts.length, 2);
  assert.match(prompts[1]!, /rounds: missing/);

  const always = (async () => chat('not json')) as typeof fetch;
  await assert.rejects(
    generateStructured({ schema, schemaName: 'plan', system: 's', prompt: 'p' }, { config: local, fetchImpl: always }),
    StructuredOutputError,
  );
});

test('generateStructured uses native schema features for Gemini and Anthropic', async () => {
  let geminiBody: Record<string, any> = {};
  const gemini = (async (_url: unknown, init?: RequestInit) => {
    geminiBody = JSON.parse(String(init?.body));
    return json({ candidates: [{ content: { parts: [{ text: '{"tasks":[{"name":"G","rounds":1}]}' }] } }] });
  }) as typeof fetch;
  await generateStructured({ schema, schemaName: 'plan', system: 's', prompt: 'p' }, {
    config: { provider: 'gemini', apiKey: 'k', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', model: 'g', temperature: 0 },
    fetchImpl: gemini,
  });
  assert.equal(geminiBody.generationConfig.responseSchema.type, 'OBJECT');

  let claudeBody: Record<string, any> = {};
  const claude = (async (_url: unknown, init?: RequestInit) => {
    claudeBody = JSON.parse(String(init?.body));
    return json({ content: [{ type: 'tool_use', input: { tasks: [{ name: 'C', rounds: 2 }] } }] });
  }) as typeof fetch;
  const out = await generateStructured<{ tasks: unknown[] }>({ schema, schemaName: 'plan', system: 's', prompt: 'p' }, {
    config: { provider: 'anthropic', apiKey: 'k', baseUrl: 'https://api.anthropic.com/v1', model: 'c', temperature: 0 },
    fetchImpl: claude,
  });
  assert.equal(claudeBody.tool_choice.name, 'plan');
  assert.deepEqual(out.tasks, [{ name: 'C', rounds: 2 }]);
});

test('generateStructured refuses offline mode and missing keys without calling the network', async () => {
  const never = (async () => { throw new Error('should not be called'); }) as typeof fetch;
  await assert.rejects(generateStructured({ schema, schemaName: 'p', system: 's', prompt: 'p' }, { config: { ...local, provider: 'offline' }, fetchImpl: never }), /offline/);
  await assert.rejects(generateStructured({ schema, schemaName: 'p', system: 's', prompt: 'p' }, { config: { ...local, provider: 'openai' }, fetchImpl: never }), /API key/);
});

test('generateStructured uses Chrome built-in AI when no key is set and the model is ready', async () => {
  const calls: Array<{ prompt: string; constraint: unknown }> = [];
  (globalThis as any).LanguageModel = {
    availability: async () => 'available',
    create: async () => ({
      prompt: async (text: string, options: { responseConstraint: unknown }) => {
        calls.push({ prompt: text, constraint: options.responseConstraint });
        return '{"tasks":[{"name":"On device","rounds":2}]}';
      },
      destroy() {},
    }),
  };
  try {
    const never = (async () => { throw new Error('network must not be used'); }) as typeof fetch;
    const out = await generateStructured<{ tasks: Array<{ name: string }> }>(
      { schema, schemaName: 'plan', system: 's', prompt: 'p' },
      { config: { provider: 'gemini', apiKey: '', baseUrl: '', model: 'g', temperature: 0 }, fetchImpl: never },
    );
    assert.equal(out.tasks[0]!.name, 'On device');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0]!.constraint, schema);
  } finally {
    delete (globalThis as any).LanguageModel;
  }
});
