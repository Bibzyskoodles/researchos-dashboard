/**
 * Call-mode collection status for a project — the Collect-stage view when
 * the Call capture mode is selected. Shows each remote interview's consent
 * and sync state (offline-first: "pending sync" is a normal, expected state,
 * not an error — Bible Part 6.4).
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { callScoreApi } from '../../services/api';
import { CallInterviewListItem } from '../../types/callscore';

const SYNC_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pending sync', color: '#B45309' },
  synced: { label: 'Synced', color: '#2463EB' },
  processing: { label: 'Analyzing…', color: '#2463EB' },
  processed: { label: 'Verified', color: '#15803D' },
  failed: { label: 'Sync failed', color: '#B91C1C' },
  abandoned: { label: 'Marked as lost', color: '#9CA3AF' },
};

// Sync got stuck: either finish it from what the server already holds,
// or mark it lost (the record stays — every attempt leaves evidence).
function StuckActions({ id, onChanged }: { id: string; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const finish = async () => {
    setBusy(true);
    setNote(null);
    try {
      await callScoreApi.finalizeSync(id);
      setNote('Recovered — analysis is starting.');
      onChanged();
    } catch (e: any) {
      setNote(e?.response?.data?.detail || 'Could not recover — try again.');
    } finally {
      setBusy(false);
    }
  };
  const markLost = async () => {
    if (!window.confirm('Mark this interview as lost? The record stays for the audit trail, but it will stop showing as in-progress.')) return;
    setBusy(true);
    try {
      await callScoreApi.abandonSync(id);
      onChanged();
    } catch {
      setNote('Could not update — try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={finish} disabled={busy} style={{
          fontFamily: 'Inter, sans-serif', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
          background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8',
          borderRadius: 6, padding: '5px 10px',
        }}>
          {busy ? 'Working…' : '↻ Finish sync'}
        </button>
        <button onClick={markLost} disabled={busy} style={{
          fontFamily: 'Inter, sans-serif', fontSize: 11.5, fontWeight: 600, cursor: 'pointer',
          background: '#F9FAFB', border: '1px solid #E5E7EB', color: '#6B7280',
          borderRadius: 6, padding: '5px 10px',
        }}>
          Mark as lost
        </button>
      </div>
      {note && <div style={{ fontSize: 11.5, color: '#374151', marginTop: 6 }}>{note}</div>}
    </div>
  );
}

export default function CallCollectPanel() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<CallInterviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = React.useCallback(() => {
    if (!projectId) return;
    callScoreApi
      .listInterviews(projectId)
      .then((res) => setInterviews(res.data.interviews || []))
      .catch(() => setError('Could not load call interviews.'))
      .finally(() => setLoading(false));
  }, [projectId]);
  useEffect(() => { reload(); }, [reload]);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 12px' }}>
        Remote interviews captured with the CallScore app. Interviews conducted offline appear
        as “Pending sync” until the enumerator regains connectivity — that's normal.
      </p>
      <button
        onClick={() => navigate(`/projects/${projectId}/collect/call/new`)}
        style={{
          fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8',
          borderRadius: 8, padding: '10px 16px', marginBottom: 16,
        }}
      >
        ＋ New call interview from this computer
      </button>

      {loading && <p style={{ fontSize: 13, color: '#6B7280' }}>Loading call interviews…</p>}
      {error && <p style={{ fontSize: 13, color: '#B91C1C' }}>{error}</p>}
      {!loading && !error && interviews.length === 0 && (
        <div style={{ padding: 24, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, color: '#374151' }}>
          No call interviews yet for this project.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {interviews.map((iv) => {
          const sync = SYNC_LABELS[iv.sync_status || 'pending'] || SYNC_LABELS.pending;
          const done = iv.sync_status === 'processed';
          const stuck = iv.sync_status === 'pending' || iv.sync_status === 'failed';
          return (
            <div
              key={iv.id}
              style={{
                background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8,
                padding: '12px 14px', opacity: iv.sync_status === 'abandoned' ? 0.6 : 1,
              }}
            >
              <div
                onClick={done ? () => navigate(`/projects/${projectId}/verify/call/${iv.id}`) : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: done ? 'pointer' : 'default' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                    Enumerator {iv.enumerator_id || '—'}
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280' }}>
                    {iv.started_at ? new Date(iv.started_at).toLocaleString() : 'Not started'}
                    {!iv.consent_captured && iv.sync_status !== 'abandoned' && ' · ⚠️ no consent artifact'}
                  </div>
                </div>
                {iv.verdict && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: iv.verdict === 'REJECT' ? '#B91C1C' : iv.verdict === 'FLAG' ? '#B45309' : '#15803D' }}>
                    {iv.verdict}{iv.grade ? ` · ${iv.grade}` : ''}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 600, color: sync.color }}>{sync.label}</span>
              </div>
              {stuck && <StuckActions id={iv.id} onChanged={reload} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
