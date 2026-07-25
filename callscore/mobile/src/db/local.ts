/**
 * On-device store — AsyncStorage-based fallback (replaces SQLite while
 * expo-sqlite has ESM compat issues on Node 20). Same API surface so
 * the rest of the app is unaffected.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalSession } from '../types';

const SESSIONS_KEY = '@callscore_sessions';

async function readAll(): Promise<Record<string, LocalSession>> {
  const raw = await AsyncStorage.getItem(SESSIONS_KEY);
  return raw ? JSON.parse(raw) : {};
}

async function writeAll(map: Record<string, LocalSession>): Promise<void> {
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(map));
}

export async function saveSession(s: LocalSession): Promise<void> {
  const map = await readAll();
  map[s.id] = s;
  await writeAll(map);
}

export async function getSession(id: string): Promise<LocalSession | null> {
  const map = await readAll();
  return map[id] ?? null;
}

export async function listSessions(): Promise<LocalSession[]> {
  const map = await readAll();
  return Object.values(map).sort(
    (a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''),
  );
}

export async function listPendingSessions(): Promise<LocalSession[]> {
  const map = await readAll();
  return Object.values(map)
    .filter((s) => s.sync_status === 'pending' || s.sync_status === 'failed')
    .sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''));
}

export async function setSyncStatus(
  id: string,
  status: LocalSession['sync_status'],
): Promise<void> {
  const map = await readAll();
  if (map[id]) {
    map[id].sync_status = status;
    await writeAll(map);
  }
}
