/**
 * Agent mode (Bible Part 12, Revision 2) — optional AI-conducted
 * interviews. Off unless the deployment enables it (AGENT_MODE_ENABLED +
 * voice-agent provider); this panel degrades to an explanation when the
 * backend says 503. Every interview dispatched here is labelled
 * collection_mode='agent' everywhere it appears — provenance is the
 * trust anchor for this mode.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { callScoreApi } from '../../services/api';

interface Respondent { id: string; display_name: string | null; phone_number: string | null }

const STATUS_COLORS: Record<string, string> = {
  dispatched: '#2463EB', completed: '#15803D',
  consent_declined: '#B45309', failed: '#B91C1C', queued: '#6B7280',
};

export default function AgentInterviewPanel() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [interviews, setInterviews] = useState<any[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [modeUnavailable, setModeUnavailable] = useState(false);

  const load = useCallback(() => {
    if (!projectId) return;
    callScoreApi.listRespondents(projectId)
      .then((r) => setRespondents(r.data.respondents || []))
      .catch(() => undefined);
    callScoreApi.listAgentInterviews(projectId)
      .then((r) => setInterviews(r.data.agent_interviews || []))
      .catch(() => undefined);
  }, [projectId]);
  useEffect(() => { load(); }, [load]);

  const dispatch = (respondentId: string) => {
    if (!projectId) return;
    setStatus('Dispatching AI interviewer…');
    callScoreApi.dispatchAgentInterview(projectId, respondentId)
      .then(() => { setStatus('Call dispatched — it will appear below and score automatically when it completes.'); load(); })
      .catch((e) => {
        if (e?.response?.status === 503) setModeUnavailable(true);
        setStatus(e?.response?.data?.detail || 'Could not dispatch the interview.');
      });
  };

  const dispatched = new Set(interviews.map((iv) => iv.respondent_id));

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 12px' }}>
        An AI interviewer calls the respondent, discloses it's an AI in its first sentence,
        asks for verbal consent, and conducts the questionnaire. Declined consent ends the
        call and nothing is kept. Every interview is permanently labelled as AI-conducted.
      </p>
      {modeUnavailable && (
        <div style={{ fontSize: 13, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 12 }}>
          Agent mode isn't enabled on this deployment. It needs <code>AGENT_MODE_ENABLED=true</code> and
          a voice-agent provider configured — see the deploy runbook.
        </div>
      )}
      {status && <p style={{ fontSize: 12, color: '#374151', marginBottom: 12 }}>{status}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
        {respondents.map((r) => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{r.display_name || 'Unnamed respondent'}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{r.phone_number || 'No number on file'}</div>
            </div>
            <button
              onClick={() => dispatch(r.id)}
              disabled={dispatched.has(r.id)}
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 600,
                padding: '7px 14px', borderRadius: 8, cursor: dispatched.has(r.id) ? 'default' : 'pointer',
                border: '1px solid #C7D2FE', background: dispatched.has(r.id) ? '#F9FAFB' : '#EEF2FF',
                color: dispatched.has(r.id) ? '#9CA3AF' : '#3730A3',
              }}
            >
              {dispatched.has(r.id) ? 'Dispatched' : '🤖 AI interview'}
            </button>
          </div>
        ))}
        {respondents.length === 0 && (
          <p style={{ fontSize: 13, color: '#6B7280' }}>No respondents on this project yet — import them first.</p>
        )}
      </div>

      {interviews.length > 0 && (
        <>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#111827', margin: '0 0 8px' }}>AI-conducted interviews</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {interviews.map((iv) => (
              <div
                key={iv.submission_id}
                onClick={iv.verdict ? () => navigate(`/projects/${projectId}/verify/call/${iv.submission_id}`) : undefined}
                style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '10px 14px', cursor: iv.verdict ? 'pointer' : 'default' }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: '#EEF2FF', color: '#3730A3' }}>🤖 AI</span>
                <span style={{ flex: 1, fontSize: 13, color: '#111827' }}>Respondent {iv.respondent_id}</span>
                {iv.verdict && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: iv.verdict === 'REJECT' ? '#B91C1C' : iv.verdict === 'FLAG' ? '#B45309' : '#15803D' }}>
                    {iv.verdict}{iv.grade ? ` · ${iv.grade}` : ''}
                  </span>
                )}
                <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_COLORS[iv.status] || '#6B7280' }}>
                  {iv.status.replace(/_/g, ' ')}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
