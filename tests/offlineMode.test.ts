import test from 'node:test';
import assert from 'node:assert/strict';
import { isLocalAddress } from '../utils/offlineMode';

const base = 'https://kairo.makekairo.workers.dev/';

test('offline mode allows this site, this computer and private networks', () => {
  for (const url of ['/assets/x.js', 'https://kairo.makekairo.workers.dev/tv', 'http://localhost:11434/api/tags', 'http://127.0.0.1:11434', 'http://[::1]:8080', 'http://192.168.1.20:11434', 'http://10.0.0.5', 'http://172.20.1.1', 'http://100.88.146.13:11434', 'http://helios.local:11434', 'blob:https://kairo.makekairo.workers.dev/abc', 'data:text/plain,hi']) {
    assert.equal(isLocalAddress(url, base), true, url);
  }
});

test('offline mode blocks the internet', () => {
  for (const url of ['https://api.openai.com/v1/chat', 'https://xxfsmnxppdqwnakjijlk.supabase.co/rest/v1', 'wss://xxfsmnxppdqwnakjijlk.supabase.co/realtime/v1/websocket', 'https://raw.githubusercontent.com/x.mp3', 'http://8.8.8.8', 'http://172.32.0.1', 'http://100.128.0.1', 'https://localhost.evil.com', 'http://']) {
    assert.equal(isLocalAddress(url, base), false, url);
  }
});
