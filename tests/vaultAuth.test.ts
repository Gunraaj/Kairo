import assert from 'node:assert/strict';
import test from 'node:test';
import { decryptVault, encryptVault, VaultError } from '../utils/vaultCrypto.ts';
import { buildAuthorizeUrl, challengeFor, createPkcePair, exchangeCode, needsRefresh, refreshSession } from '../utils/supabaseAuth.ts';

test('vault round-trips unicode, uses fresh salt and IV, and hides the plaintext', async () => {
  const secret = JSON.stringify({ projects: [{ name: 'भौतिकी ☕ secret-plan' }] });
  const a = await encryptVault(secret, 'correct horse battery', 2000);
  const b = await encryptVault(secret, 'correct horse battery', 2000);
  assert.notEqual(a.salt, b.salt);
  assert.notEqual(a.iv, b.iv);
  assert.notEqual(a.ciphertext, b.ciphertext);
  assert.ok(!JSON.stringify(a).includes('secret-plan'));
  assert.equal(await decryptVault(a, 'correct horse battery'), secret);
});

test('wrong passphrase, tampering and bad envelopes are rejected with a readable error', async () => {
  const env = await encryptVault('hello', 'right-passphrase', 2000);
  await assert.rejects(decryptVault(env, 'wrong-passphrase'), VaultError);
  const flipped = { ...env, ciphertext: env.ciphertext.slice(0, -4) + (env.ciphertext.endsWith('AAAA') ? 'BBBB' : 'AAAA') };
  await assert.rejects(decryptVault(flipped, 'right-passphrase'), /Wrong passphrase/);
  await assert.rejects(decryptVault({ ...env, iter: 5 }, 'right-passphrase'), /Unsupported/);
  await assert.rejects(decryptVault({ ...env, v: 2 } as never, 'right-passphrase'), /Unsupported/);
  await assert.rejects(encryptVault('x', 'short', 2000), /at least 8/);
});

test('PKCE challenge matches the RFC 7636 test vector and pairs are unique', async () => {
  assert.equal(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  const [p1, p2] = [await createPkcePair(), await createPkcePair()];
  assert.notEqual(p1.verifier, p2.verifier);
  assert.match(p1.verifier, /^[A-Za-z0-9_-]{43,128}$/);
  assert.equal(await challengeFor(p1.verifier), p1.challenge);
});

test('authorize URL carries provider, redirect and the S256 challenge', () => {
  const url = new URL(buildAuthorizeUrl({ url: 'https://abc.supabase.co/', redirectTo: 'https://app.example/', challenge: 'CHAL' }));
  assert.equal(url.origin + url.pathname, 'https://abc.supabase.co/auth/v1/authorize');
  assert.equal(url.searchParams.get('provider'), 'google');
  assert.equal(url.searchParams.get('code_challenge'), 'CHAL');
  assert.equal(url.searchParams.get('code_challenge_method'), 's256');
  assert.equal(url.searchParams.get('redirect_to'), 'https://app.example/');
});

test('code exchange and refresh build a validated session and fail safely', async () => {
  const sent: Array<{ url: string; body: any }> = [];
  const ok = (async (url: string, init?: RequestInit) => {
    sent.push({ url, body: JSON.parse(String(init?.body)) });
    return new Response(JSON.stringify({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, user: { id: '123e4567-e89b-42d3-a456-426614174000' } }));
  }) as unknown as typeof fetch;
  const session = await exchangeCode({ url: 'https://abc.supabase.co', anonKey: 'anon', code: 'CODE', verifier: 'VER', fetchImpl: ok, now: 1000 });
  assert.deepEqual(session, { accessToken: 'at', refreshToken: 'rt', userId: '123e4567-e89b-42d3-a456-426614174000', expiresAt: 3_601_000 });
  assert.match(sent[0]!.url, /grant_type=pkce$/);
  assert.deepEqual(sent[0]!.body, { auth_code: 'CODE', code_verifier: 'VER' });
  await refreshSession({ url: 'https://abc.supabase.co', anonKey: 'anon', refreshToken: 'rt', fetchImpl: ok });
  assert.match(sent[1]!.url, /grant_type=refresh_token$/);
  assert.equal(needsRefresh(session, 3_000_000), false);
  assert.equal(needsRefresh(session, 3_550_000), true);

  const bad = (async () => new Response('{}', { status: 400 })) as typeof fetch;
  await assert.rejects(exchangeCode({ url: 'https://x', anonKey: 'k', code: 'c', verifier: 'v', fetchImpl: bad }), /HTTP 400/);
  const odd = (async () => new Response(JSON.stringify({ access_token: 'a', refresh_token: 'r', user: { id: 'not-a-uuid' } }))) as typeof fetch;
  await assert.rejects(exchangeCode({ url: 'https://x', anonKey: 'k', code: 'c', verifier: 'v', fetchImpl: odd }), /unexpected/);
});
