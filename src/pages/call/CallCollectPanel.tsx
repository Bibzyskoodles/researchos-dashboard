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
};

export default function CallCollectPanel() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [interviews, setInterviews] = useState<CallInterviewListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    callScoreApi
      .listInterviews(projectId)
      .then((res) => { if (!cancelled) setInterviews(res.data.interviews || []); })
      .catch(() => { if (!cancelled) setError('Could not load call interviews.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
        Remote interviews captured with the CallScore app. Interviews conducted offline appear
        as “Pending sync” until the enumerator regains connectivity — that's normal.
      </p>

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
          return (
            <div
              key={iv.id}
              onClick={done ? () => navigate(`/projects/${projectId}/verify/call/${iv.id}`) : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, background: '#FFFFFF',
                border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px',
                cursor: done ? 'pointer' : 'default',
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
                  Enumerator {iv.enumerator_id || '—'}
                </div>
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  {iv.started_at ? new Date(iv.started_at).toLocaleString() : 'Not started'}
                  {!iv.consent_captured && ' · ⚠️ no consent artifact'}
                </div>
              </div>
              {iv.verdict && (
                <span style={{ fontSize: 12, fontWeight: 700, color: iv.verdict === 'REJECT' ? '#B91C1C' : iv.verdict === 'FLAG' ? '#B45309' : '#15803D' }}>
                  {iv.verdict}{iv.grade ? ` · ${iv.grade}` : ''}
                </span>
              )}
              <span style={{ fontSize: 12, fontWeight: 600, color: sync.color }}>{sync.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
