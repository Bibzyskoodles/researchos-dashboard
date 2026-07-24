/**
 * Offline-first sync (Bible 6.4 / 5.3). Sessions marked 'pending' upload
 * whenever connectivity returns — sync is a background consequence of the
 * interview, never a requirement of conducting it. The whole chain is
 * idempotent on the device-generated session id: re-running after a
 * mid-upload crash never duplicates a session.
 *
 * Recording BYTES upload first (multipart, streamed from disk), then the
 * evidence bundle references the server-side storage_refs — so the
 * transcription pipeline has real audio to work on.
 */
import NetInfo from '@react-native-community/netinfo';
import { callApi } from '../api/client';
import { listPendingSessions, setSyncStatus } from '../db/local';
import { LocalSession } from '../types';

let syncing = false;

export async function syncSession(s: LocalSession): Promise<void> {
  await setSyncStatus(s.id, 'syncing');
  try {
    // 1. Create (idempotent server-side on the client-generated id).
    await callApi.createSession({
      id: s.id,
      org_id: s.org_id,
      project_id: s.project_id,
      enumerator_id: s.enumerator_id,
      respondent_id: s.respondent_id,
      started_at: s.started_at,
      consent_captured: !!s.consent_uri,
    });
    // 2. Stop timestamps (BLE call-state fields arrive in V1 with the
    //    companion app — Bible 6.5's flags then activate automatically).
    if (s.stopped_at) {
      await callApi.stopSession(s.id, { stopped_at: s.stopped_at });
    }
    // 3. Recording bytes — consent artifact first; without it the server
    //    rejects the whole bundle (Part 7 hard gate, enforced both ends).
    let consentRef = s.consent_uri ? `device://${s.consent_uri}` : null;
    let audioRef = s.audio_uri ? `device://${s.audio_uri}` : null;
    if (s.consent_uri) {
      consentRef = (await callApi.uploadRecording(s.id, 'consent_recording', s.consent_uri)).storage_ref;
    }
    if (s.audio_uri) {
      audioRef = (await callApi.uploadRecording(s.id, 'audio', s.audio_uri)).storage_ref;
    }
    // 4. Evidence bundle referencing the stored files.
    const artifacts: object[] = [
      { artifact_type: 'consent_recording', storage_ref: consentRef },
      { artifact_type: 'audio', storage_ref: audioRef },
      { artifact_type: 'questionnaire_response', payload: s.answers },
    ];
    if (s.screenshot_fields) {
      artifacts.push({
        artifact_type: 'screenshot_extracted_fields',
        payload: s.screenshot_fields, // fields only — never the image (Bible 6.1)
      });
    }
    await callApi.uploadEvidenceBundle(s.id, artifacts);
    await setSyncStatus(s.id, 'synced');
  } catch (e) {
    await setSyncStatus(s.id, 'failed'); // retried on the next sweep
    throw e;
  }
}

export async function syncAllPending(): Promise<{ synced: number; failed: number }> {
  if (syncing) return { synced: 0, failed: 0 };
  syncing = true;
  let synced = 0;
  let failed = 0;
  try {
    const state = await NetInfo.fetch();
    if (!state.isConnected) return { synced, failed };
    for (const s of await listPendingSessions()) {
      try {
        await syncSession(s);
        synced++;
      } catch {
        failed++;
      }
    }
  } finally {
    syncing = false;
  }
  return { synced, failed };
}

/** Call once at app start: sync whenever connectivity comes back. */
export function startSyncListener(): () => void {
  return NetInfo.addEventListener((state) => {
    if (state.isConnected) void syncAllPending();
  });
}
