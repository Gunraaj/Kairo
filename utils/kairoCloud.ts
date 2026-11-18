import { buildAuthorizeUrl, createPkcePair, exchangeCode, needsRefresh, refreshSession, type AuthSession } from './supabaseAuth';
import { decryptVault, encryptVault, type VaultEnvelope } from './vaultCrypto';
import { exportSnapshot } from './backup';
import { normalizeProjects, normalizeSessions } from '../data/validation';

/**
 * Optional hosted sync ("Kairo Cloud"). The URL and publishable key are public by design;
 * row level security limits every row to its owner, and the vault only ever holds
 * ciphertext encrypted in this browser with a passphrase the server never sees.
 */
export const CLOUD = {
  url: 'https://xxfsmnxppdqwnakjijlk.supabase.co',
  anonKey: 'sb_publishable_oAaTRqnzamNa1v9t2FECLw_Zhncw9hc',
};

const SESSION_KEY = 'kairo_cloud_session';
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

type Fetch = typeof fetch;
const headers = (token?: string) => ({
  'Content-Type': 'application/json',
  apikey: CLOUD.anonKey,
  Authorization: `Bearer ${token ?? CLOUD.anonKey}`,
});

const failure = async (response: Response, fallback: string): Promise<never> => {
  let detail = '';
  try {
    const body = await response.json();
    detail = String(body?.msg ?? body?.error_description ?? body?.message ?? '').slice(0, 160);
  } catch { /* not json */ }
  if (response.status === 429) throw new Error('Too many attempts. Wait a few minutes and try again.');
  throw new Error(detail || `${fallback} (HTTP ${response.status}).`);
};

export const loadCloudSession = (): AuthSession | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
    return parsed && typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string' ? parsed : null;
  } catch { return null; }
};

const storeSession = (session: AuthSession | null) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch { /* storage unavailable */ }
};

const VERIFIER_KEY = 'kairo_cloud_verifier';

/** Emails a one-time sign-in link. The PKCE verifier stays in this browser, so the link only works here. */
export const sendLink = async (email: string, redirectTo: string, captchaToken: string, fetchImpl: Fetch = fetch): Promise<void> => {
  const clean = email.trim().toLowerCase();
  if (!EMAIL.test(clean)) throw new Error('Enter a valid email address.');
  const { verifier, challenge } = await createPkcePair();
  try { localStorage.setItem(VERIFIER_KEY, verifier); } catch { throw new Error('This browser blocks storage, so sign-in cannot work here.'); }
  const response = await fetchImpl(`${CLOUD.url}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ email: clean, create_user: true, code_challenge: challenge, code_challenge_method: 's256', gotrue_meta_security: { captcha_token: captchaToken } }),
  });
  if (!response.ok) await failure(response, 'Could not send the link');
};

/**
 * Sign in with Google through Supabase (PKCE). Kairo never sees the Google password; Google sends
 * the browser back here with a one-time ?code= that only this browser's verifier can redeem.
 */
export const signInWithGoogle = async (redirectTo: string): Promise<void> => {
  const { verifier, challenge } = await createPkcePair();
  try { localStorage.setItem(VERIFIER_KEY, verifier); } catch { throw new Error('This browser blocks storage, so sign-in cannot work here.'); }
  window.location.assign(buildAuthorizeUrl({ url: CLOUD.url, provider: 'google', redirectTo, challenge }));
};

/** Finishes sign-in when the page was opened from Google or an emailed link (?code=...). Returns true if a session was created. */
export const completeSignInFromUrl = async (fetchImpl: Fetch = fetch): Promise<boolean> => {
  const url = new URL(window.location.href);
  const providerError = url.searchParams.get('error_description') || url.searchParams.get('error');
  if (providerError && !url.searchParams.get('code')) {
    for (const key of ['error', 'error_code', 'error_description']) url.searchParams.delete(key);
    window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
    throw new Error(providerError.replace(/\+/g, ' ').slice(0, 160));
  }
  const code = url.searchParams.get('code');
  if (!code) return false;
  let verifier: string | null = null;
  try { verifier = localStorage.getItem(VERIFIER_KEY); } catch { /* storage unavailable */ }
  url.searchParams.delete('code');
  window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);
  if (!verifier || !/^[\w-]{8,200}$/.test(code)) return false;
  try {
    const session = await exchangeCode({ url: CLOUD.url, anonKey: CLOUD.anonKey, code, verifier, fetchImpl });
    storeSession(session);
    return true;
  } finally {
    try { localStorage.removeItem(VERIFIER_KEY); } catch { /* storage unavailable */ }
  }
};

export const activeSession = async (fetchImpl: Fetch = fetch): Promise<AuthSession | null> => {
  const session = loadCloudSession();
  if (!session) return null;
  if (!needsRefresh(session)) return session;
  try {
    const next = await refreshSession({ url: CLOUD.url, anonKey: CLOUD.anonKey, refreshToken: session.refreshToken, fetchImpl });
    storeSession(next);
    return next;
  } catch {
    storeSession(null);
    return null;
  }
};

export const signOut = async (fetchImpl: Fetch = fetch): Promise<void> => {
  const session = loadCloudSession();
  storeSession(null);
  if (session) {
    try { await fetchImpl(`${CLOUD.url}/auth/v1/logout`, { method: 'POST', headers: headers(session.accessToken) }); } catch { /* offline is fine */ }
  }
};

const requireSession = async (fetchImpl: Fetch) => {
  const session = await activeSession(fetchImpl);
  if (!session) throw new Error('Signed out. Sign in again to sync.');
  return session;
};

export const pushVault = async (passphrase: string, fetchImpl: Fetch = fetch): Promise<string> => {
  if (passphrase.length < 8) throw new Error('Use a passphrase of at least 8 characters.');
  const session = await requireSession(fetchImpl);
  const envelope = await encryptVault(exportSnapshot(), passphrase);
  const updatedAt = new Date().toISOString();
  const response = await fetchImpl(`${CLOUD.url}/rest/v1/kairo_vault?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...headers(session.accessToken), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({ user_id: session.userId, envelope, updated_at: updatedAt }),
  });
  if (!response.ok) await failure(response, 'Upload failed');
  return updatedAt;
};

export const pullVault = async (passphrase: string, fetchImpl: Fetch = fetch): Promise<{ text: string; updatedAt: string } | null> => {
  const session = await requireSession(fetchImpl);
  const response = await fetchImpl(`${CLOUD.url}/rest/v1/kairo_vault?user_id=eq.${session.userId}&select=envelope,updated_at`, {
    headers: headers(session.accessToken),
  });
  if (!response.ok) await failure(response, 'Download failed');
  const rows = await response.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row?.envelope) return null;
  try {
    return { text: await decryptVault(row.envelope as VaultEnvelope, passphrase), updatedAt: String(row.updated_at ?? '') };
  } catch {
    throw new Error('Wrong passphrase, or the saved copy is damaged.');
  }
};

export const deleteCloudData = async (fetchImpl: Fetch = fetch): Promise<void> => {
  const session = await requireSession(fetchImpl);
  for (const table of ['kairo_vault', 'kairo_state']) {
    const response = await fetchImpl(`${CLOUD.url}/rest/v1/${table}?user_id=eq.${session.userId}`, { method: 'DELETE', headers: headers(session.accessToken) });
    if (!response.ok) await failure(response, 'Delete failed');
  }
};

/* Connected mode: a readable copy for AI connectors. Opt-in; the encrypted vault is separate. */
const SHARE_KEY = 'kairo_ai_share';
const readStored = (key: string): unknown => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? 'null');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'data' in parsed ? parsed.data : parsed;
  } catch { return null; }
};

export const aiShareEnabled = (): boolean => { try { return localStorage.getItem(SHARE_KEY) === '1'; } catch { return false; } };

export const pushAiState = async (fetchImpl: Fetch = fetch): Promise<void> => {
  const session = await requireSession(fetchImpl);
  const response = await fetchImpl(`${CLOUD.url}/rest/v1/kairo_state?on_conflict=user_id`, {
    method: 'POST',
    headers: { ...headers(session.accessToken), Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      user_id: session.userId,
      projects: normalizeProjects(readStored('kairo_projects')),
      sessions: normalizeSessions(readStored('kairo_sessions')).slice(0, 2000),
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) await failure(response, 'Sharing failed');
};

export const setAiShare = async (on: boolean, fetchImpl: Fetch = fetch): Promise<void> => {
  if (on) {
    await pushAiState(fetchImpl);
  } else {
    const session = await requireSession(fetchImpl);
    const response = await fetchImpl(`${CLOUD.url}/rest/v1/kairo_state?user_id=eq.${session.userId}`, { method: 'DELETE', headers: headers(session.accessToken) });
    if (!response.ok) await failure(response, 'Could not stop sharing');
  }
  try { localStorage.setItem(SHARE_KEY, on ? '1' : '0'); } catch { /* storage unavailable */ }
};

/** Pulls projects an AI assistant added or changed. Returns the count, or null if nothing is shared yet. */
export const pullAiState = async (fetchImpl: Fetch = fetch): Promise<number | null> => {
  const session = await requireSession(fetchImpl);
  const response = await fetchImpl(`${CLOUD.url}/rest/v1/kairo_state?user_id=eq.${session.userId}&select=projects`, { headers: headers(session.accessToken) });
  if (!response.ok) await failure(response, 'Could not load AI changes');
  const rows = await response.json();
  if (!Array.isArray(rows) || !rows[0]) return null;
  const projects = normalizeProjects(rows[0].projects);
  localStorage.setItem('kairo_projects', JSON.stringify({ version: 2, data: projects }));
  return projects.length;
};

/** Deletes the Kairo Cloud account, its email and every stored row. Local data in this browser stays. */
export const deleteAccount = async (fetchImpl: Fetch = fetch): Promise<void> => {
  const session = await requireSession(fetchImpl);
  const response = await fetchImpl('https://kairo-mcp.makekairo.workers.dev/account/delete', {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.accessToken}` },
  });
  if (!response.ok) throw new Error(`Could not delete the account (HTTP ${response.status}).`);
  storeSession(null);
  try { localStorage.removeItem(SHARE_KEY); } catch { /* storage unavailable */ }
};
