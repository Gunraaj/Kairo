import type { ExecutionContext, KVNamespace } from '@cloudflare/workers-types';
import { OAuthProvider, AuthorizationError, authorizationErrorRedirect, type OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { handleMcpRequest } from './server';
import { supabaseStore } from './supabaseStore';
import { renderAuthorizePage, renderMessage } from './pages';

export interface Env {
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: OAuthHelpers;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_KEY: string;
  TURNSTILE_SITEKEY: string;
  PUBLIC_ORIGIN: string;
}

type Props = { userId: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const s256 = async (value: string) => b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
const randomVerifier = () => b64url(crypto.getRandomValues(new Uint8Array(48)));

const html = (body: string, headers = new Headers(), status = 200) => {
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  if (!headers.has('Content-Security-Policy')) headers.set('Content-Security-Policy', "frame-ancestors 'none'");
  return new Response(body, { status, headers });
};

/** The MCP endpoint. The user id comes only from the verified OAuth grant, never from the request. */
const mcpHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext & { props?: Props }): Promise<Response> {
    const userId = ctx.props?.userId;
    if (!userId || !UUID.test(userId)) return new Response('Unauthorized', { status: 401 });
    return handleMcpRequest(request, {
      store: supabaseStore({ url: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_KEY }),
      authenticate: async () => userId,
    });
  },
};

const authorize = async (request: Request, env: Env): Promise<Response> => {
  const oauth = env.OAUTH_PROVIDER;
  if (request.method === 'GET') {
    let authRequest;
    try {
      authRequest = await oauth.parseAuthRequest(request);
    } catch (error) {
      if (error instanceof AuthorizationError && error.redirectTo) return Response.redirect(error.redirectTo, 302);
      return html(renderMessage('This connection request is not valid', 'Start again from Claude or ChatGPT.'), undefined, 400);
    }
    const details = await oauth.describeConsent(authRequest);
    const consent = await oauth.beginConsent(authRequest);
    return html(renderAuthorizePage(details, consent.handle, env.TURNSTILE_SITEKEY), consent.headers);
  }

  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const form = await request.formData();
  const handle = String(form.get('handle') ?? '');
  try {
    if (form.get('decision') !== 'approve') {
      const denied = await oauth.denyConsent(request, handle);
      return new Response(null, { status: 302, headers: denied.headers });
    }
    const email = String(form.get('email') ?? '').trim().toLowerCase();
    const captcha = String(form.get('cf-turnstile-response') ?? '');
    if (!EMAIL.test(email) || !captcha) return html(renderMessage('Missing details', 'Go back, enter your email and complete the check.'), undefined, 400);

    const approved = await oauth.approveConsent(request, handle, { scope: ['mcp:read', 'mcp:write'] });
    const verifier = randomVerifier();
    const { state, headers } = await oauth.beginUpstream(approved.request, { data: { verifier }, headers: approved.headers });
    const callback = `${env.PUBLIC_ORIGIN}/callback?state=${encodeURIComponent(state)}`;
    const response = await fetch(`${env.SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(callback)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
      body: JSON.stringify({
        email,
        create_user: false,
        code_challenge: await s256(verifier),
        code_challenge_method: 's256',
        gotrue_meta_security: { captcha_token: captcha },
      }),
    });
    if (!response.ok) {
      const reason = response.status === 429 ? 'Too many attempts. Wait a few minutes.' : 'Use the email you signed in with in Kairo (Settings, Kairo Cloud), then try again.';
      return html(renderMessage('Could not send the sign-in link', reason), headers, 400);
    }
    return html(renderMessage('Check your email', 'Open the sign-in link in this same browser within 10 minutes to finish connecting.'), headers);
  } catch (error) {
    if (error instanceof AuthorizationError) return html(renderMessage('This page expired', 'Start the connection again from Claude or ChatGPT.'), undefined, 400);
    throw error;
  }
};

const callback = async (request: Request, env: Env): Promise<Response> => {
  const oauth = env.OAUTH_PROVIDER;
  let resumed;
  try {
    resumed = await oauth.finishUpstream<{ verifier: string }>(request);
  } catch {
    return html(renderMessage('Link expired or opened in another browser', 'Start the connection again from Claude or ChatGPT and open the email link in the same browser.'), undefined, 400);
  }
  const { request: original, data, headers } = resumed;
  const code = new URL(request.url).searchParams.get('code');
  if (!code) {
    headers.set('Location', authorizationErrorRedirect(original, 'access_denied'));
    return new Response(null, { status: 302, headers });
  }
  const token = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=pkce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: env.SUPABASE_ANON_KEY },
    body: JSON.stringify({ auth_code: code, code_verifier: data.verifier }),
  });
  const body = token.ok ? await token.json() as { user?: { id?: string } } : null;
  const userId = body?.user?.id;
  if (!userId || !UUID.test(userId)) {
    headers.set('Location', authorizationErrorRedirect(original, 'access_denied'));
    return new Response(null, { status: 302, headers });
  }
  const { redirectTo } = await oauth.completeAuthorization({
    request: original,
    userId,
    metadata: {},
    scope: original.scope,
    props: { userId } satisfies Props,
  });
  headers.set('Location', redirectTo);
  return new Response(null, { status: 302, headers });
};

const APP_ORIGINS = new Set(['https://kairo.makekairo.workers.dev', 'https://makekairo.netlify.app', 'http://localhost:3010']);

/** Self-serve account deletion. The caller proves who they are with their own Supabase access token. */
const deleteAccount = async (request: Request, env: Env): Promise<Response> => {
  const origin = request.headers.get('Origin') ?? '';
  const cors: Record<string, string> = APP_ORIGINS.has(origin)
    ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Authorization', Vary: 'Origin' }
    : {};
  if (request.method === 'OPTIONS') return new Response(null, { status: APP_ORIGINS.has(origin) ? 204 : 403, headers: cors });
  if (request.method !== 'POST' || !APP_ORIGINS.has(origin)) return new Response('Forbidden', { status: 403, headers: cors });
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) return new Response('Unauthorized', { status: 401, headers: cors });

  const who = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, { headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` } });
  const user = who.ok ? await who.json() as { id?: string } : null;
  if (!user?.id || !UUID.test(user.id)) return new Response('Unauthorized', { status: 401, headers: cors });

  const admin = { apikey: env.SUPABASE_SERVICE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}` };
  // Rows go with the user (on delete cascade); delete them explicitly too in case that ever changes.
  for (const table of ['kairo_vault', 'kairo_state']) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/${table}?user_id=eq.${user.id}`, { method: 'DELETE', headers: admin });
  }
  const removed = await fetch(`${env.SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: admin });
  if (!removed.ok) return new Response('Could not delete the account', { status: 502, headers: cors });
  return new Response(null, { status: 204, headers: cors });
};

const defaultHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/account/delete') return deleteAccount(request, env);
    if (url.pathname === '/authorize') return authorize(request, env);
    if (url.pathname === '/callback') return callback(request, env);
    if (url.pathname === '/') return html(renderMessage('Kairo connector', 'Add this server in Claude or ChatGPT using the address ending in /mcp.'));
    return new Response('Not found', { status: 404 });
  },
};

export default new OAuthProvider<Env>({
  apiRoute: '/mcp',
  apiHandler: mcpHandler as never,
  defaultHandler: defaultHandler as never,
  authorizeEndpoint: '/authorize',
  tokenEndpoint: '/oauth/token',
  clientRegistrationEndpoint: '/oauth/register',
  clientIdMetadataDocumentEnabled: true,
  scopesSupported: ['mcp:read', 'mcp:write', 'offline_access'],
  requiredScopes: ['mcp:read'],
  accessTokenTTL: 3600,
  resourceMetadata: {
    resource: 'https://kairo-mcp.makekairo.workers.dev/mcp',
    authorization_servers: ['https://kairo-mcp.makekairo.workers.dev'],
  },
});
