/**
 * Supabase Optional Cloud Sync Adapter for Kairo.
 *
 * Offline-first: Kairo never requires a network connection or Supabase credentials.
 * Backups require a Supabase Auth session so each user only touches their own row
 * (enforced server-side by RLS, see SUPABASE_SETUP_SQL).
 */

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  autoSync: boolean;
  lastSyncedAt?: string;
}

export interface SupabaseSession {
  accessToken: string;
  userId: string;
}

const STORAGE_KEY = 'kairo_supabase_config';
const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

export const SUPABASE_SETUP_SQL =
  'create table kairo_backups (user_id uuid primary key references auth.users(id) on delete cascade, updated_at timestamptz not null default now(), payload jsonb not null); ' +
  'alter table kairo_backups enable row level security; ' +
  'create policy "own row" on kairo_backups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);';

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

const sanitizeApiKey = (key: string): string => {
  return key.replace(/[\r\n]/g, '').trim();
};

const normalizeBaseUrl = (url: string): string => {
  let cleaned = url.trim().replace(/\/+$/, '');
  if (!cleaned) return '';
  if (!cleaned.startsWith('http://') && !cleaned.startsWith('https://')) {
    cleaned = `https://${cleaned}`;
  }
  try {
    const parsed = new URL(cleaned);
    const isLocalhost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    if (parsed.protocol === 'http:' && !isLocalhost) {
      parsed.protocol = 'https:';
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
};

const isTrustedSupabaseOrigin = (origin: string): boolean => {
  try {
    const parsed = new URL(origin);
    if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') return true;
    return parsed.protocol === 'https:' && /^[a-z0-9-]+\.supabase\.(co|in)$/i.test(parsed.hostname);
  } catch {
    return false;
  }
};

const authHeaders = (anonKey: string, session: SupabaseSession) => ({
  'Content-Type': 'application/json',
  apikey: anonKey,
  Authorization: `Bearer ${session.accessToken}`,
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies that the Supabase endpoint is reachable with the provided credentials.
 */
export const testSupabaseConnection = async (
  url: string,
  anonKey: string,
): Promise<{ ok: boolean; message: string }> => {
  const base = normalizeBaseUrl(url);
  const cleanKey = sanitizeApiKey(anonKey);
  if (!base) return { ok: false, message: 'Please enter your Supabase Project URL' };
  if (!cleanKey) return { ok: false, message: 'Please enter your Supabase Anon API Key' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`${base}/rest/v1/`, {
      method: 'GET',
      headers: { apikey: cleanKey, Authorization: `Bearer ${cleanKey}` },
      signal: controller.signal,
    });

    if (res.ok || res.status === 404) {
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
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Signs in with Supabase Auth (email + password). The session is returned to the
 * caller and never persisted.
 */
export const signInSupabase = async (
  url: string,
  anonKey: string,
  email: string,
  password: string,
): Promise<{ ok: boolean; session?: SupabaseSession; message: string }> => {
  const base = normalizeBaseUrl(url);
  const cleanKey = sanitizeApiKey(anonKey);
  if (!base || !cleanKey) return { ok: false, message: 'Supabase URL or API Key missing.' };
  if (!email.trim() || !password) return { ok: false, message: 'Enter your Supabase account email and password.' };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${base}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: cleanKey },
      body: JSON.stringify({ email: email.trim(), password }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { ok: false, message: res.status === 400 ? 'Sign-in failed. Check email and password.' : `Sign-in failed with HTTP ${res.status}` };
    }
    const body = await res.json();
    const accessToken = typeof body?.access_token === 'string' ? body.access_token : '';
    const userId = typeof body?.user?.id === 'string' ? body.user.id : '';
    if (!accessToken || !UUID.test(userId)) {
      return { ok: false, message: 'Sign-in returned an unexpected response.' };
    }
    return { ok: true, session: { accessToken, userId }, message: 'Signed in.' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { ok: false, message: `Sign-in error: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
};

const fetchRemoteUpdatedAt = async (
  base: string,
  anonKey: string,
  session: SupabaseSession,
  signal: AbortSignal,
): Promise<string | null> => {
  const res = await fetch(
    `${base}/rest/v1/kairo_backups?user_id=eq.${session.userId}&select=updated_at`,
    { method: 'GET', headers: authHeaders(anonKey, session), signal },
  );
  if (!res.ok) return null;
  const rows = await res.json().catch(() => null);
  return Array.isArray(rows) && typeof rows[0]?.updated_at === 'string' ? rows[0].updated_at : null;
};

/**
 * Uploads a snapshot of Kairo data to the signed-in user's row.
 * Refuses to overwrite a cloud copy newer than the last sync unless `force` is set.
 */
export const backupToSupabase = async (
  url: string,
  anonKey: string,
  data: Record<string, unknown>,
  session: SupabaseSession | null,
  force = false,
): Promise<{ ok: boolean; conflict?: boolean; message: string }> => {
  const base = normalizeBaseUrl(url);
  const cleanKey = sanitizeApiKey(anonKey);
  if (!base || !cleanKey) {
    return { ok: false, message: 'Supabase URL or API Key missing.' };
  }
  if (!session) {
    return { ok: false, message: 'Sign in with your Supabase account before backing up.' };
  }

  const body = JSON.stringify({
    user_id: session.userId,
    updated_at: new Date().toISOString(),
    payload: data,
  });
  if (body.length > MAX_BACKUP_BYTES) {
    return { ok: false, message: 'Backup is larger than 5 MB and was not uploaded.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    if (!force) {
      const remote = await fetchRemoteUpdatedAt(base, cleanKey, session, controller.signal);
      const lastSynced = getSupabaseConfig().lastSyncedAt;
      if (remote && (!lastSynced || Date.parse(remote) > Date.parse(lastSynced))) {
        return {
          ok: false,
          conflict: true,
          message: 'The cloud backup is newer than this device\'s last sync. Overwrite it?',
        };
      }
    }

    const res = await fetch(`${base}/rest/v1/kairo_backups?on_conflict=user_id`, {
      method: 'POST',
      headers: { ...authHeaders(cleanKey, session), Prefer: 'resolution=merge-duplicates' },
      body,
      signal: controller.signal,
    });

    if (res.ok) {
      saveSupabaseConfig({ lastSyncedAt: new Date().toISOString() });
      return { ok: true, message: 'Backup successfully synced to Supabase!' };
    }

    if (res.status === 404) {
      return {
        ok: false,
        message: `Table "kairo_backups" not found in Supabase. Run SQL: ${SUPABASE_SETUP_SQL}`,
      };
    }
    return { ok: false, message: `Backup failed with HTTP ${res.status}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { ok: false, message: `Backup error: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Downloads the signed-in user's latest backup snapshot.
 */
export const restoreFromSupabase = async (
  url: string,
  anonKey: string,
  session: SupabaseSession | null,
): Promise<{ ok: boolean; data?: Record<string, unknown>; message: string }> => {
  const base = normalizeBaseUrl(url);
  const cleanKey = sanitizeApiKey(anonKey);
  if (!base || !cleanKey) {
    return { ok: false, message: 'Supabase URL or API Key missing.' };
  }
  if (!session) {
    return { ok: false, message: 'Sign in with your Supabase account before restoring.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(
      `${base}/rest/v1/kairo_backups?user_id=eq.${session.userId}&select=payload,updated_at`,
      { method: 'GET', headers: authHeaders(cleanKey, session), signal: controller.signal },
    );

    if (!res.ok) {
      return { ok: false, message: `Restore request failed with status ${res.status}` };
    }

    const rows = await res.json();
    const payload = Array.isArray(rows) ? rows[0]?.payload : null;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return { ok: false, message: 'No valid backup found in Supabase table "kairo_backups".' };
    }

    return {
      ok: true,
      data: payload as Record<string, unknown>,
      message: `Retrieved backup from ${rows[0].updated_at || 'cloud'}.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Network error';
    return { ok: false, message: `Restore error: ${msg}` };
  } finally {
    clearTimeout(timer);
  }
};

/**
 * Encodes Supabase credentials into a compact 1-line sync token.
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
 * Decodes a sync token. Only *.supabase.co / localhost endpoints are accepted so a
 * pasted token cannot redirect backups to an arbitrary host.
 */
export const decodeSyncToken = (token: string): { url: string; anonKey: string } | null => {
  try {
    const raw = token.trim().replace(/^kairo_/, '');
    const jsonStr = typeof atob !== 'undefined'
      ? atob(raw)
      : Buffer.from(raw, 'base64').toString('utf-8');
    const parsed = JSON.parse(jsonStr);
    if (parsed && typeof parsed.u === 'string' && typeof parsed.k === 'string') {
      const origin = normalizeBaseUrl(parsed.u);
      if (!origin || !isTrustedSupabaseOrigin(origin)) return null;
      return { url: parsed.u, anonKey: parsed.k };
    }
    return null;
  } catch {
    return null;
  }
};
