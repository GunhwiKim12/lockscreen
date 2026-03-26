/**
 * Persists completed FlipSession records locally.
 * Backed by localStore (AsyncStorage wrapper).
 */

import { FlipSession } from '../../core/types';
import { loadJSON, saveJSON } from '../../storage/localStore';

const KEY = 'flip_sessions';
const MAX_HISTORY = 50;

export async function saveSessions(sessions: FlipSession[]): Promise<void> {
  await saveJSON(KEY, sessions);
}

export async function loadSessions(): Promise<FlipSession[]> {
  const data = await loadJSON<FlipSession[]>(KEY);
  return data ?? [];
}

export async function appendSession(session: FlipSession): Promise<FlipSession[]> {
  const existing = await loadSessions();
  const updated = [session, ...existing].slice(0, MAX_HISTORY);
  await saveSessions(updated);
  return updated;
}

export async function clearSessions(): Promise<void> {
  await saveSessions([]);
}
