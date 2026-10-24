/**
 * Supabase Optional Cloud Sync Adapter for Kairo.
 * 
 * 100% Offline-First:
 * - Kairo never requires a network connection or Supabase credentials.
 * - All state lives reliably in localStorage.
 * - If user provides their Supabase URL and Anon Key in Settings, this module
 *   allows 1-click cloud backup, restore, and connection testing using standard
 *   browser fetch against the PostgREST API (0 extra dependencies).
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}

const STORAGE_KEY = 'kairo_supabase_config';

const getStorage = (): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null => {
  if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
};

export const getSupabaseConfig = (): SupabaseConfig => {
  const storage = getStorage();
  if (!storage) {
    return { url: '', anonKey: '', autoSync: false };
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { url: '', anonKey: '', autoSync: false };
    const parsed = JSON.parse(raw);
    return {
      url: typeof parsed.url === 'string' ? parsed.url.trim().replace(/\/+$/, '') : '',
      anonKey: typeof parsed.anonKey === 'string' ? parsed.anonKey.trim() : '',
      autoSync: Boolean(parsed.autoSync),
      lastSyncedAt: typeof parsed.lastSyncedAt === 'string' ? parsed.lastSyncedAt : undefined,
    };
  } catch {
    return { url: '', anonKey: '', autoSync: false };
  }
};

export const saveSupabaseConfig = (cfg: Partial<SupabaseConfig>): SupabaseConfig => {
  const current = getSupabaseConfig();
  const next: SupabaseConfig = {
    ...current,
    ...cfg,
    url: (cfg.url !== undefined ? cfg.url : current.url).trim().replace(/\/+$/, ''),
    anonKey: (cfg.anonKey !== undefined ? cfg.anonKey : current.anonKey).trim(),
  };
  const storage = getStorage();
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Non-blocking quota issue
  }
  return next;
};

const normalizeBaseUrl = (url: string): string => {
  let cleaned = url.trim().replace(/\/+$/, '');
  if (cleaned && !cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  return cleaned;
};

/**
 * Verifies that the Supabase endpoint is reachable with the provided credentials.
 */
export const testSupabaseConnection = async (
  url: string,
  anonKey: string,
): Promise<{ ok: boolean; message: string }> => {
  const base = normalizeBaseUrl(url);
  if (!base) return { ok: false, message: 'Please enter your Supabase Project URL' };
  if (!anonKey.trim()) return { ok: false, message: 'Please enter your Supabase Anon API Key' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(`${base}/rest/v1/`, {
      method: 'GET',
      headers: {
        apikey: anonKey.trim(),
        Authorization: `Bearer ${anonKey.trim()}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok || res.status === 200 || res.status === 404) {
      return { ok: true, message: 'Connection successful. Supabase project reachable.' };
    }
    if (res.status === 401 || res.status === 403) {
      return { ok: false, message: 'Authentication failed. Check your Supabase anon public key.' };
    }
    return { ok: false, message: `Server responded with status ${res.status}` };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, message: 'Connection timed out. Check the URL and internet connection.' };
    }
    const msg = err instanceof Error ? err.message : 'Network error';
    return { ok: false, message: `Could not connect: ${msg}` };
  }
};

/**
 * Uploads a complete snapshot of Kairo user data to Supabase.
 * Uses an upsert against the `kairo_backups` table.
 */
export const backupToSupabase = async (
  url: string,
  anonKey: string,
  data: Record<string, unknown>,
): Promise<{ ok: boolean; message: string }> => {
  const base = normalizeBaseUrl(url);
  if (!base || !anonKey.trim()) {
    return { ok: false, message: 'Supabase URL or API Key missing.' };
  }

  const payload = {
    id: 'kairo_primary_backup',
    updated_at: new Date().toISOString(),
    payload: data,
  };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${base}/rest/v1/kairo_backups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: anonKey.trim(),
        Authorization: `Bearer ${anonKey.trim()}`,
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok || res.status === 201 || res.status === 200 || res.status === 204) {
      saveSupabaseConfig({ lastSyncedAt: new Date().toISOString() });
      return { ok: true, message: 'Backup successfully synced to Supabase!' };
    }

    if (res.status === 404 || res.status === 400) {
      const errText = await res.text().catch(() => '');
      if (errText.includes('relation "kairo_backups" does not exist') || res.status === 404) {
        return {
          ok: false,
          message: 'Table "kairo_backups" not found in Supabase. Run SQL: create table kairo_backups (id text primary key, updated_at timestamptz, payload jsonb);',
        };
      }
    }

    return { ok: false, message: `Backup failed with HTTP ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { ok: false, message: `Backup error: ${msg}` };
  }
};

/**
 * Downloads the latest backup snapshot from Supabase.
 */
export const restoreFromSupabase = async (
  url: string,
  anonKey: string,
): Promise<{ ok: boolean; data?: Record<string, unknown>; message: string }> => {
  const base = normalizeBaseUrl(url);
  if (!base || !anonKey.trim()) {
    return { ok: false, message: 'Supabase URL or API Key missing.' };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${base}/rest/v1/kairo_backups?id=eq.kairo_primary_backup&select=payload,updated_at`, {
      method: 'GET',
      headers: {
        apikey: anonKey.trim(),
        Authorization: `Bearer ${anonKey.trim()}`,
      },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { ok: false, message: `Restore request failed with status ${res.status}` };
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || rows.length === 0 || !rows[0].payload) {
      return { ok: false, message: 'No backup found in Supabase table "kairo_backups".' };
    }

    return {
      ok: true,
      data: rows[0].payload as Record<string, unknown>,
      message: `Retrieved backup from ${rows[0].updated_at || 'cloud'}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { ok: false, message: `Restore error: ${msg}` };
  }
};

/**
 * Encodes Supabase credentials into a compact 1-line sync token.
 * Easy to copy/paste between localhost, Netlify, and mobile devices.
 */
export const encodeSyncToken = (url: string, anonKey: string): string => {
  const u = url.trim().replace(/\/+$/, '');
  const k = anonKey.trim();
  if (!u || !k) return '';
  const obj = { u, k };
  try {
    if (typeof btoa !== 'undefined') {
      return `kairo_${btoa(JSON.stringify(obj))}`;
    }
    return `kairo_${Buffer.from(JSON.stringify(obj)).toString('base64')}`;
  } catch {
    return '';
  }
};

/**
 * Decodes a 1-line sync token back into URL and anon key.
 */
export const decodeSyncToken = (token: string): { url: string; anonKey: string } | null => {
  try {
    const raw = token.trim().replace(/^kairo_/, '');
    const jsonStr = typeof atob !== 'undefined'
      ? atob(raw)
      : Buffer.from(raw, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.u === 'string' && typeof parsed.k === 'string') {
      return { url: parsed.u, anonKey: parsed.k };
    }
    return null;
  } catch {
    return null;
  }
};
