/** Local snapshot export. Only Kairo-owned keys; AI keys and sync credentials are never included. */
export const KAIRO_KEYS = [
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

export const LAST_BACKUP_KEY = 'kairo_last_backup';
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const getSnapshotPayload = (): Record<string, unknown> => {
  const data: Record<string, unknown> = {};
  KAIRO_KEYS.forEach(key => {
    const raw = localStorage.getItem(key);
    if (raw !== null) {
      try { data[key] = JSON.parse(raw); } catch { data[key] = raw; }
    }
  });
  return { version: 1, exportedAt: new Date().toISOString(), data };
};

export const exportSnapshot = (): string => JSON.stringify(getSnapshotPayload(), null, 2);

export const downloadSnapshot = (prefix = 'kairo'): void => {
  const blob = new Blob([exportSnapshot()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  try { localStorage.setItem(LAST_BACKUP_KEY, String(Date.now())); } catch { /* storage unavailable */ }
};

/** True when there is something worth backing up and no backup in the last week (or a "later" within a day). */
export const backupDue = (input: { sessionCount: number; lastBackup: string | null; snoozedUntil: string | null; now?: number }): boolean => {
  const now = input.now ?? Date.now();
  if (input.sessionCount < 3) return false;
  if (input.snoozedUntil && Number(input.snoozedUntil) > now) return false;
  const last = Number(input.lastBackup);
  return !Number.isFinite(last) || last <= 0 || now - last > WEEK_MS;
};
