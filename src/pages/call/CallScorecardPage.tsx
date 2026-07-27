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
import { COLORS, scoreColor } from '../../styles/tokens';
import StagePageWrapper from '../stages/StagePageWrapper';

const REGISTER_STYLES: Record<string, { border: string; bg: string; label: string }> = {
  knows: { border: '#15803D', bg: '#F0FDF4', label: 'High confidence' },
  suspects: { border: '#B45309', bg: '#FFFBEB', label: 'Suspicion — evidence named' },
  recommends_checking: { border: '#6B7280', bg: '#F9FAFB', label: 'Needs a human check' },
};

function ScoreTile({ label, value }: { label: string; value: number | null }) {
  return (
    <div style={{ flex: 1, minWidth: 120, background: '#FFFFFF', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: '12px 14px', boxShadow: '0 1px 6px rgba(10,15,28,.04)' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: value === null || value === undefined ? '#111827' : scoreColor(value) }}>{value ?? '—'}</div>
    </div>
  );
}

// Mirror of the backend's scoring weights (services/scoring.py owns the
// truth) — lets the scorecard show WHICH findings pulled each score down
// and by how much: deduction = weight × finding confidence.
const DIMENSION_WEIGHTS: Record<string, [dim: 'authenticity' | 'compliance' | 'behaviour' | 'quality', weight: number]> = {
  missing_question: ['compliance', 0.30], answer_mismatch: ['compliance', 0.25],
  consent_not_verified: ['compliance', 0.45], consent_mismatch: ['compliance', 0.45],
  pacing: ['behaviour', 0.15], interviewer_dominance: ['behaviour', 0.15],
  rushed_segment: ['behaviour', 0.20], low_engagement: ['behaviour', 0.10],
  short_interview: ['behaviour', 0.30], straightlining: ['behaviour', 0.15],
  coaching_indicator: ['authenticity', 0.30], third_party_voice: ['authenticity', 0.20],
  scripted_exchange: ['authenticity', 0.25], similarity: ['authenticity', 0.35],
  portfolio_anomaly: ['authenticity', 0.25], respondent_mismatch: ['authenticity', 0.40],
  voice_mismatch: ['authenticity', 0.40], device_state_discrepancy: ['authenticity', 0.20],
  trap_failed: ['authenticity', 0.50], internal_contradiction: ['authenticity', 0.30],
  single_voice: ['authenticity', 0.50],
  audio_quality: ['quality', 0.15],
  // transcription_disagreement deliberately absent: engines disagreeing is
  // OUR measurement limit — it lowers confidence, never the score.
};

const DIM_LABELS: Record<string, string> = {
  authenticity: 'Authenticity', compliance: 'Compliance', behaviour: 'Behaviour', quality: 'Quality',
};

/** Per-dimension "what pulled this score down", derived from the evidence. */
function ScoreBreakdown({ card }: { card: CallScorecard }) {
  const rows: Record<string, { label: string; deduction: number }[]> = {};
  for (const e of card.evidence) {
    const entry = DIMENSION_WEIGHTS[e.type];
    if (!entry || e.confidence === null) continue;
    const [dim, weight] = entry;
    (rows[dim] ||= []).push({
      label: e.type.replace(/_/g, ' '),
      deduction: Math.round(weight * e.confidence),
    });
  }
  const dims = Object.keys(rows);
  if (dims.length === 0) return null;
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>
        Why these scores — every deduction traces to a finding below
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
        {dims.map((dim) => (
          <div key={dim}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
              {DIM_LABELS[dim] || dim}
            </div>
            {rows[dim].map((r, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, color: '#374151', marginBottom: 2 }}>
                <span>{r.label}</span>
                <span style={{ fontWeight: 700, color: '#B91C1C', whiteSpace: 'nowrap' }}>−{r.deduction}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 8 }}>
        Deduction = the finding's severity weight × its confidence. Overall is capped by the average
        of the three dimensions. Fixed rules, written before any data is seen.
      </div>
    </div>
  );
}

const RECORDING_LABELS: Record<string, string> = {
  audio: '📞 Full call recording',
  consent_recording: '🛡️ Consent recording',
  call_screen: '📱 Call screen proof',
};

/**
 * Evidence playback. Files are fetched through the authenticated api
 * instance (bearer header — a bare <audio src> would arrive with no auth)
 * and handed to the browser as an object URL, loaded only on demand.
 */
function EvidencePlayer({ interviewId, kinds }: { interviewId: string; kinds: string[] }) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => () => { Object.values(urls).forEach(URL.revokeObjectURL); }, [urls]);

  const load = (kind: string) => {
    setLoading(kind);
    setLoadError(null);
    callScoreApi.evidenceFile(interviewId, kind)
      .then((r) => setUrls((u) => ({ ...u, [kind]: URL.createObjectURL(r.data) })))
      .catch(() => setLoadError(`Could not load the ${RECORDING_LABELS[kind] || kind} — try again.`))
      .finally(() => setLoading(null));
  };

  if (kinds.length === 0) return null;
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${COLORS.line}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: COLORS.ink, marginBottom: 8 }}>
        Listen for yourself — the evidence behind every score
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {kinds.map((kind) => (
          <div key={kind} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#374151', minWidth: 170 }}>
              {RECORDING_LABELS[kind] || kind}
            </span>
            {urls[kind] ? (
              kind === 'call_screen'
                ? <a href={urls[kind]} target="_blank" rel="noreferrer" style={{ fontSize: 12.5 }}>Open screenshot</a>
                : <audio controls src={urls[kind]} style={{ height: 34, maxWidth: '100%' }} />
            ) : (
              <button
                onClick={() => load(kind)}
                disabled={loading === kind}
                style={{ fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 8, border: `1px solid ${COLORS.line}`, background: '#F9FAFB', cursor: 'pointer' }}
              >
                {loading === kind ? 'Loading…' : kind === 'call_screen' ? 'View' : '▶ Play'}
              </button>
            )}
          </div>
        ))}
      </div>
      {loadError && <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 8 }}>{loadError}</div>}
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
  const [backcheckStatus, setBackcheckStatus] = useState<string | null>(null);
  const [backchecks, setBackchecks] = useState<any[]>([]);
  const [assignee, setAssignee] = useState('');
  const [outcomeText, setOutcomeText] = useState<Record<string, string>>({});

  const loadBackchecks = useCallback(() => {
    if (!id) return;
    callScoreApi.listBackchecks(id)
      .then((r) => setBackchecks(r.data.backchecks || []))
      .catch(() => undefined);
  }, [id]);
  useEffect(() => { loadBackchecks(); }, [loadBackchecks]);

  const dispatchBackcheck = (method: 'human' | 'ai') => {
    if (!id) return;
    setBackcheckStatus(method === 'ai' ? 'Dispatching AI call…' : 'Assigning…');
    callScoreApi
      .dispatchBackcheck(id, method, method === 'human' ? assignee.trim() || undefined : undefined)
      .then(() => {
        setBackcheckStatus(method === 'ai'
          ? 'AI back-check call dispatched — the result will appear in this scorecard’s evidence when the call completes.'
          : 'Human back-check assigned — record the outcome below once the call is made.');
        setAssignee('');
        loadBackchecks();
      })
      .catch((e) => setBackcheckStatus(
        e?.response?.status === 503
          ? 'No voice-agent provider configured — use the human option.'
          : 'Could not create the back-check.',
      ));
  };

  const completeBackcheck = (backcheckId: string) => {
    const summary = (outcomeText[backcheckId] || '').trim();
    if (!summary) return;
    callScoreApi.completeBackcheck(backcheckId, summary)
      .then(() => { setOutcomeText((o) => ({ ...o, [backcheckId]: '' })); loadBackchecks(); load(); })
      .catch(() => setBackcheckStatus('Could not record the outcome — try again.'));
  };

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

  if (error) {
    return (
      <StagePageWrapper stage="verify" chromeless>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#B91C1C' }}>{error}</p>
      </StagePageWrapper>
    );
  }
  if (!card) {
    return (
      <StagePageWrapper stage="verify" chromeless>
        <p style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, color: '#6B7280' }}>Loading scorecard…</p>
      </StagePageWrapper>
    );
  }

  const reg = REGISTER_STYLES[card.ada_summary.register] || REGISTER_STYLES.recommends_checking;

  return (
    <StagePageWrapper stage="verify" chromeless>
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 760 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        📞 Call Interview Scorecard
      </h2>
      {/* Which interview this is — respondent, who conducted it, when, how long */}
      <div style={{ fontSize: 13, color: '#4B5563', margin: '0 0 16px', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: '#111827' }}>
          {card.interview?.respondent_name || 'Unknown respondent'}
        </span>
        {card.interview?.enumerator_id && <span>· interviewed by {card.interview.enumerator_id}</span>}
        {card.interview?.started_at && <span>· {new Date(card.interview.started_at).toLocaleString()}</span>}
        {card.interview?.duration_seconds != null && (
          <span>· {Math.floor(card.interview.duration_seconds / 60)}m {card.interview.duration_seconds % 60}s</span>
        )}
      </div>

      {/* Ada speaks first — the same Ada presence as everywhere else */}
      <div style={{
        display: 'flex', gap: 12, alignItems: 'flex-start',
        borderLeft: `4px solid ${reg.border}`, background: reg.bg,
        borderRadius: 12, padding: '14px 16px', marginBottom: 20,
      }}>
        <span style={{
          width: 34, height: 34, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
          background: 'linear-gradient(135deg,#2463EB,#7C3AED)', color: 'white',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 700, position: 'relative',
        }}>
          A
          <img
            src="/ada-avatar.jpg" alt=""
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            style={{ position: 'absolute', inset: 0, width: 34, height: 34, objectFit: 'cover' }}
          />
        </span>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: reg.border, textTransform: 'uppercase', marginBottom: 4 }}>
            Ada · {reg.label} ({card.confidence_level}%)
          </div>
          <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.5 }}>{card.ada_summary.text}</div>
        </div>
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

      <ScoreBreakdown card={card} />

      {id && <EvidencePlayer interviewId={id} kinds={card.recordings || []} />}

      {(card.late_start_flag || card.early_stop_flag) && (
        <div style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 20 }}>
          ⚠️ Timing flag: {card.late_start_flag ? 'recording started after the call began (late start)' : ''}
          {card.late_start_flag && card.early_stop_flag ? ' and ' : ''}
          {card.early_stop_flag ? 'the call continued after recording stopped (early stop)' : ''}
          . Partial-trust score — the uncovered span is unverifiable.
        </div>
      )}

      {/* Answers the AI heard in the recording — the Glance-Confirm
          post-hoc half. Drafted by AI, grounded in quotes; the typed
          questionnaire answers always take precedence downstream. */}
      {card.evidence.some((e) => e.type === 'extracted_answer') && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>
            🎧 Answers heard in the recording <span style={{ fontWeight: 500, color: '#6B7280', fontSize: 12 }}>(AI-extracted — typed answers always win)</span>
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {card.evidence.filter((e) => e.type === 'extracted_answer').map((e, i) => (
              <div key={e.id || `ai-${i}`} style={{ background: '#F8FAFF', border: '1px solid #DBE5F8', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: 13, color: '#111827' }}>{e.description}</div>
                <div style={{ fontSize: 11, color: '#6B7280', marginTop: 4 }}>
                  {formatSeconds(e.timestamp_range[0])}–{formatSeconds(e.timestamp_range[1])}
                  {e.confidence !== null ? ` · ${e.confidence}% confidence` : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Evidence — every conclusion points here (Design Principle 1) */}
      <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>Evidence</h3>
      {card.evidence.length === 0 ? (
        <p style={{ fontSize: 13, color: '#6B7280' }}>No findings — clean run.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
          {card.evidence.filter((e) => e.type !== 'extracted_answer').map((e, i) => (
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
        {card.recommended_action === 'conduct_backcheck' && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <input
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                placeholder="Assignee (optional — defaults to you)"
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8, width: 220 }}
              />
              <button
                onClick={() => dispatchBackcheck('human')}
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #BBF7D0', background: '#F0FDF4', color: '#15803D', cursor: 'pointer' }}
              >
                👤 Assign human back-check
              </button>
              <button
                onClick={() => dispatchBackcheck('ai')}
                style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '7px 14px', borderRadius: 8, border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer' }}
              >
                🤖 Dispatch AI back-check call
              </button>
            </div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 6 }}>
              Either way, the result lands in this scorecard's evidence. The AI call discloses
              itself and only confirms the interview happened — it never re-interviews.
            </div>
            {backcheckStatus && (
              <div style={{ fontSize: 12, color: '#374151', marginTop: 6 }}>{backcheckStatus}</div>
            )}
          </div>
        )}

        {backchecks.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {backchecks.map((b) => (
              <div key={b.id} style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 12px', marginBottom: 8, background: '#FAFAFA' }}>
                <div style={{ fontSize: 12, color: '#374151' }}>
                  {b.method === 'ai' ? '🤖 AI call' : `👤 ${b.assigned_to || 'Human'}`} · {b.status}
                  {b.summary && <span> — {b.summary}</span>}
                </div>
                {b.method === 'human' && b.status !== 'completed' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <input
                      value={outcomeText[b.id] || ''}
                      onChange={(e) => setOutcomeText((o) => ({ ...o, [b.id]: e.target.value }))}
                      placeholder="What did the back-check find?"
                      style={{ flex: 1, fontFamily: 'Inter, sans-serif', fontSize: 12, padding: '6px 10px', border: '1px solid #E5E7EB', borderRadius: 8 }}
                    />
                    <button
                      onClick={() => completeBackcheck(b.id)}
                      style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 8, border: 'none', background: '#2463EB', color: '#fff', cursor: 'pointer' }}
                    >
                      Record outcome
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
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
    </StagePageWrapper>
  );
}
