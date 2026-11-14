import { normalizeProjects, normalizeSessions } from '../../data/validation';
import type { Project } from '../../types';
import type { KairoState, KairoStore } from './server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * KairoStore backed by the `kairo_state` table (Connected mode). Uses the service-role key,
 * which must only ever live in the Worker's secrets. Every query is scoped to one user id
 * that comes from the verified token, never from tool input.
 */
export const supabaseStore = (config: { url: string; serviceKey: string; fetchImpl?: typeof fetch }): KairoStore => {
  const base = `${config.url.replace(/\/+$/, '')}/rest/v1/kairo_state`;
  const headers = { apikey: config.serviceKey, Authorization: `Bearer ${config.serviceKey}`, 'Content-Type': 'application/json' };
  const doFetch = config.fetchImpl ?? fetch;
  const checked = (userId: string) => {
    if (!UUID.test(userId)) throw new Error('Invalid user id.');
    return userId;
  };

  return {
    async load(userId): Promise<KairoState> {
      const response = await doFetch(`${base}?user_id=eq.${checked(userId)}&select=projects,sessions`, { headers });
      if (!response.ok) throw new Error(`Storage read failed (HTTP ${response.status}).`);
      const rows = await response.json();
      const row = Array.isArray(rows) ? rows[0] : null;
      return { projects: normalizeProjects(row?.projects), sessions: normalizeSessions(row?.sessions) };
    },
    async saveProjects(userId, projects: Project[]) {
      const response = await doFetch(`${base}?on_conflict=user_id`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ user_id: checked(userId), projects, updated_at: new Date().toISOString() }),
      });
      if (!response.ok) throw new Error(`Storage write failed (HTTP ${response.status}).`);
    },
  };
};
