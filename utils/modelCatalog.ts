import { DEFAULT_AI_CONFIGS, POPULAR_MODELS, type AiConfig } from './geminiAi';

export type ModelOption = { id: string; label: string; free?: boolean };

const CACHE_KEY = 'kairo_model_cache';
const TTL_MS = 24 * 60 * 60 * 1000;
const NON_CHAT = /(embed|tts|whisper|dall-e|image|audio|realtime|moderation|transcribe|search-preview|davinci|babbage)/i;

type CacheEntry = { at: number; models: ModelOption[] };
type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

type Deps = { fetchImpl?: typeof fetch; storage?: StorageLike | null; now?: number; force?: boolean; signal?: AbortSignal };

const defaultStorage = (): StorageLike | null => {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
};

const readCache = (storage: StorageLike | null): Record<string, CacheEntry> => {
  try {
    const parsed = JSON.parse(storage?.getItem(CACHE_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
};

const cacheKeyFor = (config: AiConfig) => `${config.provider}|${config.baseUrl}`;

/** Models offered when nothing live is available (offline, no key, request failed). */
export const fallbackModels = (provider: AiConfig['provider']): ModelOption[] => POPULAR_MODELS[provider] ?? [];

const byLabel = (a: ModelOption, b: ModelOption) => a.label.localeCompare(b.label);

const fetchJson = async (url: string, headers: Record<string, string>, fetchImpl: typeof fetch, signal?: AbortSignal) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  signal?.addEventListener('abort', () => controller.abort());
  try {
    const response = await fetchImpl(url, { headers, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    clearTimeout(timer);
  }
};

const fetchLive = async (config: AiConfig, fetchImpl: typeof fetch, signal?: AbortSignal): Promise<ModelOption[]> => {
  const base = (config.baseUrl || DEFAULT_AI_CONFIGS[config.provider].baseUrl).replace(/\/+$/, '');
  const key = config.apiKey.trim();

  if (config.provider === 'gemini') {
    const data = await fetchJson(`${base}/models?pageSize=200`, { 'x-goog-api-key': key }, fetchImpl, signal);
    return (data?.models ?? [])
      .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent') && /gemini/i.test(m.name))
      .map((m: any) => ({ id: String(m.name).replace(/^models\//, ''), label: String(m.displayName || m.name) }))
      .sort(byLabel);
  }

  if (config.provider === 'anthropic') {
    const data = await fetchJson(`${base}/models?limit=100`, {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    }, fetchImpl, signal);
    return (data?.data ?? []).map((m: any) => ({ id: String(m.id), label: String(m.display_name || m.id) }));
  }

  const headers: Record<string, string> = { Authorization: `Bearer ${key || 'ollama'}` };
  const data = await fetchJson(`${base}/models`, headers, fetchImpl, signal);
  let models: ModelOption[] = (data?.data ?? []).map((m: any) => {
    const id = String(m.id);
    const free = id.endsWith(':free') || (m.pricing && Number(m.pricing.prompt) === 0 && Number(m.pricing.completion) === 0);
    return { id, label: String(m.name || id), free: config.provider === 'local' ? true : Boolean(free) };
  });
  if (config.provider === 'openai') models = models.filter(m => /^(gpt|o\d|chatgpt)/i.test(m.id) && !NON_CHAT.test(m.id));
  return models.sort(byLabel);
};

/**
 * Live model list for the configured provider, cached for 24h. Never throws:
 * on any problem it returns the cached list or the built-in fallback list.
 */
export const listModels = async (config: AiConfig, deps: Deps = {}): Promise<ModelOption[]> => {
  const fallback = fallbackModels(config.provider);
  if (config.provider === 'offline') return fallback;
  if (config.provider !== 'local' && !config.apiKey.trim()) return fallback;

  const storage = deps.storage === undefined ? defaultStorage() : deps.storage;
  const now = deps.now ?? Date.now();
  const cache = readCache(storage);
  const entry = cache[cacheKeyFor(config)];
  if (entry && !deps.force && now - entry.at < TTL_MS && entry.models.length) return entry.models;

  try {
    const models = await fetchLive(config, deps.fetchImpl ?? fetch, deps.signal);
    if (models.length === 0) return entry?.models?.length ? entry.models : fallback;
    cache[cacheKeyFor(config)] = { at: now, models };
    try { storage?.setItem(CACHE_KEY, JSON.stringify(cache)); } catch { /* quota */ }
    return models;
  } catch {
    return entry?.models?.length ? entry.models : fallback;
  }
};
