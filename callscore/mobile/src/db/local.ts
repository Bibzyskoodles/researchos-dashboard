/**
 * On-device SQLite store — the system of record while offline (Bible 5.3:
 * sessions are written locally first and mirrored to the backend only once
 * uploaded). Nothing in the interview flow may depend on this device being
 * online (Design Principle 5).
 */
import * as SQLite from 'expo-sqlite';
import { LocalSession } from '../types';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('callscore.db').then(async (db) => {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          org_id TEXT NOT NULL,
          project_id TEXT NOT NULL,
          respondent_id TEXT NOT NULL,
          respondent_name TEXT,
          enumerator_id TEXT NOT NULL,
          started_at TEXT,
          stopped_at TEXT,
          consent_uri TEXT,
          audio_uri TEXT,
          screenshot_fields TEXT,
          answers TEXT NOT NULL DEFAULT '{}',
          sync_status TEXT NOT NULL DEFAULT 'local',
          created_at TEXT NOT NULL
        );
      `);
      return db;
    });
  }
  return dbPromise;
}

function rowToSession(r: any): LocalSession {
  return {
    ...r,
    screenshot_fields: r.screenshot_fields ? JSON.parse(r.screenshot_fields) : null,
    answers: JSON.parse(r.answers || '{}'),
  };
}

export async function saveSession(s: LocalSession): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT OR REPLACE INTO sessions
     (id, org_id, project_id, respondent_id, respondent_name, enumerator_id,
      started_at, stopped_at, consent_uri, audio_uri, screenshot_fields,
      answers, sync_status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    s.id, s.org_id, s.project_id, s.respondent_id, s.respondent_name,
    s.enumerator_id, s.started_at, s.stopped_at, s.consent_uri, s.audio_uri,
    s.screenshot_fields ? JSON.stringify(s.screenshot_fields) : null,
    JSON.stringify(s.answers), s.sync_status, s.created_at,
  );
}

export async function getSession(id: string): Promise<LocalSession | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<any>('SELECT * FROM sessions WHERE id = ?', id);
  return row ? rowToSession(row) : null;
}

export async function listSessions(): Promise<LocalSession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>('SELECT * FROM sessions ORDER BY created_at DESC');
  return rows.map(rowToSession);
}

export async function listPendingSessions(): Promise<LocalSession[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<any>(
    "SELECT * FROM sessions WHERE sync_status IN ('pending', 'failed') ORDER BY created_at ASC",
  );
  return rows.map(rowToSession);
}

export async function setSyncStatus(id: string, status: LocalSession['sync_status']): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE sessions SET sync_status = ? WHERE id = ?', status, id);
}
