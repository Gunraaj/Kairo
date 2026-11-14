/** Google sign-in through Supabase Auth using OAuth 2.0 PKCE (RFC 7636). No client secret is involved. */

export type AuthSession = { accessToken: string; refreshToken: string; expiresAt: number; userId: string };

const base64Url = (bytes: Uint8Array): string => {
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export const challengeFor = async (verifier: string): Promise<string> =>
  base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));

export const createPkcePair = async (): Promise<{ verifier: string; challenge: string }> => {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(48)));
  return { verifier, challenge: await challengeFor(verifier) };
};

export const buildAuthorizeUrl = (input: { url: string; provider?: string; redirectTo: string; challenge: string }): string => {
  const params = new URLSearchParams({
    provider: input.provider ?? 'google',
    redirect_to: input.redirectTo,
    code_challenge: input.challenge,
    code_challenge_method: 's256',
  });
  return `${input.url.replace(/\/+$/, '')}/auth/v1/authorize?${params}`;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const toSession = (body: any, now: number): AuthSession => {
  const accessToken = typeof body?.access_token === 'string' ? body.access_token : '';
  const refreshToken = typeof body?.refresh_token === 'string' ? body.refresh_token : '';
  const userId = typeof body?.user?.id === 'string' ? body.user.id : '';
  if (!accessToken || !refreshToken || !UUID.test(userId)) throw new Error('Sign-in returned an unexpected response.');
  const lifetime = Number.isFinite(body.expires_in) ? Number(body.expires_in) : 3600;
  return { accessToken, refreshToken, userId, expiresAt: now + lifetime * 1000 };
};

const tokenRequest = async (url: string, anonKey: string, grant: string, payload: Record<string, string>, fetchImpl: typeof fetch, now: number): Promise<AuthSession> => {
  const response = await fetchImpl(`${url.replace(/\/+$/, '')}/auth/v1/token?grant_type=${grant}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: anonKey },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Sign-in failed (HTTP ${response.status}).`);
  return toSession(await response.json(), now);
};

export const exchangeCode = (input: { url: string; anonKey: string; code: string; verifier: string; fetchImpl?: typeof fetch; now?: number }) =>
  tokenRequest(input.url, input.anonKey, 'pkce', { auth_code: input.code, code_verifier: input.verifier }, input.fetchImpl ?? fetch, input.now ?? Date.now());

export const refreshSession = (input: { url: string; anonKey: string; refreshToken: string; fetchImpl?: typeof fetch; now?: number }) =>
  tokenRequest(input.url, input.anonKey, 'refresh_token', { refresh_token: input.refreshToken }, input.fetchImpl ?? fetch, input.now ?? Date.now());

/** True when the access token expires within the next minute. */
export const needsRefresh = (session: AuthSession, now = Date.now()): boolean => session.expiresAt - now < 60_000;
