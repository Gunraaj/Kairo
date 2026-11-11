import React, { useEffect, useRef, useState } from 'react';
import type { Settings } from '../types';
import { Modal } from './Modal';
import {
  normalizeActiveTaskId,
  normalizePalette,
  normalizeProjects,
  normalizeSavedStreams,
  normalizeSessions,
  normalizeSettings,
  normalizeTheme,
  normalizeTimeCapsules,
} from '../data/validation';
import {
  checkAiCapability,
  getAiConfig,
  saveAiConfig,
  testAiConnection,
  POPULAR_MODELS,
  DEFAULT_AI_CONFIGS,
  type AiConfig,
  type AiProviderType,
  type AiCapabilityStatus,
} from '../utils/geminiAi';
import {
  backupToSupabase,
  getSupabaseConfig,
  restoreFromSupabase,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../utils/supabaseSync';
import { BrandLogo, LOGO_VARIANTS, type LogoVariant } from './BrandLogo';

interface SettingsModalProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  onClose: () => void;
  onToast?: (message: string) => void;
  theme?: 'light' | 'dark';
  setTheme?: (theme: 'light' | 'dark') => void;
  palette?: 'obsidian' | 'zen' | 'indigo' | 'washi';
  setPalette?: (palette: 'obsidian' | 'zen' | 'indigo' | 'washi') => void;
  logoVariant?: LogoVariant;
  setLogoVariant?: (variant: LogoVariant) => void;
}

const PALETTES = [
  {
    id: 'obsidian',
    name: 'Obsidian Noir',
    subtitle: 'Tokyo Midnight · OLED Black · Vermilion',
    swatches: ['#09090B', '#18181F', '#FF453A'],
  },
  {
    id: 'zen',
    name: 'Zen Sanctuary',
    subtitle: 'Kyoto Moss · Emerald · Misty Sage',
    swatches: ['#0A0F0D', '#18251F', '#34D399'],
  },
  {
    id: 'indigo',
    name: 'Midnight Indigo',
    subtitle: 'Cosmic Deep · Cyan Glow · Sky',
    swatches: ['#080A12', '#171D33', '#38BDF8'],
  },
  {
    id: 'washi',
    name: 'Artisanal Washi',
    subtitle: 'Warm Paper · Sumi Ink · Terracotta',
    swatches: ['#FAF7F2', '#E6DED3', '#C9382A'],
  },
] as const;

/* Kairo is local-first: everything lives in this browser's localStorage.
   Export lets you carry it to another browser or back it up before clearing
   data; import restores it. Only Kairo-owned keys are touched. */
const KAIRO_KEYS = [
  'kairo_projects',
  'kairo_sessions',
  'kairo_active_task',
  'kairo_settings',
  'kairo_active_timer',
  'kairo_theme',
  'kairo_palette',
  'kairo_seen_welcome',
  'kairo_custom_atmospheres',
  'kairo_custom_beats',
  'kairo_saved_streams',
  'kairo_treat_capsules',
  'kairo_time_capsules',
  'kairo_logo_variant',
];

const exportSnapshot = (): string => {
  return JSON.stringify(getSnapshotPayload(), null, 2);
};

const getSnapshotPayload = (): Record<string, unknown> => {
  const payload: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString(), data: {} as Record<string, unknown> };
  const data = payload.data as Record<string, unknown>;
  KAIRO_KEYS.forEach(k => {
    const raw = localStorage.getItem(k);
    if (raw !== null) {
      try { data[k] = JSON.parse(raw); } catch { data[k] = raw; }
    }
  });
  return payload;
};

const unwrapStoredData = (value: unknown): unknown => {
  if (value && typeof value === 'object' && !Array.isArray(value) && 'data' in value) {
    return (value as { data: unknown }).data;
  }
  return value;
};

const importSnapshot = (text: string): number => {
  const parsed = JSON.parse(text) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object') throw new Error('Not a valid Kairo snapshot');
  const source = (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)
    ? parsed.data
    : parsed) as Record<string, unknown>;

  let count = 0;
  const safeKeys = new Set(KAIRO_KEYS);

  for (const [key, rawVal] of Object.entries(source)) {
    if (!safeKeys.has(key) || key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    const val = unwrapStoredData(rawVal);

    if (key === 'kairo_projects') {
      const normalized = normalizeProjects(val);
      localStorage.setItem(key, JSON.stringify({ version: 2, data: normalized }));
      count += 1;
    } else if (key === 'kairo_sessions') {
      const normalized = normalizeSessions(val);
      localStorage.setItem(key, JSON.stringify({ version: 2, data: normalized }));
      count += 1;
    } else if (key === 'kairo_settings') {
      const normalized = normalizeSettings(val);
      localStorage.setItem(key, JSON.stringify({ version: 2, data: normalized }));
      count += 1;
    } else if (key === 'kairo_active_task') {
      const normalized = normalizeActiveTaskId(val);
      localStorage.setItem(key, JSON.stringify({ version: 1, data: normalized }));
      count += 1;
    } else if (key === 'kairo_theme') {
      const normalized = normalizeTheme(val);
      localStorage.setItem(key, normalized);
      count += 1;
    } else if (key === 'kairo_palette') {
      const normalized = normalizePalette(val);
      localStorage.setItem(key, normalized);
      count += 1;
    } else if (key === 'kairo_saved_streams') {
      const normalized = normalizeSavedStreams(val);
      localStorage.setItem(key, JSON.stringify({ version: 1, data: normalized }));
      count += 1;
    } else if (key === 'kairo_time_capsules' || key === 'kairo_treat_capsules') {
      const normalized = normalizeTimeCapsules(val);
      localStorage.setItem('kairo_time_capsules', JSON.stringify({ version: 1, data: normalized }));
      count += 1;
    } else {
      localStorage.setItem(key, JSON.stringify(val));
      count += 1;
    }
  }

  if (count === 0) throw new Error('Snapshot contained no recognizable Kairo data');
  return count;
};

const Toggle: React.FC<{
  labelId: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}> = ({ labelId, enabled, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-labelledby={labelId}
    aria-checked={enabled}
    onClick={() => onChange(!enabled)}
    className={`k-toggle ${enabled ? '' : ''}`}
    aria-pressed={enabled}
  >
    <span className="k-toggle-track" aria-hidden="true" />
  </button>
);

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  setSettings,
  onClose,
  onToast,
  theme,
  setTheme,
  palette = 'obsidian',
  setPalette,
  logoVariant = 'interval',
  setLogoVariant,
}) => {
  const [local, setLocal] = useState(settings);
  const [aiConfig, setAiConfig] = useState<AiConfig>(() => getAiConfig());
  const [showAiKey, setShowAiKey] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string; latencyMs?: number; model?: string } | null>(null);
  const [isCustomModel, setIsCustomModel] = useState(() => {
    const cfg = getAiConfig();
    const presets = POPULAR_MODELS[cfg.provider] || [];
    return !presets.some(m => m.id === cfg.model);
  });
  const [aiStatus, setAiStatus] = useState<AiCapabilityStatus>({
    hasOnDeviceAi: false,
    hasApiKey: false,
    providerName: 'Checking...',
  });
  const [supabaseUrl, setSupabaseUrl] = useState(() => getSupabaseConfig().url);
  const [supabaseKey, setSupabaseKey] = useState(() => getSupabaseConfig().anonKey);
  const [supabaseStatus, setSupabaseStatus] = useState<string | null>(null);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [isSyncingSupabase, setIsSyncingSupabase] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    checkAiCapability().then(setAiStatus);
  }, []);

  const handleTestSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setSupabaseStatus('Please enter both Supabase URL and Anon Key');
      return;
    }
    setIsTestingSupabase(true);
    setSupabaseStatus('Testing connection...');
    const res = await testSupabaseConnection(supabaseUrl, supabaseKey);
    setIsTestingSupabase(false);
    setSupabaseStatus(res.message);
  };

  const handleBackupSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setSupabaseStatus('Please enter Supabase URL and Anon Key first');
      return;
    }
    setIsSyncingSupabase(true);
    setSupabaseStatus('Uploading backup...');
    const payload = getSnapshotPayload();
    const res = await backupToSupabase(supabaseUrl, supabaseKey, payload);
    setIsSyncingSupabase(false);
    setSupabaseStatus(res.message);
    if (res.ok) onToast?.('Cloud backup uploaded to Supabase');
  };

  const handleRestoreSupabase = async () => {
    if (!supabaseUrl.trim() || !supabaseKey.trim()) {
      setSupabaseStatus('Please enter Supabase URL and Anon Key first');
      return;
    }
    setIsSyncingSupabase(true);
    setSupabaseStatus('Retrieving cloud backup...');
    const res = await restoreFromSupabase(supabaseUrl, supabaseKey);
    setIsSyncingSupabase(false);
    if (res.ok && res.data) {
      try {
        const count = importSnapshot(JSON.stringify(res.data));
        onToast?.(`Restored ${count} records from Supabase — reloading`);
        window.setTimeout(() => window.location.reload(), 600);
      } catch {
        setSupabaseStatus('Could not parse restored data');
      }
    } else {
      setSupabaseStatus(res.message);
    }
  };

  const handleExport = () => {
    const blob = new Blob([exportSnapshot()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `kairo-${stamp}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    onToast?.('Snapshot exported');
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const count = importSnapshot(text);
      onToast?.(`Imported ${count} record${count === 1 ? '' : 's'} — reloading`);
      window.setTimeout(() => window.location.reload(), 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Import failed';
      onToast?.(`Import failed: ${msg}`);
    }
  };

  const updateNumber = (
    key: 'focusDuration' | 'shortBreakDuration' | 'longBreakDuration' | 'sessionsPerRound',
    value: number,
  ) => {
    if (!Number.isFinite(value)) return;
    setLocal(prev => normalizeSettings({ ...prev, [key]: value }));
  };

  const handleTestAi = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await testAiConnection(aiConfig);
      setAiTestResult(res);
      checkAiCapability().then(setAiStatus);
    } catch (err: any) {
      setAiTestResult({ success: false, message: err?.message || 'Connection test failed' });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSave = () => {
    setSettings(normalizeSettings(local));
    saveAiConfig(aiConfig);
    saveSupabaseConfig({ url: supabaseUrl, anonKey: supabaseKey });
    onToast?.('Settings saved');
    onClose();
  };

  return (
    <Modal titleId="settings-title" onClose={onClose} className="settings-dialog">
      <header className="k-modal-header">
        <div>
          <h2 id="settings-title">Settings</h2>
          <p className="k-modal-sub">Adjust the pace, aesthetic, and rhythm of your focus sessions.</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close settings">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className="k-modal-body">
        {/* Atmosphere & Theme Selector */}
        <section className="k-settings-section">
          <div className="k-settings-section-title">Atmosphere & Aesthetics</div>
          <p className="k-settings-section-help">Choose your light/dark mode and atmospheric visual world.</p>

          <div className="k-theme-mode-row">
            <button
              type="button"
              className={`k-theme-mode-btn ${theme === 'dark' ? 'is-active' : ''}`}
              onClick={() => setTheme?.('dark')}
            >
              <span>🌙</span> Dark
            </button>
            <button
              type="button"
              className={`k-theme-mode-btn ${theme === 'light' ? 'is-active' : ''}`}
              onClick={() => setTheme?.('light')}
            >
              <span>☀️</span> Light
            </button>
          </div>

          <div className="k-palette-grid">
            {PALETTES.map(p => (
              <button
                key={p.id}
                type="button"
                className={`k-palette-card ${palette === p.id ? 'is-active' : ''}`}
                onClick={() => setPalette?.(p.id as 'obsidian' | 'zen' | 'indigo' | 'washi')}
              >
                <div className="k-palette-swatches">
                  {p.swatches.map((color, idx) => (
                    <span
                      key={idx}
                      className="k-palette-dot"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="k-palette-title">{p.name}</div>
                <div className="k-palette-desc">{p.subtitle}</div>
              </button>
            ))}
          </div>

          <div className="k-settings-section-title" style={{ marginTop: 24 }}>Kairo brand mark</div>
          <p className="k-settings-section-help">The interval mark uses a bold task anchor, tactile interval arms, and one rounded vermilion active-state latch.</p>
          <div className="k-logo-variants-grid">
            {LOGO_VARIANTS.map(v => (
              <button
                key={v.id}
                type="button"
                className={`k-logo-variant-card ${logoVariant === v.id ? 'is-active' : ''}`}
                onClick={() => setLogoVariant?.(v.id)}
              >
                <div className="k-variant-icon-wrap">
                  <BrandLogo variant={v.id} size={28} />
                </div>
                <div className="k-variant-meta">
                  <div className="k-variant-name">
                    <span>{v.name}</span>
                    <span className="k-variant-kanji">{v.japanese}</span>
                  </div>
                  <div className="k-variant-desc">{v.concept}</div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="k-settings-section">
          <div className="k-settings-section-title">Timer lengths</div>
          <p className="k-settings-section-help">Choose a pace you can repeat. Changes apply after the current timer is reset.</p>
          <div className="k-settings-grid">
            {([
              ['focusDuration', 'Focus', 180],
              ['shortBreakDuration', 'Short break', 60],
              ['longBreakDuration', 'Long break', 120],
            ] as const).map(([key, label, max]) => (
              <label key={key}>
                <span className="k-settings-grid-label">{label}</span>
                <input
                  type="number"
                  min={1}
                  max={max}
                  value={local[key]}
                  onChange={e => updateNumber(key, Number(e.target.value))}
                  aria-label={`${label} minutes`}
                />
              </label>
            ))}
          </div>
        </section>

        <section className="k-settings-section">
          <div className="k-settings-section-title">Round structure</div>
          <p className="k-settings-section-help">A long break follows each completed round.</p>

          <div className="k-settings-row">
            <div className="k-settings-row-label">
              <b id="sessions-per-round-label">Focus sessions per round</b>
              <small>How many focus blocks before a long break.</small>
            </div>
            <span className="k-num-input-wrap">
              <input
                className="k-num-input"
                type="number"
                min={1}
                max={12}
                value={local.sessionsPerRound}
                onChange={e => updateNumber('sessionsPerRound', Number(e.target.value))}
                aria-labelledby="sessions-per-round-label"
              />
            </span>
          </div>

          <div className="k-settings-row">
            <div className="k-settings-row-label">
              <b id="deep-focus-label">Deep focus guard</b>
              <small>Pause the timer when this tab becomes hidden.</small>
            </div>
            <Toggle
              labelId="deep-focus-label"
              enabled={local.deepFocusMode}
              onChange={enabled => setLocal(prev => ({ ...prev, deepFocusMode: enabled }))}
            />
          </div>

          <div className="k-settings-row">
            <div className="k-settings-row-label">
              <b id="auto-start-label">Auto-start breaks</b>
              <small>Start the break timer automatically after focus.</small>
            </div>
            <Toggle
              labelId="auto-start-label"
              enabled={local.autoStartBreaks}
              onChange={enabled => setLocal(prev => ({ ...prev, autoStartBreaks: enabled }))}
            />
          </div>
        </section>

        <section className="k-settings-section">
          <div className="k-settings-section-title">Focus AI Assistant & Models</div>
          <p className="k-settings-section-help">
            Choose your AI engine: Google Gemini (Free tier), OpenRouter (Free & Any open-source model), Local AI via Ollama / LM Studio, Custom OpenAI-compatible endpoints, or 100% Offline Heuristics.
          </p>

          {/* Provider Tabs */}
          <div className="k-ai-provider-grid">
            {[
              { id: 'gemini', label: 'Google Gemini', badge: 'Free tier', icon: '⚡' },
              { id: 'openrouter', label: 'OpenRouter', badge: 'Free & Open', icon: '🌐' },
              { id: 'local', label: 'Local (Ollama)', badge: 'Private Offline', icon: '💻' },
              { id: 'openai_custom', label: 'Custom Endpoint', badge: 'OpenAI / Groq', icon: '⚙️' },
              { id: 'offline', label: 'Offline Engine', badge: 'No API / Zero Cost', icon: '📴' },
            ].map(p => (
              <button
                key={p.id}
                type="button"
                className={`k-ai-provider-card ${aiConfig.provider === p.id ? 'active' : ''}`}
                onClick={() => {
                  const prov = p.id as AiProviderType;
                  const def = DEFAULT_AI_CONFIGS[prov];
                  setAiConfig(prev => ({
                    ...prev,
                    provider: prov,
                    baseUrl: def.baseUrl,
                    model: def.model,
                  }));
                  setIsCustomModel(false);
                  setAiTestResult(null);
                }}
              >
                <span className="k-ai-provider-icon">{p.icon}</span>
                <div className="k-ai-provider-info">
                  <b>{p.label}</b>
                  <small>{p.badge}</small>
                </div>
              </button>
            ))}
          </div>

          {/* Configuration Form for Active Provider */}
          <div className="k-ai-config-panel">
            {/* 1. API Key Input (if not offline) */}
            {aiConfig.provider !== 'offline' && (
              <div className="k-settings-row">
                <div className="k-settings-row-label">
                  <b>
                    {aiConfig.provider === 'gemini'
                      ? 'Google Gemini API Key'
                      : aiConfig.provider === 'openrouter'
                      ? 'OpenRouter API Key'
                      : aiConfig.provider === 'local'
                      ? 'API Key (Optional)'
                      : 'API Key'}
                  </b>
                  <small>
                    {aiConfig.provider === 'gemini' && (
                      <>
                        Free key from{' '}
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: 'underline', color: 'var(--shu)' }}
                        >
                          Google AI Studio (1,500 req/day free)
                        </a>
                      </>
                    )}
                    {aiConfig.provider === 'openrouter' && (
                      <>
                        Key from{' '}
                        <a
                          href="https://openrouter.ai/keys"
                          target="_blank"
                          rel="noreferrer"
                          style={{ textDecoration: 'underline', color: 'var(--shu)' }}
                        >
                          OpenRouter.ai
                        </a>{' '}
                        (Access to free Llama 3.3, DeepSeek R1, Gemini, etc.)
                      </>
                    )}
                    {aiConfig.provider === 'local' && (
                      <span>Leave blank for standard Ollama / LM Studio setup</span>
                    )}
                    {aiConfig.provider === 'openai_custom' && (
                      <span>OpenAI, Groq, Together, or Mistral API token</span>
                    )}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    type={showAiKey ? 'text' : 'password'}
                    value={aiConfig.apiKey}
                    onChange={e => setAiConfig(prev => ({ ...prev, apiKey: e.target.value }))}
                    placeholder={DEFAULT_AI_CONFIGS[aiConfig.provider]?.placeholderKey || 'API key...'}
                    style={{
                      padding: '6px 10px',
                      fontSize: 12,
                      fontFamily: 'var(--mono)',
                      borderRadius: 'var(--r-sm)',
                      border: '1px solid var(--stone-2)',
                      background: 'var(--washi)',
                      color: 'var(--sumi)',
                      width: 180,
                    }}
                  />
                  <button
                    type="button"
                    className="k-btn"
                    style={{ minHeight: 30, padding: '0 8px', fontSize: 11 }}
                    onClick={() => setShowAiKey(v => !v)}
                  >
                    {showAiKey ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Base URL Input (for Localhost & Custom) */}
            {(aiConfig.provider === 'local' || aiConfig.provider === 'openai_custom') && (
              <div className="k-settings-row">
                <div className="k-settings-row-label">
                  <b>Endpoint Base URL</b>
                  <small>
                    {aiConfig.provider === 'local'
                      ? 'Ollama: http://localhost:11434/v1 | LM Studio: http://127.0.0.1:1234/v1'
                      : 'e.g. https://api.openai.com/v1 or https://api.groq.com/openai/v1'}
                  </small>
                </div>
                <input
                  type="text"
                  value={aiConfig.baseUrl}
                  onChange={e => setAiConfig(prev => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="http://localhost:11434/v1"
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    fontFamily: 'var(--mono)',
                    borderRadius: 'var(--r-sm)',
                    border: '1px solid var(--stone-2)',
                    background: 'var(--washi)',
                    color: 'var(--sumi)',
                    width: 220,
                  }}
                />
              </div>
            )}

            {/* 3. Model Selector & Presets */}
            {aiConfig.provider !== 'offline' && (
              <div className="k-settings-row">
                <div className="k-settings-row-label">
                  <b>Model</b>
                  <small>
                    {isCustomModel ? 'Type any custom model tag' : 'Choose a preset or type custom'}
                  </small>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                  {isCustomModel ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <input
                        type="text"
                        value={aiConfig.model}
                        onChange={e => setAiConfig(prev => ({ ...prev, model: e.target.value }))}
                        placeholder="model-name:tag"
                        style={{
                          padding: '6px 10px',
                          fontSize: 12,
                          fontFamily: 'var(--mono)',
                          borderRadius: 'var(--r-sm)',
                          border: '1px solid var(--stone-2)',
                          background: 'var(--washi)',
                          color: 'var(--sumi)',
                          width: 170,
                        }}
                      />
                      <button
                        type="button"
                        className="k-btn"
                        style={{ minHeight: 30, padding: '0 8px', fontSize: 11 }}
                        onClick={() => {
                          setIsCustomModel(false);
                          setAiConfig(prev => ({ ...prev, model: DEFAULT_AI_CONFIGS[aiConfig.provider].model }));
                        }}
                      >
                        Presets
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <select
                        value={aiConfig.model}
                        onChange={e => {
                          if (e.target.value === '__custom__') {
                            setIsCustomModel(true);
                          } else {
                            setAiConfig(prev => ({ ...prev, model: e.target.value }));
                          }
                        }}
                        style={{
                          padding: '6px 10px',
                          fontSize: 12,
                          fontFamily: 'var(--sans)',
                          borderRadius: 'var(--r-sm)',
                          border: '1px solid var(--stone-2)',
                          background: 'var(--washi)',
                          color: 'var(--sumi)',
                          maxWidth: 210,
                        }}
                      >
                        {(POPULAR_MODELS[aiConfig.provider] || []).map(m => (
                          <option key={m.id} value={m.id}>
                            {m.label} {m.free ? '🎁' : ''}
                          </option>
                        ))}
                        <option value="__custom__">Custom Model...</option>
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 4. Ollama CORS Tip Callout */}
            {aiConfig.provider === 'local' && (
              <div className="k-ai-tip-callout">
                <span className="k-ai-tip-icon">💡</span>
                <div className="k-ai-tip-text">
                  <b>Ollama Browser Access:</b> Web browsers require CORS to talk to local ports. Start Ollama with:
                  <code className="k-code-inline">OLLAMA_ORIGINS="*" ollama serve</code>
                </div>
              </div>
            )}

            {/* 5. Offline Explanation */}
            {aiConfig.provider === 'offline' && (
              <div className="k-ai-offline-callout">
                <span className="k-ai-tip-icon">🛡️</span>
                <div className="k-ai-tip-text">
                  <b>100% Offline & Private:</b> Kairo uses its built-in cognitive load analysis and syllabus decomposition algorithms directly on your device. Zero API keys, zero network traffic, zero cost.
                </div>
              </div>
            )}

            {/* 6. Test Connection Button & Result Banner */}
            <div className="k-ai-test-row">
              <button
                type="button"
                className="k-btn k-btn-test-ai"
                onClick={handleTestAi}
                disabled={isTestingAi}
              >
                {isTestingAi ? 'Testing Connection...' : '⚡ Test Connection'}
              </button>

              {aiTestResult && (
                <div className={`k-ai-test-badge ${aiTestResult.success ? 'success' : 'error'}`}>
                  {aiTestResult.success ? (
                    <>
                      <span>✓ {aiTestResult.message}</span>
                    </>
                  ) : (
                    <>
                      <span>✕ {aiTestResult.message}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="k-settings-row" style={{ marginTop: 12 }}>
            <div className="k-settings-row-label">
              <b>Active AI Status</b>
              <small>{aiStatus.providerName}</small>
            </div>
            <span
              style={{
                fontSize: 11,
                fontFamily: 'var(--mono)',
                padding: '3px 8px',
                borderRadius: 4,
                background:
                  aiStatus.hasApiKey || aiStatus.hasOnDeviceAi
                    ? 'var(--shu-soft)'
                    : 'var(--washi-2)',
                color:
                  aiStatus.hasApiKey || aiStatus.hasOnDeviceAi
                    ? 'var(--shu)'
                    : 'var(--sumi-3)',
                border: '1px solid var(--stone-3)',
              }}
            >
              {aiStatus.providerName}
            </span>
          </div>
        </section>

        <section className="k-settings-section">
          <div className="k-settings-section-title">Your data</div>
          <p className="k-settings-section-help">
            Everything stays in this browser. Export a snapshot to move Kairo to another device or browser, or as a personal backup before clearing site data.
          </p>
          <div className="k-settings-row">
            <div className="k-settings-row-label">
              <b>Export snapshot</b>
              <small>Downloads a JSON of every project, task, session, setting, and preference.</small>
            </div>
            <button className="k-btn" onClick={handleExport} type="button">Download JSON</button>
          </div>
          <div className="k-settings-row">
            <div className="k-settings-row-label">
              <b>Import snapshot</b>
              <small>Replaces your current data with the contents of a Kairo JSON file. The app reloads afterward.</small>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) void handleImportFile(file);
                e.target.value = '';
              }}
            />
            <button className="k-btn" onClick={() => fileInputRef.current?.click()} type="button">Choose file</button>
          </div>
        </section>

        <section className="k-settings-section">
          <div className="k-settings-section-title">Optional Cloud Sync (Supabase)</div>
          <p className="k-settings-section-help">
            Kairo is 100% offline-first. To optionally back up or sync across browsers, provide your Supabase project credentials. Your keys stay in this browser.
          </p>
          <div className="k-settings-row">
            <div className="k-settings-row-label">
              <b>Supabase Project URL</b>
              <small>e.g. https://your-project-id.supabase.co</small>
            </div>
            <input
              type="text"
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              placeholder="https://xyz.supabase.co"
              style={{
                padding: '6px 10px',
                fontSize: 12,
                fontFamily: 'var(--mono)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--stone-2)',
                background: 'var(--washi)',
                color: 'var(--sumi)',
                width: 200,
              }}
            />
          </div>
          <div className="k-settings-row">
            <div className="k-settings-row-label">
              <b>Supabase Anon Public Key</b>
              <small>Found in Supabase Dashboard &gt; Project Settings &gt; API</small>
            </div>
            <input
              type="password"
              value={supabaseKey}
              onChange={e => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOi..."
              style={{
                padding: '6px 10px',
                fontSize: 12,
                fontFamily: 'var(--mono)',
                borderRadius: 'var(--r-sm)',
                border: '1px solid var(--stone-2)',
                background: 'var(--washi)',
                color: 'var(--sumi)',
                width: 200,
              }}
            />
          </div>
          <div className="k-settings-row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="k-btn"
                onClick={handleTestSupabase}
                disabled={isTestingSupabase}
              >
                {isTestingSupabase ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                type="button"
                className="k-btn"
                onClick={handleBackupSupabase}
                disabled={isSyncingSupabase || !supabaseUrl || !supabaseKey}
              >
                {isSyncingSupabase ? 'Syncing...' : 'Backup to Cloud'}
              </button>
              <button
                type="button"
                className="k-btn"
                onClick={handleRestoreSupabase}
                disabled={isSyncingSupabase || !supabaseUrl || !supabaseKey}
              >
                Restore from Cloud
              </button>
            </div>
            {supabaseStatus && (
              <span
                style={{
                  fontSize: 11,
                  fontFamily: 'var(--mono)',
                  color: supabaseStatus.toLowerCase().includes('fail') || supabaseStatus.toLowerCase().includes('not')
                    ? 'var(--shu)'
                    : 'var(--sumi-2)',
                  width: '100%',
                  marginTop: 4,
                }}
              >
                {supabaseStatus}
              </span>
            )}
          </div>
        </section>
      </div>

      <footer className="k-modal-footer">
        <button onClick={onClose} className="k-btn">Cancel</button>
        <button onClick={handleSave} className="k-btn k-btn-primary">Save settings</button>
      </footer>
    </Modal>
  );
};
