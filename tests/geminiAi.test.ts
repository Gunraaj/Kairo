import assert from 'node:assert/strict';
import test from 'node:test';
import {
  checkAiCapability,
  getGeminiApiKey,
  setGeminiApiKey,
  getAiConfig,
  saveAiConfig,
  testAiConnection,
  sharpenIntention,
  DEFAULT_AI_CONFIGS,
  POPULAR_MODELS,
} from '../utils/geminiAi.ts';

test('getGeminiApiKey and setGeminiApiKey manage localStorage safely', () => {
  const mockStorage: Record<string, string> = {};
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;

  try {
    (globalThis as any).window = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
    };

    assert.equal(getGeminiApiKey(), '');
    setGeminiApiKey('AIzaSyDummyKey123');
    assert.equal(getGeminiApiKey(), 'AIzaSyDummyKey123');
    setGeminiApiKey('');
    assert.equal(getGeminiApiKey(), '');
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalLocalStorage;
  }
});

test('getAiConfig and saveAiConfig support OpenRouter, Ollama, and Custom endpoints', () => {
  const mockStorage: Record<string, string> = {};
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;

  try {
    (globalThis as any).window = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
    };

    // 1. Initial default is gemini
    const initial = getAiConfig();
    assert.equal(initial.provider, 'gemini');

    // 2. Configure OpenRouter with free Llama 3.3 model
    saveAiConfig({
      provider: 'openrouter',
      apiKey: 'sk-or-v1-dummy',
      model: 'meta-llama/llama-3.3-70b-instruct:free',
    });
    const orConfig = getAiConfig();
    assert.equal(orConfig.provider, 'openrouter');
    assert.equal(orConfig.apiKey, 'sk-or-v1-dummy');
    assert.equal(orConfig.model, 'meta-llama/llama-3.3-70b-instruct:free');
    assert.equal(orConfig.baseUrl, DEFAULT_AI_CONFIGS.openrouter.baseUrl);

    // 3. Configure Localhost / Ollama endpoint
    saveAiConfig({
      provider: 'local',
      baseUrl: 'http://localhost:11434/v1',
      model: 'deepseek-r1:8b',
    });
    const localConfig = getAiConfig();
    assert.equal(localConfig.provider, 'local');
    assert.equal(localConfig.baseUrl, 'http://localhost:11434/v1');
    assert.equal(localConfig.model, 'deepseek-r1:8b');

    // 4. Offline mode configuration
    saveAiConfig({
      provider: 'offline',
    });
    const offlineConfig = getAiConfig();
    assert.equal(offlineConfig.provider, 'offline');

    // 5. Security: CRLF injection in apiKey & unsafe baseUrl protocols
    saveAiConfig({
      provider: 'gemini',
      apiKey: 'AIzaSySafeKey\r\nInjectedHeader: value',
      baseUrl: 'javascript:alert(1)',
    });
    const sanitizedConfig = getAiConfig();
    assert.equal(sanitizedConfig.apiKey, 'AIzaSySafeKeyInjectedHeader: value');
    assert.equal(sanitizedConfig.baseUrl, DEFAULT_AI_CONFIGS.gemini.baseUrl);
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalLocalStorage;
  }
});

test('testAiConnection in offline mode verifies instantly without network requests', async () => {
  const mockStorage: Record<string, string> = {};
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;

  try {
    (globalThis as any).window = {};
    (globalThis as any).localStorage = {
      getItem: (k: string) => mockStorage[k] || null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
    };

    const res = await testAiConnection({ provider: 'offline' });
    assert.equal(res.success, true);
    assert.equal(res.latencyMs, 0);
    assert.ok(res.message.includes('Offline Heuristics'));
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalLocalStorage;
  }
});

test('POPULAR_MODELS provides free model recommendations for OpenRouter and Ollama', () => {
  assert.ok(POPULAR_MODELS.openrouter.some(m => m.free && m.id.includes('llama')));
  assert.ok(POPULAR_MODELS.openrouter.some(m => m.free && m.id.includes('gemini')));
  assert.ok(POPULAR_MODELS.local.some(m => m.id === 'llama3.2'));
  assert.ok(POPULAR_MODELS.local.some(m => m.id === 'deepseek-r1:8b'));
});

test('sharpenIntention gracefully falls back when no AI provider is configured', async () => {
  const result = await sharpenIntention('code the auth route');
  assert.ok(result.length > 0);
  assert.ok(result.toLowerCase().includes('code the auth route'));
});

test('checkAiCapability reports status accurately', async () => {
  const status = await checkAiCapability();
  assert.equal(typeof status.hasOnDeviceAi, 'boolean');
  assert.equal(typeof status.hasApiKey, 'boolean');
  assert.equal(typeof status.providerName, 'string');
});
