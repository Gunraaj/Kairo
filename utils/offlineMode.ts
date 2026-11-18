/**
 * Offline mode: Kairo makes no internet connections. The timer, plans, history, cached sounds,
 * generated focus tones and a local AI model (Ollama on this computer or your own network) keep
 * working; cloud AI, Kairo Cloud, casting, online sounds and music are paused.
 * Enforced in one place by guarding fetch and WebSocket, so no feature can forget the check.
 */

export const OFFLINE_MESSAGE = 'Offline mode is on, so Kairo is not connecting to the internet. Turn it off in Settings to use this.';

export class OfflineError extends Error {
  constructor() { super(OFFLINE_MESSAGE); this.name = 'OfflineError'; }
}

const SETTINGS_KEY = 'kairo_settings';

export const isOfflineMode = (): boolean => {
  try {
    const parsed = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? 'null');
    const data = parsed && typeof parsed === 'object' && 'data' in parsed ? parsed.data : parsed;
    return Boolean(data && data.offlineMode === true);
  } catch {
    return false;
  }
};

/** This site, this computer, or a private network address (home Wi-Fi, Tailscale). */
export const isLocalAddress = (raw: string, base = typeof location !== 'undefined' ? location.href : 'http://localhost/'): boolean => {
  let url: URL;
  try { url = new URL(raw, base); } catch { return false; }
  if (url.protocol === 'blob:' || url.protocol === 'data:') return true;
  if (url.origin === new URL(base).origin) return true;
  const host = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host === '::1') return true;
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
};

const requestUrl = (input: RequestInfo | URL): string =>
  typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

let installed = false;

/** Installs the guard once at startup. Checks the setting on every request, so toggling takes effect at once. */
export const installOfflineGuard = () => {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
    isOfflineMode() && !isLocalAddress(requestUrl(input)) ? Promise.reject(new OfflineError()) : originalFetch(input, init);

  const OriginalSocket = window.WebSocket;
  if (OriginalSocket) {
    const Guarded = function (this: WebSocket, url: string | URL, protocols?: string | string[]) {
      if (isOfflineMode() && !isLocalAddress(String(url))) throw new OfflineError();
      return new OriginalSocket(url, protocols);
    } as unknown as typeof WebSocket;
    Guarded.prototype = OriginalSocket.prototype;
    Object.assign(Guarded, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });
    window.WebSocket = Guarded;
  }
};
