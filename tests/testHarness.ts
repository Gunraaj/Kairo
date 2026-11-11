/**
 * testHarness.ts
 *
 * Reusable, zero-dependency test harnesses for Kairo E2E test suites (Tiers 1-4).
 * Provides isolated browser API mocks (DOM events, Web Audio, Storage, Network, and WCAG math)
 * for Node.js test execution under `tsx --test`.
 */

import assert from 'node:assert/strict';

// ============================================================================
// 1. DOM Events & Window Keyboard Listener Mock
// ============================================================================

export interface MockKeyboardEventInit {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  tagName?: string;
  isContentEditable?: boolean;
}

export interface MockKeyboardEvent {
  type: string;
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  target: {
    tagName: string;
    isContentEditable: boolean;
  };
  preventDefault: () => void;
  readonly defaultPrevented: boolean;
}

export class MockWindowTarget {
  private listeners: Map<string, Set<(event: any) => void>> = new Map();

  addEventListener(type: string, handler: (event: any) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler);
  }

  removeEventListener(type: string, handler: (event: any) => void): void {
    this.listeners.get(type)?.delete(handler);
  }

  dispatchEvent(event: { type: string; [key: string]: any }): boolean {
    const handlers = this.listeners.get(event.type);
    if (handlers) {
      for (const handler of Array.from(handlers)) {
        handler(event);
      }
    }
    return true;
  }

  listenerCount(type: string): number {
    return this.listeners.get(type)?.size ?? 0;
  }

  clear(): void {
    this.listeners.clear();
  }
}

export function createMockKeyEvent(type: string, init: MockKeyboardEventInit): MockKeyboardEvent {
  let defaultPrevented = false;
  return {
    type,
    key: init.key,
    metaKey: Boolean(init.metaKey),
    ctrlKey: Boolean(init.ctrlKey),
    altKey: Boolean(init.altKey),
    shiftKey: Boolean(init.shiftKey),
    target: {
      tagName: (init.tagName || 'DIV').toUpperCase(),
      isContentEditable: Boolean(init.isContentEditable),
    },
    preventDefault: () => {
      defaultPrevented = true;
    },
    get defaultPrevented() {
      return defaultPrevented;
    },
  };
}

// ============================================================================
// 2. Web Audio API Mock Harness
// ============================================================================

export class MockAudioParam {
  value: number;
  constructor(initial = 0) {
    this.value = initial;
  }
  setValueAtTime(val: number, _time: number): void {
    this.value = val;
  }
  exponentialRampToValueAtTime(val: number, _time: number): void {
    this.value = val;
  }
  linearRampToValueAtTime(val: number, _time: number): void {
    this.value = val;
  }
}

export class MockAudioNode {
  connect<T>(dest: T): T {
    return dest;
  }
  disconnect(): void {}
}

export class MockGainNode extends MockAudioNode {
  gain: MockAudioParam;
  constructor(initialGain = 1) {
    super();
    this.gain = new MockAudioParam(initialGain);
  }
}

export class MockOscillatorNode extends MockAudioNode {
  frequency: MockAudioParam = new MockAudioParam(440);
  type: string = 'sine';
  started: boolean = false;
  stopped: boolean = false;

  start(_time?: number): void {
    this.started = true;
  }
  stop(_time?: number): void {
    this.stopped = true;
  }
}

export class MockBiquadFilterNode extends MockAudioNode {
  frequency: MockAudioParam = new MockAudioParam(350);
  Q: MockAudioParam = new MockAudioParam(1);
  type: string = 'lowpass';
}

export class MockAudioContext {
  currentTime: number = 0;
  destination: MockGainNode = new MockGainNode();
  state: 'running' | 'suspended' | 'closed' = 'running';

  createGain(): MockGainNode {
    return new MockGainNode();
  }
  createOscillator(): MockOscillatorNode {
    return new MockOscillatorNode();
  }
  createBiquadFilter(): MockBiquadFilterNode {
    return new MockBiquadFilterNode();
  }
  createBufferSource(): {
    buffer: any;
    loop: boolean;
    connect: (d: any) => any;
    start: () => void;
    stop: () => void;
  } {
    return {
      buffer: null,
      loop: false,
      connect: (dest: any) => dest,
      start: () => {},
      stop: () => {},
    };
  }
  createBuffer(_channels: number, length: number, _sampleRate: number): {
    length: number;
    getChannelData: (_channel: number) => Float32Array;
  } {
    return {
      length,
      getChannelData: () => new Float32Array(length),
    };
  }
  close(): Promise<void> {
    this.state = 'closed';
    return Promise.resolve();
  }
}

// ============================================================================
// 3. Audio URL Revocation Tracking Harness
// ============================================================================

export interface UrlRevocationTracker {
  created: string[];
  revoked: string[];
  install: () => void;
  restore: () => void;
}

export function createUrlRevocationTracker(): UrlRevocationTracker {
  const created: string[] = [];
  const revoked: string[] = [];
  const origCreate = typeof URL !== 'undefined' ? URL.createObjectURL : undefined;
  const origRevoke = typeof URL !== 'undefined' ? URL.revokeObjectURL : undefined;

  return {
    created,
    revoked,
    install: () => {
      let counter = 0;
      URL.createObjectURL = (_blob: any) => {
        counter += 1;
        const id = `blob:kairo-test-${counter}-${Math.random().toString(36).slice(2, 8)}`;
        created.push(id);
        return id;
      };
      URL.revokeObjectURL = (url: string) => {
        revoked.push(url);
      };
    },
    restore: () => {
      if (origCreate) URL.createObjectURL = origCreate;
      if (origRevoke) URL.revokeObjectURL = origRevoke;
    },
  };
}

// ============================================================================
// 4. LocalStorage Mock Harness
// ============================================================================

export class MockLocalStorage implements Storage {
  private map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  setItem(key: string, value: any): void {
    this.map.set(key, String(value));
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
  clear(): void {
    this.map.clear();
  }
  get length(): number {
    return this.map.size;
  }
  key(index: number): string | null {
    return Array.from(this.map.keys())[index] ?? null;
  }
}

/**
 * Executes a callback with an isolated mock window and localStorage environment,
 * restoring original global values upon completion or error.
 */
export async function withMockStorage<T>(
  callback: (storage: MockLocalStorage) => Promise<T> | T,
): Promise<T> {
  const originalWindow = (globalThis as any).window;
  const originalLocalStorage = (globalThis as any).localStorage;
  const storage = new MockLocalStorage();

  try {
    (globalThis as any).window = { localStorage: storage };
    (globalThis as any).localStorage = storage;
    return await callback(storage);
  } finally {
    (globalThis as any).window = originalWindow;
    (globalThis as any).localStorage = originalLocalStorage;
  }
}

// ============================================================================
// 5. Network Interception & Zero-Network Harness
// ============================================================================

export interface CapturedNetworkRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: any;
}

export interface MockNetworkResult {
  requests: CapturedNetworkRequest[];
  restore: () => void;
}

export type NetworkResponseHandler = (
  req: CapturedNetworkRequest,
) =>
  | Response
  | Promise<Response>
  | { status: number; body?: any; headers?: Record<string, string> }
  | Promise<{ status: number; body?: any; headers?: Record<string, string> }>;

/**
 * Intercepts `globalThis.fetch` to capture all outbound HTTP requests and return mock responses.
 */
export function mockNetwork(handler: NetworkResponseHandler): MockNetworkResult {
  const originalFetch = globalThis.fetch;
  const requests: CapturedNetworkRequest[] = [];

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method?.toUpperCase() || 'GET';
    const rawHeaders: Record<string, string> = {};

    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => {
          rawHeaders[k.toLowerCase()] = v;
        });
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) {
          rawHeaders[k.toLowerCase()] = v;
        }
      } else {
        for (const [k, v] of Object.entries(init.headers)) {
          rawHeaders[k.toLowerCase()] = String(v);
        }
      }
    }

    let parsedBody: any = undefined;
    if (init?.body) {
      if (typeof init.body === 'string') {
        try {
          parsedBody = JSON.parse(init.body);
        } catch {
          parsedBody = init.body;
        }
      } else {
        parsedBody = init.body;
      }
    }

    const captured: CapturedNetworkRequest = {
      url,
      method,
      headers: rawHeaders,
      body: parsedBody,
    };
    requests.push(captured);

    const handled = await handler(captured);
    if (handled instanceof Response) {
      return handled;
    }

    const status = handled.status || 200;
    const resHeaders = new Headers(handled.headers || { 'content-type': 'application/json' });
    const responseText = typeof handled.body === 'string' ? handled.body : JSON.stringify(handled.body ?? {});

    return new Response(responseText, {
      status,
      headers: resHeaders,
    });
  }) as typeof globalThis.fetch;

  return {
    requests,
    restore: () => {
      globalThis.fetch = originalFetch;
    },
  };
}

/**
 * Wraps an execution block and asserts that ZERO network requests are made.
 * If any network access is attempted, immediately throws a `ZERO_NETWORK_VIOLATION` error.
 */
export async function assertZeroNetworkAccess<T>(fn: () => Promise<T> | T): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    throw new Error(`ZERO_NETWORK_VIOLATION: Unexpected network access attempted to "${url}"`);
  }) as typeof globalThis.fetch;

  try {
    return await fn();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

// ============================================================================
// 6. WCAG 2.1 Contrast & Relative Luminance Mathematics
// ============================================================================

export function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  if (clean.length === 6) {
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return [r, g, b];
  }
  throw new Error(`Invalid hex color string: "${hex}"`);
}

export function sRGBtoLin(colorChannel: number): number {
  const c = colorChannel / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function getRelativeLuminance(hex: string): number {
  const [r, g, b] = parseHex(hex);
  const rLin = sRGBtoLin(r);
  const gLin = sRGBtoLin(g);
  const bLin = sRGBtoLin(b);
  return 0.2126 * rLin + 0.7152 * gLin + 0.0722 * bLin;
}

export function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  const ratio = (lighter + 0.05) / (darker + 0.05);
  return Number(ratio.toFixed(2));
}
