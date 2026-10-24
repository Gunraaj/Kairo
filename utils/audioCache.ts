/**
 * audioCache.ts
 * Offline audio caching using the browser CacheStorage API.
 * Ensures ambient audio assets downloaded from raw.githubusercontent.com
 * are stored locally for instant subsequent playback and offline capability.
 */

const CACHE_NAME = 'kairo-audio-cache-v1';

export const getCachedAudioUrl = async (url: string): Promise<string> => {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return url;
  }

  try {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(url);

    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      return URL.createObjectURL(blob);
    }

    // Warm cache in the background without blocking initial playback
    fetch(url, { mode: 'cors' })
      .then(async networkResponse => {
        if (networkResponse.ok) {
          await cache.put(url, networkResponse);
        }
      })
      .catch(() => undefined);
  } catch {
    // If offline or fetch fails, fall back to direct URL
  }

  return url;
};

export const prefetchAudioUrls = async (urls: string[]): Promise<void> => {
  if (typeof window === 'undefined' || !('caches' in window)) return;
  try {
    const cache = await caches.open(CACHE_NAME);
    for (const url of urls) {
      const match = await cache.match(url);
      if (!match) {
        fetch(url, { mode: 'cors' })
          .then(res => {
            if (res.ok) cache.put(url, res);
          })
          .catch(() => undefined);
      }
    }
  } catch {
    // Ignored
  }
};
