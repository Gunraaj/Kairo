import { DEFAULT_AI_CONFIGS, getAiConfig, type AiConfig } from './geminiAi';

export type JsonSchema = {
  type: 'object' | 'array' | 'string' | 'number' | 'integer' | 'boolean';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  enum?: Array<string | number>;
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
  maxLength?: number;
};

export class StructuredOutputError extends Error {
  constructor(message: string, readonly errors: string[] = []) {
    super(message);
    this.name = 'StructuredOutputError';
  }
}

class HttpError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/**
 * Checks a value against the schema and repairs what is safe to repair:
 * numeric strings become numbers, out-of-range numbers are clamped, over-long
 * strings and arrays are truncated, unknown keys are dropped.
 */
export const conform = (value: unknown, schema: JsonSchema, path = '$'): { value: unknown; errors: string[] } => {
  const errors: string[] = [];
  switch (schema.type) {
    case 'object': {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { value, errors: [`${path}: expected object`] };
      }
      const source = value as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const [key, child] of Object.entries(schema.properties ?? {})) {
        if (source[key] === undefined || source[key] === null) {
          if (schema.required?.includes(key)) errors.push(`${path}.${key}: missing`);
          continue;
        }
        const result = conform(source[key], child, `${path}.${key}`);
        out[key] = result.value;
        errors.push(...result.errors);
      }
      return { value: out, errors };
    }
    case 'array': {
      if (!Array.isArray(value)) return { value, errors: [`${path}: expected array`] };
      const items = schema.maxItems !== undefined ? value.slice(0, schema.maxItems) : value;
      if (schema.minItems !== undefined && items.length < schema.minItems) {
        errors.push(`${path}: needs at least ${schema.minItems} item(s)`);
      }
      const out = items.map((item, index) => {
        if (!schema.items) return item;
        const result = conform(item, schema.items, `${path}[${index}]`);
        errors.push(...result.errors);
        return result.value;
      });
      return { value: out, errors };
    }
    case 'string': {
      if (typeof value !== 'string') return { value, errors: [`${path}: expected string`] };
      const text = schema.maxLength !== undefined ? value.slice(0, schema.maxLength) : value;
      if (schema.enum && !schema.enum.includes(text)) {
        errors.push(`${path}: must be one of ${schema.enum.join(', ')}`);
      }
      return { value: text, errors };
    }
    case 'number':
    case 'integer': {
      const candidate = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
      if (typeof candidate !== 'number' || !Number.isFinite(candidate)) {
        return { value, errors: [`${path}: expected number`] };
      }
      let num: number = candidate;
      if (schema.type === 'integer') num = Math.round(num);
      if (schema.minimum !== undefined) num = Math.max(schema.minimum, num);
      if (schema.maximum !== undefined) num = Math.min(schema.maximum, num);
      return { value: num, errors };
    }
    case 'boolean':
      return typeof value === 'boolean' ? { value, errors } : { value, errors: [`${path}: expected boolean`] };
  }
};

/** Pulls the first JSON object or array out of model text (handles code fences and chatter). */
export const extractJson = (text: string): unknown => {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.search(/[{[]/);
    const end = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
    if (start >= 0 && end > start) return JSON.parse(cleaned.slice(start, end + 1));
    throw new Error('no JSON found');
  }
};

// OpenAI strict mode: every key required, no extra keys, no range keywords.
const toStrictSchema = (schema: JsonSchema): Record<string, unknown> => {
  const out: Record<string, unknown> = { type: schema.type };
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.items) out.items = toStrictSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toStrictSchema(v)]));
    out.required = Object.keys(schema.properties);
    out.additionalProperties = false;
  }
  return out;
};

const toGeminiSchema = (schema: JsonSchema): Record<string, unknown> => {
  const out: Record<string, unknown> = { ...schema, type: schema.type.toUpperCase() };
  if (schema.items) out.items = toGeminiSchema(schema.items);
  if (schema.properties) {
    out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, toGeminiSchema(v)]));
  }
  return out;
};

type CallArgs = {
  config: AiConfig;
  system: string;
  prompt: string;
  schema: JsonSchema;
  schemaName: string;
  maxTokens: number;
  level: number;
  signal: AbortSignal;
  fetchImpl: typeof fetch;
};

// Each provider has a ladder of request shapes, strictest first. Level 0 asks the
// provider to enforce the schema; higher levels are for models/endpoints that reject it.
const LADDER_SIZE: Record<string, number> = { gemini: 2, anthropic: 2 };
const ladderSize = (provider: string) => LADDER_SIZE[provider] ?? 3;
const DEGRADE_STATUSES = new Set([400, 404, 415, 422, 501]);

const readError = async (response: Response, label: string): Promise<never> => {
  const body = await response.json().catch(() => ({})) as { error?: { message?: string }; message?: string };
  throw new HttpError(response.status, `${label}: ${body?.error?.message || body?.message || `HTTP ${response.status}`}`);
};

const callProvider = async (a: CallArgs): Promise<unknown> => {
  const { config, fetchImpl, signal } = a;
  const temperature = config.temperature ?? 0.3;
  const defaults = DEFAULT_AI_CONFIGS[config.provider];
  const baseUrl = (config.baseUrl || defaults.baseUrl).replace(/\/+$/, '');
  const model = config.model.trim() || defaults.model;
  const apiKey = config.apiKey.trim();

  if (config.provider === 'gemini') {
    const generationConfig: Record<string, unknown> = {
      temperature,
      maxOutputTokens: a.maxTokens,
      responseMimeType: 'application/json',
    };
    if (a.level === 0) generationConfig.responseSchema = toGeminiSchema(a.schema);
    const response = await fetchImpl(`${baseUrl}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: a.prompt }] }],
        systemInstruction: { parts: [{ text: a.system }] },
        generationConfig,
      }),
      signal,
    });
    if (!response.ok) await readError(response, 'Gemini');
    const data = await response.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  }

  if (config.provider === 'anthropic') {
    const payload: Record<string, unknown> = {
      model,
      max_tokens: a.maxTokens,
      temperature,
      system: a.system,
      messages: [{ role: 'user', content: a.prompt }],
    };
    if (a.level === 0) {
      payload.tools = [{ name: a.schemaName, description: 'Return the structured result.', input_schema: a.schema }];
      payload.tool_choice = { type: 'tool', name: a.schemaName };
    }
    const response = await fetchImpl(baseUrl.endsWith('/messages') ? baseUrl : `${baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify(payload),
      signal,
    });
    if (!response.ok) await readError(response, 'Anthropic');
    const data = await response.json();
    const blocks: Array<{ type: string; input?: unknown; text?: string }> = data?.content ?? [];
    const tool = blocks.find(block => block.type === 'tool_use');
    return tool ? tool.input : blocks.find(block => block.type === 'text')?.text ?? '';
  }

  // OpenAI-compatible: OpenAI, OpenRouter, Ollama / LM Studio, custom endpoints.
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  headers.Authorization = `Bearer ${apiKey || 'ollama'}`;
  if (config.provider === 'openrouter') {
    headers['HTTP-Referer'] = typeof location !== 'undefined' ? location.origin : 'https://makekairo.netlify.app';
    headers['X-Title'] = 'Kairo Focus Workspace';
  }
  const payload: Record<string, unknown> = {
    model,
    temperature,
    messages: [{ role: 'system', content: a.system }, { role: 'user', content: a.prompt }],
  };
  if (a.level === 0) {
    payload.response_format = {
      type: 'json_schema',
      json_schema: { name: a.schemaName, strict: true, schema: toStrictSchema(a.schema) },
    };
  } else if (a.level === 1) {
    payload.response_format = { type: 'json_object' };
  }
  const response = await fetchImpl(baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    signal,
  });
  if (!response.ok) await readError(response, config.provider);
  const data = await response.json();
  return data?.choices?.[0]?.message?.content ?? '';
};

export type StructuredRequest = {
  schema: JsonSchema;
  /** Letters, digits and underscores only (used as the tool / schema name). */
  schemaName: string;
  system: string;
  prompt: string;
  maxTokens?: number;
  timeoutMs?: number;
};

export type StructuredDeps = { config?: AiConfig; fetchImpl?: typeof fetch };

/**
 * Asks the configured provider for JSON matching `schema`, with provider-side
 * enforcement where available, local validation always, and one repair retry.
 * Throws StructuredOutputError when no valid result is obtained; callers should
 * then fall back to the offline heuristics.
 */
export const generateStructured = async <T>(request: StructuredRequest, deps: StructuredDeps = {}): Promise<T> => {
  const config = deps.config ?? getAiConfig();
  const fetchImpl = deps.fetchImpl ?? fetch;
  if (config.provider === 'offline') throw new StructuredOutputError('AI is in offline mode.');
  if (!config.apiKey.trim() && config.provider !== 'local') {
    throw new StructuredOutputError('No API key configured.');
  }

  const system = `${request.system}\n\nReply with one JSON object only, no prose, matching this JSON Schema:\n${JSON.stringify(request.schema)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? (config.provider === 'local' ? 120_000 : 60_000));

  // Weak models often return a bare array when the schema is an object wrapping one array.
  const keys = Object.keys(request.schema.properties ?? {});
  const wrapKey = request.schema.type === 'object' && keys.length === 1 && request.schema.properties![keys[0]!]!.type === 'array'
    ? keys[0]!
    : null;

  let level = 0;
  let prompt = request.prompt;
  let lastErrors: string[] = [];
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let raw: unknown;
      for (;;) {
        try {
          raw = await callProvider({
            config, system, prompt, schema: request.schema, schemaName: request.schemaName,
            maxTokens: request.maxTokens ?? 2500, level, signal: controller.signal, fetchImpl,
          });
          break;
        } catch (err) {
          const canDegrade = err instanceof HttpError && DEGRADE_STATUSES.has(err.status) && level < ladderSize(config.provider) - 1;
          if (!canDegrade) throw err;
          level += 1;
        }
      }

      let parsed: unknown;
      try {
        parsed = typeof raw === 'string' ? extractJson(raw) : raw;
      } catch {
        lastErrors = ['$: reply was not valid JSON'];
        parsed = undefined;
      }
      if (parsed !== undefined) {
        if (wrapKey && Array.isArray(parsed)) parsed = { [wrapKey]: parsed };
        const result = conform(parsed, request.schema);
        if (result.errors.length === 0) return result.value as T;
        lastErrors = result.errors;
      }

      const previous = (typeof raw === 'string' ? raw : JSON.stringify(raw)).slice(0, 1500);
      prompt = `${request.prompt}\n\nYour previous reply was rejected:\n- ${lastErrors.slice(0, 8).join('\n- ')}\n\nPrevious reply:\n${previous}\n\nReturn the corrected JSON object only.`;
    }
    throw new StructuredOutputError('Model did not return valid structured output.', lastErrors);
  } catch (err) {
    if (err instanceof StructuredOutputError) throw err;
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new StructuredOutputError(aborted ? 'AI request timed out.' : err instanceof Error ? err.message : 'AI request failed.');
  } finally {
    clearTimeout(timer);
  }
};
