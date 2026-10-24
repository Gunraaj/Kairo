/**
 * geminiAi.ts / aiClient.ts
 * Multi-Provider AI Architecture for Kairo.
 * Supports:
 *   1. Google Gemini Free Tier API (Gemini 2.0 Flash / 1.5 Flash)
 *   2. OpenRouter (Universal gateway for free models & top LLMs: Llama 3.3 70B, DeepSeek R1, Qwen, etc.)
 *   3. Localhost AI / Ollama / LM Studio (100% private, on-device offline models via OpenAI-compatible endpoints)
 *   4. OpenAI & Custom Endpoints (Groq, Together, Mistral, custom base URLs)
 *   5. Chrome Built-in AI (`window.ai` / Gemini Nano)
 *   6. 100% Offline Heuristic Fallback Engine
 */

import { detectPresetCategory } from './slicePresets';

export type AiProviderType =
  | 'gemini'
  | 'openrouter'
  | 'local'
  | 'openai_custom'
  | 'offline';

export interface AiConfig {
  provider: AiProviderType;
  apiKey: string;
  baseUrl: string;
  model: string;
  temperature?: number;
}

export interface AiCapabilityStatus {
  hasOnDeviceAi: boolean;
  hasApiKey: boolean;
  providerName: string;
}

export const AI_CONFIG_KEY = 'kairo_ai_config';
export const GEMINI_KEY_STORAGE = 'kairo_gemini_key';

export const DEFAULT_AI_CONFIGS: Record<
  AiProviderType,
  { baseUrl: string; model: string; placeholderKey: string; label: string }
> = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.0-flash',
    placeholderKey: 'AIzaSy...',
    label: 'Google Gemini',
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'meta-llama/llama-3.3-70b-instruct:free',
    placeholderKey: 'sk-or-v1-...',
    label: 'OpenRouter',
  },
  local: {
    baseUrl: 'http://localhost:11434/v1',
    model: 'llama3.2',
    placeholderKey: 'ollama (optional)',
    label: 'Local AI (Ollama)',
  },
  openai_custom: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    placeholderKey: 'sk-...',
    label: 'Custom OpenAI Endpoint',
  },
  offline: {
    baseUrl: '',
    model: 'offline-heuristics',
    placeholderKey: 'No key needed',
    label: 'Offline Heuristics',
  },
};

export const POPULAR_MODELS: Record<
  AiProviderType,
  Array<{ id: string; label: string; free?: boolean }>
> = {
  gemini: [
    { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash (Recommended, Free Tier)', free: true },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash (Fast, Free Tier)', free: true },
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro (Deep Reasoning, Free Tier)', free: true },
  ],
  openrouter: [
    { id: 'meta-llama/llama-3.3-70b-instruct:free', label: 'Llama 3.3 70B (Free)', free: true },
    { id: 'google/gemini-2.0-flash-exp:free', label: 'Gemini 2.0 Flash (Free)', free: true },
    { id: 'deepseek/deepseek-r1:free', label: 'DeepSeek R1 Reasoning (Free)', free: true },
    { id: 'deepseek/deepseek-chat', label: 'DeepSeek V3 (Ultra-low cost)' },
    { id: 'qwen/qwen-2.5-coder-32b-instruct', label: 'Qwen 2.5 Coder 32B' },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  ],
  local: [
    { id: 'llama3.2', label: 'Llama 3.2 (3B / 1B)', free: true },
    { id: 'qwen2.5', label: 'Qwen 2.5 (3B / 7B / 14B)', free: true },
    { id: 'deepseek-r1:8b', label: 'DeepSeek R1 8B (Local reasoning)', free: true },
    { id: 'mistral', label: 'Mistral 7B', free: true },
    { id: 'phi4', label: 'Phi-4 (14B)', free: true },
  ],
  openai_custom: [
    { id: 'gpt-4o-mini', label: 'OpenAI: GPT-4o Mini' },
    { id: 'gpt-4o', label: 'OpenAI: GPT-4o' },
    { id: 'llama-3.3-70b-versatile', label: 'Groq: Llama 3.3 70B (Ultra-fast)' },
    { id: 'mistral-small-latest', label: 'Mistral: Small 3' },
  ],
  offline: [
    { id: 'offline-heuristics', label: 'Built-in Cognitive Heuristics', free: true },
  ],
};

/**
 * Get current configured AI settings from localStorage
 */
export const getAiConfig = (): AiConfig => {
  if (typeof window === 'undefined') {
    return {
      provider: 'gemini',
      apiKey: '',
      baseUrl: DEFAULT_AI_CONFIGS.gemini.baseUrl,
      model: DEFAULT_AI_CONFIGS.gemini.model,
      temperature: 0.3,
    };
  }

  try {
    const raw = localStorage.getItem(AI_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.provider) {
        const prov = parsed.provider as AiProviderType;
        const defaults = DEFAULT_AI_CONFIGS[prov] || DEFAULT_AI_CONFIGS.gemini;
        return {
          provider: prov,
          apiKey: typeof parsed.apiKey === 'string' ? parsed.apiKey : '',
          baseUrl: typeof parsed.baseUrl === 'string' && parsed.baseUrl.trim() ? parsed.baseUrl : defaults.baseUrl,
          model: typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model : defaults.model,
          temperature: typeof parsed.temperature === 'number' ? parsed.temperature : 0.3,
        };
      }
    }
  } catch {
    // Ignore corrupted json
  }

  // Fallback migration from legacy kairo_gemini_key
  const legacyGeminiKey = localStorage.getItem(GEMINI_KEY_STORAGE) || '';
  if (legacyGeminiKey) {
    return {
      provider: 'gemini',
      apiKey: legacyGeminiKey,
      baseUrl: DEFAULT_AI_CONFIGS.gemini.baseUrl,
      model: DEFAULT_AI_CONFIGS.gemini.model,
      temperature: 0.3,
    };
  }

  return {
    provider: 'gemini',
    apiKey: '',
    baseUrl: DEFAULT_AI_CONFIGS.gemini.baseUrl,
    model: DEFAULT_AI_CONFIGS.gemini.model,
    temperature: 0.3,
  };
};

/**
 * Save updated AI configuration to localStorage
 */
export const saveAiConfig = (partial: Partial<AiConfig>): void => {
  if (typeof window === 'undefined') return;
  const current = getAiConfig();
  const providerChanged = partial.provider && partial.provider !== current.provider;
  const defaults = partial.provider ? DEFAULT_AI_CONFIGS[partial.provider] : DEFAULT_AI_CONFIGS[current.provider];

  const next: AiConfig = {
    ...current,
    ...(providerChanged
      ? {
          baseUrl: defaults.baseUrl,
          model: defaults.model,
        }
      : {}),
    ...partial,
  };

  try {
    localStorage.setItem(AI_CONFIG_KEY, JSON.stringify(next));
  } catch {
    // Storage quota or privacy restriction
  }

  // Symmetrically sync legacy gemini key
  if (next.provider === 'gemini') {
    setGeminiApiKey(next.apiKey);
  }
};

/**
 * Legacy Gemini Key Getter (preserves backward compatibility with existing tests/callers)
 */
export const getGeminiApiKey = (): string => {
  if (typeof window === 'undefined') return '';
  const config = getAiConfig();
  if (config.provider === 'gemini') return config.apiKey;
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
};

/**
 * Legacy Gemini Key Setter (preserves backward compatibility with existing tests/callers)
 */
export const setGeminiApiKey = (key: string): void => {
  if (typeof window === 'undefined') return;
  const trimmed = key.trim();
  if (trimmed) {
    localStorage.setItem(GEMINI_KEY_STORAGE, trimmed);
  } else {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  }
  const config = getAiConfig();
  if (config.provider === 'gemini' && config.apiKey !== trimmed) {
    saveAiConfig({ apiKey: trimmed });
  }
};

/**
 * Detect capabilities of active AI engine
 */
export const checkAiCapability = async (): Promise<AiCapabilityStatus> => {
  const config = getAiConfig();
  const hasApiKey = Boolean(config.apiKey) || config.provider === 'local';
  let hasOnDeviceAi = false;

  if (typeof window !== 'undefined' && 'ai' in window && 'languageModel' in (window as any).ai) {
    try {
      const capabilities = await (window as any).ai.languageModel.capabilities();
      hasOnDeviceAi = capabilities.available === 'readily' || capabilities.available === 'after-download';
    } catch {
      hasOnDeviceAi = false;
    }
  }

  let providerName = 'Offline Heuristics';
  if (config.provider === 'gemini') {
    providerName = config.apiKey ? `Gemini (${config.model || '2.0 Flash'})` : 'Gemini (Key needed)';
  } else if (config.provider === 'openrouter') {
    providerName = config.apiKey ? `OpenRouter (${config.model})` : 'OpenRouter (Key needed)';
  } else if (config.provider === 'local') {
    providerName = `Local (${config.model || 'Ollama'})`;
  } else if (config.provider === 'openai_custom') {
    providerName = config.apiKey ? `Custom (${config.model})` : 'Custom AI (Key needed)';
  }

  if (hasOnDeviceAi && !config.apiKey && config.provider === 'gemini') {
    providerName = 'Chrome On-Device (Gemini Nano)';
  }

  return { hasOnDeviceAi, hasApiKey, providerName };
};

/**
 * Universal Query Engine supporting:
 * - Google Gemini (Native API)
 * - OpenRouter (OpenAI-compatible)
 * - Localhost / Ollama / LM Studio (OpenAI-compatible)
 * - OpenAI & Custom Endpoints (OpenAI-compatible)
 * - Chrome On-Device Gemini Nano
 */
export const queryAi = async (prompt: string, systemInstruction?: string): Promise<string> => {
  const config = getAiConfig();

  // 1. Offline Mode: Immediately throw so caller uses smart heuristic presets
  if (config.provider === 'offline') {
    throw new Error('AI is in Offline mode. Using built-in heuristics.');
  }

  // 2. Chrome Built-in Gemini Nano (if available and provider is set to local or gemini without key)
  if (
    typeof window !== 'undefined' &&
    'ai' in window &&
    'languageModel' in (window as any).ai &&
    (config.provider === 'local' && config.model === 'chrome-nano' || (!config.apiKey && config.provider === 'gemini'))
  ) {
    try {
      const session = await (window as any).ai.languageModel.create({
        systemPrompt: systemInstruction,
      });
      const response = await session.prompt(prompt);
      return response.trim();
    } catch {
      // Fall through to network provider
    }
  }

  // 3. Google Gemini Native API
  if (config.provider === 'gemini') {
    const apiKey = config.apiKey.trim();
    if (!apiKey) {
      throw new Error('Google Gemini API key is missing. Add your free key in Settings.');
    }
    const model = config.model.trim() || 'gemini-2.0-flash';
    const baseUrl = (config.baseUrl || DEFAULT_AI_CONFIGS.gemini.baseUrl).replace(/\/+$/, '');
    const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: config.temperature ?? 0.3,
        maxOutputTokens: 2500,
      },
    };
    if (systemInstruction) {
      body.systemInstruction = {
        parts: [{ text: systemInstruction }],
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = (errData as any)?.error?.message || `HTTP ${response.status}`;
      throw new Error(`Gemini API: ${message}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    return text.trim();
  }

  // 4. OpenAI-Compatible Providers (OpenRouter, Localhost / Ollama, Custom OpenAI endpoint)
  if (config.provider === 'openrouter' || config.provider === 'local' || config.provider === 'openai_custom') {
    const baseUrl = (config.baseUrl || DEFAULT_AI_CONFIGS[config.provider].baseUrl).replace(/\/+$/, '');
    const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
    const model = config.model.trim() || DEFAULT_AI_CONFIGS[config.provider].model;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey && config.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    } else if (config.provider === 'local') {
      headers['Authorization'] = 'Bearer ollama';
    } else {
      throw new Error(`${config.provider === 'openrouter' ? 'OpenRouter' : 'API'} key is required. Add your key in Settings.`);
    }

    if (config.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://makekairo.netlify.app';
      headers['X-Title'] = 'Kairo Focus Workspace';
    }

    const messages = [];
    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }
    messages.push({ role: 'user', content: prompt });

    const payload = {
      model,
      messages,
      temperature: config.temperature ?? 0.3,
      max_tokens: 2500,
    };

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
    } catch (fetchErr: any) {
      if (config.provider === 'local') {
        throw new Error(
          `Unable to reach local server at ${baseUrl}. Ensure Ollama or LM Studio is running. If using Ollama, ensure CORS is enabled: OLLAMA_ORIGINS="*" ollama serve`
        );
      }
      throw new Error(`Network error connecting to ${baseUrl}: ${fetchErr?.message || 'Check your connection'}`);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const message = (errData as any)?.error?.message || (errData as any)?.message || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(`${config.provider.toUpperCase()} error: ${message}`);
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') {
      throw new Error(`Invalid response format from ${config.provider} model ${model}`);
    }
    return content.trim();
  }

  throw new Error(`Unsupported AI provider: ${config.provider}`);
};

/**
 * Test connectivity, authentication, and latency to the configured AI engine.
 */
export const testAiConnection = async (
  override?: Partial<AiConfig>,
): Promise<{ success: boolean; message: string; latencyMs?: number; model?: string }> => {
  const current = getAiConfig();
  const config: AiConfig = { ...current, ...(override || {}) };

  if (config.provider === 'offline') {
    return {
      success: true,
      message: 'Offline Heuristics active (100% private, zero API keys required).',
      latencyMs: 0,
      model: 'offline-heuristics',
    };
  }

  const start = performance.now();
  try {
    // 1. If Gemini
    if (config.provider === 'gemini') {
      if (!config.apiKey.trim()) {
        return { success: false, message: 'Gemini API key is required. Get one free from Google AI Studio.' };
      }
      const model = config.model.trim() || 'gemini-2.0-flash';
      const baseUrl = (config.baseUrl || DEFAULT_AI_CONFIGS.gemini.baseUrl).replace(/\/+$/, '');
      const url = `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.apiKey.trim())}`;

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with the single word 'ready'." }] }],
          generationConfig: { maxOutputTokens: 10, temperature: 0 },
        }),
      });

      const elapsed = Math.round(performance.now() - start);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return {
          success: false,
          message: (err as any)?.error?.message || `HTTP ${res.status}: Failed to connect`,
          latencyMs: elapsed,
        };
      }
      return {
        success: true,
        message: `Connected to Gemini (${model}) in ${elapsed}ms!`,
        latencyMs: elapsed,
        model,
      };
    }

    // 2. If OpenRouter / Localhost / OpenAI
    const baseUrl = (config.baseUrl || DEFAULT_AI_CONFIGS[config.provider].baseUrl).replace(/\/+$/, '');
    const endpoint = baseUrl.endsWith('/chat/completions') ? baseUrl : `${baseUrl}/chat/completions`;
    const model = config.model.trim() || DEFAULT_AI_CONFIGS[config.provider].model;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (config.apiKey && config.apiKey.trim()) {
      headers['Authorization'] = `Bearer ${config.apiKey.trim()}`;
    } else if (config.provider === 'local') {
      headers['Authorization'] = 'Bearer ollama';
    } else {
      return { success: false, message: `${config.provider === 'openrouter' ? 'OpenRouter' : 'API'} key is required.` };
    }

    if (config.provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://makekairo.netlify.app';
      headers['X-Title'] = 'Kairo Focus Workspace';
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: "Reply with the single word 'ready'." }],
        max_tokens: 10,
        temperature: 0,
      }),
    });

    const elapsed = Math.round(performance.now() - start);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const msg = (err as any)?.error?.message || (err as any)?.message || `HTTP ${res.status}`;
      return {
        success: false,
        message: `${config.provider.toUpperCase()}: ${msg}`,
        latencyMs: elapsed,
      };
    }

    return {
      success: true,
      message: `Connected to ${model} in ${elapsed}ms!`,
      latencyMs: elapsed,
      model,
    };
  } catch (err: any) {
    const elapsed = Math.round(performance.now() - start);
    if (config.provider === 'local') {
      return {
        success: false,
        message: `Cannot reach ${config.baseUrl}. Make sure Ollama or LM Studio is running. If running Ollama, enable CORS via: OLLAMA_ORIGINS="*" ollama serve`,
        latencyMs: elapsed,
      };
    }
    return {
      success: false,
      message: err?.message || 'Connection failed. Check network or CORS settings.',
      latencyMs: elapsed,
    };
  }
};

/**
 * Sharpen a vague session intention into an actionable single-session implementation intention.
 */
export const sharpenIntention = async (vagueIntention: string): Promise<string> => {
  const trimmed = vagueIntention.trim();
  if (!trimmed) return '';

  const systemPrompt = `You are a concise, stoic productivity assistant. Transform the user's focus intention into a single, concrete, highly actionable 25-minute Pomodoro goal. Rules:
- Keep it under 14 words.
- Start with an action verb (Draft, Refactor, Audit, Write, Outline, Fix, Review).
- Be specific about what "done" looks like for this single 25-minute block.
- Output ONLY the sharpened intention string, with no quotes, no commentary, and no markdown.`;

  try {
    return await queryAi(`Vague intention: "${trimmed}"`, systemPrompt);
  } catch {
    // Smart heuristic fallback if no AI is configured or network fails
    return fallbackSharpen(trimmed);
  }
};

/**
 * Slice a large project into 3-4 concrete 25-minute Pomodoro tasks.
 */
export const breakdownProjectTasks = async (
  projectName: string,
): Promise<Array<{ name: string; targetRounds: number }>> => {
  const systemPrompt = `You are an expert agile engineer. Break the project into 3 to 4 sequential, discrete 25-minute Pomodoro tasks.
Return ONLY valid JSON matching this schema:
[
  { "name": "Task name (short, actionable)", "targetRounds": 1 or 2 }
]
Do not wrap in backticks or code blocks. Output raw JSON only.`;

  try {
    const raw = await queryAi(`Project: "${projectName}"`, systemPrompt);
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 5).map(item => ({
        name: String(item.name || 'Next task').slice(0, 100),
        targetRounds: Math.min(6, Math.max(1, Number(item.targetRounds) || 2)),
      }));
    }
  } catch {
    // Smart heuristic preset fallback if AI is unavailable or unconfigured
  }

  const preset = detectPresetCategory(projectName);
  return preset.projectTasks.map(t => ({
    name: t.name,
    targetRounds: t.targetRounds,
  }));
};

/**
 * Break a single task into 2 to 4 micro subtasks.
 */
export const breakdownSubtasks = async (
  taskName: string,
): Promise<string[]> => {
  const systemPrompt = `You are a productivity expert. Break the task into 2 to 4 micro subtasks (sub-steps).
Return ONLY valid JSON array of strings:
[
  "Subtask 1",
  "Subtask 2"
]
Keep each subtask under 10 words. Output raw JSON only with no quotes outside the array.`;

  try {
    const raw = await queryAi(`Task: "${taskName}"`, systemPrompt);
    const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, 5).map(item => String(item).slice(0, 100));
    }
  } catch {
    // Smart heuristic preset fallback
  }

  const preset = detectPresetCategory(taskName);
  return [...preset.subtaskSteps];
};

/**
 * Rule-based heuristic fallback when no AI is configured
 */
const fallbackSharpen = (input: string): string => {
  const lower = input.toLowerCase();
  if (lower.startsWith('i will ')) return input;
  if (/^(read|write|code|fix|test|study|review|draft|clean)/i.test(input)) {
    return `${input.charAt(0).toUpperCase() + input.slice(1)} (first pass)`;
  }
  return `Focus on: ${input}`;
};
