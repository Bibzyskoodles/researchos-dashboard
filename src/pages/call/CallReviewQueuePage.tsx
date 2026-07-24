/**
 * Call-mode supervisor review queue — push-ranked, not a browsable
 * dashboard (Bible Part 8.6). Every item shows a one-line "why now";
 * items whose recommended action is "none" never appear (the backend
 * filters them), so an empty queue genuinely means nothing needs you.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { callScoreApi } from '../../services/api';
import { CallQueueItem } from '../../types/callscore';

const RISK_STYLES: Record<string, { bg: string; fg: string }> = {
  high: { bg: '#FEE2E2', fg: '#B91C1C' },
  medium: { bg: '#FEF3C7', fg: '#B45309' },
  low: { bg: '#DCFCE7', fg: '#15803D' },
};

const ACTION_LABELS: Record<string, string> = {
  review_recording: 'Review recording',
  conduct_backcheck: 'Conduct back-check',
  escalate: 'Escalate',
};

export default function CallReviewQueuePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<CallQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    callScoreApi
      .queue(projectId)
      .then((res) => { if (!cancelled) setItems(res.data.queue || []); })
      .catch(() => { if (!cancelled) setError('Could not load the call review queue.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        📞 Call Review Queue
      </h2>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 20px' }}>
        Remote interviews that need your attention today, ranked by risk. Clean interviews
        are not listed — an empty queue means nothing needs you.
      </p>

      {loading && <p style={{ fontSize: 13, color: '#6B7280' }}>Loading queue…</p>}
      {error && <p style={{ fontSize: 13, color: '#B91C1C' }}>{error}</p>}
      {!loading && !error && items.length === 0 && (
        <div style={{ padding: 24, background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 8, fontSize: 13, color: '#374151' }}>
          Nothing needs your attention right now.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => {
          const risk = RISK_STYLES[item.fraud_risk] || RISK_STYLES.low;
          return (
            <button
              key={item.interview_id}
              onClick={() => navigate(`/projects/${projectId}/verify/call/${item.interview_id}`)}
              style={{
                textAlign: 'left', cursor: 'pointer', background: '#FFFFFF',
                border: '1px solid #E5E7EB', borderRadius: 8, padding: '14px 16px',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
                  background: risk.bg, color: risk.fg, textTransform: 'uppercase',
                }}>
                  {item.fraud_risk} risk
                </span>
                <span style={{ fontSize: 12, color: '#6B7280' }}>
                  {ACTION_LABELS[item.recommended_action] || item.recommended_action}
                </span>
                <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' }}>
                  Enumerator {item.enumerator_id}
                </span>
              </div>
              {/* The "why now" line — never a bare score (Bible 8.6). */}
              <div style={{ fontSize: 13, color: '#111827' }}>{item.why_now}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
