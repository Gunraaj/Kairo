import React, { useRef, useState } from 'react';
import type { Settings } from '../types';
import { Modal } from './Modal';
import { normalizeSettings } from '../data/validation';

interface SettingsModalProps {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  onClose: () => void;
  onToast?: (message: string) => void;
}

/* Kairo is local-first: everything lives in this browser's localStorage.
   Export lets you carry it to another browser or back it up before clearing
   data; import restores it. Only Kairo-owned keys are touched. */
const KAIRO_KEYS = ['kairo_projects', 'kairo_sessions', 'kairo_active_task', 'kairo_settings', 'kairo_active_timer', 'kairo_theme', 'kairo_seen_welcome'];

const exportSnapshot = (): string => {
  const payload: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString(), data: {} as Record<string, unknown> };
  const data = payload.data as Record<string, unknown>;
  KAIRO_KEYS.forEach(k => {
    const raw = localStorage.getItem(k);
    if (raw !== null) {
      try { data[k] = JSON.parse(raw); } catch { data[k] = raw; }
    }
  });
  return JSON.stringify(payload, null, 2);
};

const importSnapshot = (text: string): number => {
  const parsed = JSON.parse(text) as { data?: Record<string, unknown> };
  const data = parsed.data;
  if (!data || typeof data !== 'object') throw new Error('Not a Kairo snapshot');
  let count = 0;
  KAIRO_KEYS.forEach(k => {
    if (k in data) {
      localStorage.setItem(k, JSON.stringify(data[k]));
      count += 1;
    }
  });
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

export const SettingsModal: React.FC<SettingsModalProps> = ({ settings, setSettings, onClose, onToast }) => {
  const [local, setLocal] = useState(settings);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleSave = () => {
    setSettings(normalizeSettings(local));
    onToast?.('Settings saved');
    onClose();
  };

  return (
    <Modal titleId="settings-title" onClose={onClose} className="settings-dialog">
      <header className="k-modal-header">
        <div>
          <h2 id="settings-title">Settings</h2>
          <p className="k-modal-sub">Adjust the pace and rhythm of your focus sessions.</p>
        </div>
        <button className="k-modal-close" onClick={onClose} aria-label="Close settings">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </header>

      <div className="k-modal-body">
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
      </div>

      <footer className="k-modal-footer">
        <button onClick={onClose} className="k-btn">Cancel</button>
        <button onClick={handleSave} className="k-btn k-btn-primary">Save settings</button>
      </footer>
    </Modal>
  );
};
