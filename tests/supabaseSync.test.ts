import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decodeSyncToken,
  encodeSyncToken,
  getSupabaseConfig,
  saveSupabaseConfig,
  testSupabaseConnection,
} from '../utils/supabaseSync.ts';

test('getSupabaseConfig and saveSupabaseConfig persist settings safely', () => {
  const values = new Map<string, string>();
  const mockStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
  // Save in global window.localStorage if available or mock
  const original = (globalThis as unknown as { localStorage: unknown }).localStorage;
  (globalThis as unknown as { localStorage: unknown }).localStorage = mockStorage;

  try {
    const initial = getSupabaseConfig();
    assert.equal(initial.url, '');
    assert.equal(initial.anonKey, '');
    assert.equal(initial.autoSync, false);

    saveSupabaseConfig({
      url: '  https://xyz.supabase.co/  ',
      anonKey: '  sample-anon-key-123  ',
      autoSync: true,
    });

    const saved = getSupabaseConfig();
    assert.equal(saved.url, 'https://xyz.supabase.co');
    assert.equal(saved.anonKey, 'sample-anon-key-123');
    assert.equal(saved.autoSync, true);
  } finally {
    (globalThis as unknown as { localStorage: unknown }).localStorage = original;
  }
});

test('testSupabaseConnection rejects missing credentials gracefully', async () => {
  const r1 = await testSupabaseConnection('', 'key');
  assert.equal(r1.ok, false);
  assert.match(r1.message, /Project URL/);

  const r2 = await testSupabaseConnection('https://xyz.supabase.co', '');
  assert.equal(r2.ok, false);
  assert.match(r2.message, /Anon API Key/);
});

test('encodeSyncToken and decodeSyncToken work symmetrically', () => {
  const url = 'https://abcdefghijkl.supabase.co';
  const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-anon-key';

  const token = encodeSyncToken(url, key);
  assert.match(token, /^kairo_/);

  const decoded = decodeSyncToken(token);
  assert.ok(decoded);
  assert.equal(decoded.url, url);
  assert.equal(decoded.anonKey, key);

  // Rejects invalid tokens
  assert.equal(decodeSyncToken('invalid_garbage_token'), null);
  assert.equal(decodeSyncToken(''), null);
});

test('testSupabaseConnection sanitizes CRLF in anonKey and requires valid URL', async () => {
  // Test rejecting whitespace-only or invalid URLs
  const r1 = await testSupabaseConnection('not a url', 'key');
  assert.equal(r1.ok, false);

  // Test that CRLF anonKey is rejected when empty after stripping
  const r2 = await testSupabaseConnection('https://xyz.supabase.co', '\r\n\t  \n');
  assert.equal(r2.ok, false);
  assert.match(r2.message, /Anon API Key/);
});

test('decodeSyncToken rejects non-Supabase hosts', () => {
  const evil = encodeSyncToken('https://evil.example.com', 'key');
  assert.equal(decodeSyncToken(evil), null);
  const lookalike = encodeSyncToken('https://abc.supabase.co.evil.com', 'key');
  assert.equal(decodeSyncToken(lookalike), null);
});

test('backup and restore require a signed-in session', async () => {
  const { backupToSupabase, restoreFromSupabase } = await import('../utils/supabaseSync.ts');
  const b = await backupToSupabase('https://xyz.supabase.co', 'key', {}, null);
  assert.equal(b.ok, false);
  assert.match(b.message, /Sign in/);
  const r = await restoreFromSupabase('https://xyz.supabase.co', 'key', null);
  assert.equal(r.ok, false);
  assert.match(r.message, /Sign in/);
});
