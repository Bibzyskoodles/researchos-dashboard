/**
 * Call-mode scorecard detail. Ada speaks first, in the register her
 * confidence earns (derived server-side — Bible 4A.3; the UI never
 * rewrites her hedging). Every score traces to the evidence list below
 * (Design Principle 1). Overrides require a reason and are logged to the
 * shared append-only override_log (Bible 4A.6).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { callScoreApi } from '../../services/api';
import { CallScorecard } from '../../types/callscore';

const REGISTER_STYLES: Record<string, { border: string; bg: string; label: string }> = {
  knows: { border: '#15803D', bg: '#F0FDF4', label: 'High confidence' },
  suspects: { border: '#B45309', bg: '#FFFBEB', label: 'Suspicion — evidence named' },
  recommends_checking: { border: '#6B7280', bg: '#F9FAFB', label: 'Needs a human check' },
};

function ScoreTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div style={{ flex: 1, minWidth: 120, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px' }}>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: '#111827' }}>{value ?? '—'}</div>
    </div>
  );
}

function formatSeconds(s: number | null): string {
  if (s === null || s === undefined) return '—';
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export default function CallScorecardPage() {
  const { id } = useParams<{ id: string }>();
  const [card, setCard] = useState<CallScorecard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overrideAction, setOverrideAction] = useState('approve');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideStatus, setOverrideStatus] = useState<string | null>(null);
  // Calibration loop: supervisor verdicts per finding (id -> verdict sent).
  const [findingVotes, setFindingVotes] = useState<Record<string, string>>({});

  const voteFinding = (findingId: string, verdict: 'correct' | 'incorrect') => {
    if (findingVotes[findingId]) return; // append-only server-side; one vote per view
    setFindingVotes((v) => ({ ...v, [findingId]: verdict }));
    callScoreApi.findingFeedback(findingId, verdict).catch(() =>
      setFindingVotes((v) => {
        const { [findingId]: _dropped, ...rest } = v;
        return rest;
      }),
    );
  };

  const load = useCallback(() => {
    if (!id) return;
    callScoreApi
      .scorecard(id)
      .then((res) => setCard(res.data))
      .catch(() => setError('Could not load this scorecard.'));
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const submitOverride = () => {
    if (!id || !overrideReason.trim()) {
      setOverrideStatus('A reason is required — overrides are audit-logged.');
      return;
    }
    const user = JSON.parse(localStorage.getItem('fs_user') || '{}');
    callScoreApi
      .recordOverride(id, overrideAction, user.id || user.email || 'unknown', overrideReason.trim())
      .then(() => { setOverrideStatus('Override logged.'); setOverrideReason(''); })
      .catch(() => setOverrideStatus('Failed to log override — try again.'));
  };

  if (error) return <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#B91C1C' }}>{error}</p>;
  if (!card) return <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280' }}>Loading scorecard…</p>;

  const reg = REGISTER_STYLES[card.ada_summary.register] || REGISTER_STYLES.recommends_checking;

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 760 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 16px' }}>
        📞 Call Interview Scorecard
      </h2>

      {/* Ada speaks first */}
      <div style={{ borderLeft: `4px solid ${reg.border}`, background: reg.bg, borderRadius: 8, padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: reg.border, textTransform: 'uppercase', marginBottom: 4 }}>
          Ada · {reg.label} ({card.confidence_level}%)
        </div>
        <div style={{ fontSize: 14, color: '#111827' }}>{card.ada_summary.text}</div>
      </div>

      {/* Headline shared vocabulary + sub-scores */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <ScoreTile label="Overall" value={card.overall_quality_score} />
        <ScoreTile label="Authenticity" value={card.authenticity_score} />
        <ScoreTile label="Compliance" value={card.compliance_score} />
        <ScoreTile label="Behaviour" value={card.behaviour_score} />
        <div style={{ flex: 1, minWidth: 120, background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px' }}>
          <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Verdict</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: card.verdict === 'REJECT' ? '#B91C1C' : card.verdict === 'FLAG' ? '#B45309' : '#15803D' }}>
            {card.verdict ?? '—'} {card.grade ? `· ${card.grade}` : ''}
          </div>
        </div>
      </div>

      {(card.late_start_flag || card.early_stop_flag) && (
        <div style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 20 }}>
          ⚠️ Timing flag: {card.late_start_flag ? 'recording started after the call began (late start)' : ''}
          {card.late_start_flag && card.early_stop_flag ? ' and ' : ''}
          {card.early_stop_flag ? 'the call continued after recording stopped (early stop)' : ''}
          . Partial-trust score — the uncovered span is unverifiable.
        </div>
      )}

      {/* Evidence — every conclusion points here (Design Principle 1) */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Evidence</h3>
      {card.evidence.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6B7280' }}>No findings — clean run.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {card.evidence.map((e, i) => (
            <div key={e.id || i} style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#6B7280', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{e.agent}</span>
                <span>{e.type}</span>
                <span style={{ marginLeft: 'auto' }}>
                  {formatSeconds(e.timestamp_range[0])}–{formatSeconds(e.timestamp_range[1])}
                  {e.confidence !== null ? ` · ${e.confidence}%` : ''}
                </span>
              </div>
              <div style={{ fontSize: 13, color: '#111827' }}>{e.description}</div>
              {/* Was the AI right? Every verdict tunes agent precision. */}
              {e.id && (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  {findingVotes[e.id] ? (
                    <span style={{ fontSize: 11, color: '#6B7280' }}>
                      Marked {findingVotes[e.id]} — thanks, this tunes the AI.
                    </span>
                  ) : (
                    <>
                      <span style={{ fontSize: 11, color: '#9CA3AF' }}>Was this finding right?</span>
                      <button
                        onClick={() => voteFinding(e.id, 'correct')}
                        style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, padding: '2px 10px', borderRadius: 999, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#15803D', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ✓ Correct
                      </button>
                      <button
                        onClick={() => voteFinding(e.id, 'incorrect')}
                        style={{ fontFamily: 'Inter, sans-serif', fontSize: 11, padding: '2px 10px', borderRadius: 999, border: '1px solid #FECACA', background: '#FEF2F2', color: '#B91C1C', cursor: 'pointer', fontWeight: 600 }}
                      >
                        ✗ Wrong
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Override — audit-logged, reason mandatory (Bible 4A.6) */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Supervisor decision</h3>
      <div style={{ background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: 8, padding: 14 }}>
        <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 10 }}>
          Ada recommends: <strong>{card.recommended_action.replace(/_/g, ' ')}</strong>. Deciding
          differently is fine — Ada advises, humans decide — but every override is logged with
          your name and reason for external audit.
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['approve', 'reject', 'backcheck', 'escalate'].map((a) => (
            <button
              key={a}
              onClick={() => setOverrideAction(a)}
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: 12, padding: '6px 12px', borderRadius: 6,
                cursor: 'pointer',
                border: overrideAction === a ? '1px solid #2463EB' : '1px solid #E5E7EB',
                background: overrideAction === a ? '#EFF6FF' : '#FFFFFF',
                color: overrideAction === a ? '#2463EB' : '#374151',
                fontWeight: overrideAction === a ? 700 : 400,
              }}
            >
              {a}
            </button>
          ))}
        </div>
        <textarea
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Reason (required — recorded in the audit log)"
          style={{
            width: '100%', boxSizing: 'border-box', minHeight: 60, fontFamily: 'Inter, sans-serif',
            fontSize: 13, padding: 10, border: '1px solid #E5E7EB', borderRadius: 6, resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
          <button
            onClick={submitOverride}
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#FFFFFF',
              background: '#2463EB', border: 'none', borderRadius: 6, padding: '8px 16px', cursor: 'pointer',
            }}
          >
            Record decision
          </button>
          {overrideStatus && <span style={{ fontSize: 12, color: '#6B7280' }}>{overrideStatus}</span>}
        </div>
      </div>
    </div>
  );
}
