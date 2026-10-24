import assert from 'node:assert/strict';
import test from 'node:test';
import { getCachedAudioUrl, prefetchAudioUrls } from '../utils/audioCache.ts';

test('getCachedAudioUrl falls back gracefully when caches API is unavailable', async () => {
  const dummyUrl = 'https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/rain/heavy-rain.mp3';
  const resolved = await getCachedAudioUrl(dummyUrl);
  assert.equal(resolved, dummyUrl);
});

test('getCachedAudioUrl utilizes CacheStorage when available', async () => {
  const dummyUrl = 'https://raw.githubusercontent.com/remvze/moodist/main/public/sounds/rain/heavy-rain.mp3';
  const mockBlob = new Blob(['mock audio data'], { type: 'audio/mpeg' });
  const mockResponse = new Response(mockBlob);

  const mockCache = {
    match: async (url: string) => (url === dummyUrl ? mockResponse : undefined),
    put: async () => {},
  };

  const originalWindow = (globalThis as any).window;
  const originalCaches = (globalThis as any).caches;
  const originalCreateObjectURL = URL.createObjectURL;

  try {
    (globalThis as any).window = { caches: {} };
    (globalThis as any).caches = {
      open: async () => mockCache,
    };
    URL.createObjectURL = () => 'blob:mock-audio-url';

    const result = await getCachedAudioUrl(dummyUrl);
    assert.equal(result, 'blob:mock-audio-url');
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).caches = originalCaches;
    URL.createObjectURL = originalCreateObjectURL;
  }
});
