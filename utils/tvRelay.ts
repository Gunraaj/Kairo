import { CLOUD } from './kairoCloud';

/**
 * A tiny Supabase Realtime "broadcast" client: laptop and TV share messages in a room named
 * by an unguessable random id. Nothing is stored; messages only pass through.
 * Speaks the Phoenix v1 JSON protocol directly, so no extra library is needed.
 */

export const ROOM_PATTERN = /^[A-Za-z0-9_-]{22,64}$/;

export const randomRoom = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

export type Relay = { send: (event: string, payload: unknown) => void; close: () => void };

export const openRelay = (room: string, onMessage: (event: string, payload: unknown) => void, onJoined?: () => void): Relay => {
  if (!ROOM_PATTERN.test(room) || typeof WebSocket === 'undefined') return { send: () => undefined, close: () => undefined };
  const topic = `realtime:kairo-tv-${room}`;
  const url = `${CLOUD.url.replace(/^https:/, 'wss:')}/realtime/v1/websocket?apikey=${encodeURIComponent(CLOUD.anonKey)}&vsn=1.0.0`;
  let ws: WebSocket | null = null;
  let ref = 0;
  let joined = false;
  let closed = false;
  let retry = 0;
  let heartbeat: number | undefined;

  const raw = (message: object) => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };

  const connect = () => {
    ws = new WebSocket(url);
    ws.onopen = () => {
      retry = 0;
      raw({ topic, event: 'phx_join', payload: { config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: false } }, ref: String(++ref), join_ref: '1' });
      heartbeat = window.setInterval(() => raw({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: String(++ref) }), 25000);
    };
    ws.onmessage = event => {
      let data: { topic?: string; event?: string; payload?: { status?: string; event?: string; payload?: unknown } };
      try { data = JSON.parse(String(event.data)); } catch { return; }
      if (data.topic !== topic) return;
      if (data.event === 'phx_reply' && data.payload?.status === 'ok' && !joined) { joined = true; onJoined?.(); return; }
      if (data.event === 'broadcast' && typeof data.payload?.event === 'string') onMessage(data.payload.event, data.payload.payload);
    };
    ws.onclose = () => {
      window.clearInterval(heartbeat);
      joined = false;
      if (!closed) window.setTimeout(connect, Math.min(30000, 1000 * 2 ** retry++));
    };
  };
  connect();

  return {
    send: (event, payload) => { if (joined) raw({ topic, event: 'broadcast', payload: { type: 'broadcast', event, payload }, ref: String(++ref), join_ref: '1' }); },
    close: () => { closed = true; window.clearInterval(heartbeat); ws?.close(); },
  };
};
