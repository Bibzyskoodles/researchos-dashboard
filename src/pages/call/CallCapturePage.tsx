/**
 * Laptop-as-Device-2 capture flow (Bible 2.2 note: Device 2 is whatever
 * runs the questionnaire — for many enumerators that's a laptop, not a
 * second phone). Same lifecycle as the mobile app (Bible 2.3): pick
 * respondent → record consent (hard gate) → deliberate Start/Stop with
 * browser MediaRecorder audio → Glance-Confirm answers → upload.
 *
 * Browser trade-off vs the mobile app, stated honestly: this flow needs
 * connectivity at Stop to upload (no SQLite offline queue in-browser) —
 * fine for office/laptop settings, wrong for offline fieldwork, which
 * stays the mobile app's job.
 */
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { callScoreApi } from '../../services/api';

const BLUE = '#2463EB';

interface Respondent { id: string; display_name: string | null; phone_number: string | null }
interface QItem { question_key: string; question_text: string; is_required: boolean }

const FALLBACK_SCRIPT =
  'Hello, my name is [your name] and I am calling on behalf of [organisation]. ' +
  'This interview will be recorded for quality and verification purposes. ' +
  'Your answers are confidential and you may stop at any time. ' +
  'Do I have your permission to record and begin?';

function useRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.start(1000);
    recorderRef.current = rec;
  };
  const stop = () => new Promise<Blob>((resolve, reject) => {
    const rec = recorderRef.current;
    if (!rec) return reject(new Error('not recording'));
    rec.onstop = () => {
      rec.stream.getTracks().forEach((t) => t.stop());
      resolve(new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' }));
    };
    rec.stop();
  });
  return { start, stop };
}

export default function CallCapturePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [stage, setStage] = useState<'pick' | 'consent' | 'interview' | 'uploading' | 'done'>('pick');
  const [respondents, setRespondents] = useState<Respondent[]>([]);
  const [respondent, setRespondent] = useState<Respondent | null>(null);
  const [questions, setQuestions] = useState<QItem[]>([]);
  const [script, setScript] = useState(FALLBACK_SCRIPT);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [callNumber, setCallNumber] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [consentBlob, setConsentBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const consentRec = useRecorder();
  const audioRec = useRecorder();

  useEffect(() => {
    if (!projectId) return;
    callScoreApi.listRespondents(projectId)
      .then((r) => setRespondents(r.data.respondents || []))
      .catch(() => setError('Could not load respondents.'));
    callScoreApi.getQuestionnaire(projectId)
      .then((r) => { if (r.data.items?.length) setQuestions(r.data.items); })
      .catch(() => undefined);
    callScoreApi.getCallConfig(projectId)
      .then((r) => { if (r.data.consent_script) setScript(r.data.consent_script); })
      .catch(() => undefined);
  }, [projectId]);

  const startInterview = async () => {
    if (!respondent || !projectId || !consentBlob) return;
    try {
      await audioRec.start();
    } catch {
      setError('Microphone access is required. Allow it and try again.');
      return;
    }
    const id = crypto.randomUUID();
    const started = new Date().toISOString();
    setSessionId(id);
    setStartedAt(started); // anchor timestamp #1 — deliberate press
    const user = JSON.parse(localStorage.getItem('fs_user') || '{}');
    callScoreApi.createSession({
      id, org_id: user.org || '', project_id: projectId,
      enumerator_id: user.id || user.email || 'unknown',
      respondent_id: respondent.id, started_at: started, consent_captured: true,
    }).catch(() => undefined); // offline-at-start tolerated; upload retries at Stop
    setStage('interview');
  };

  const stopInterview = async () => {
    if (!sessionId || !startedAt || !consentBlob) return;
    setStage('uploading');
    setError(null);
    try {
      const audioBlob = await audioRec.stop();
      const user = JSON.parse(localStorage.getItem('fs_user') || '{}');
      // Recreate idempotently in case the at-start create failed.
      await callScoreApi.createSession({
        id: sessionId, org_id: user.org || '', project_id: projectId,
        enumerator_id: user.id || user.email || 'unknown',
        respondent_id: respondent!.id, started_at: startedAt, consent_captured: true,
      });
      await callScoreApi.stopSession(sessionId, { stopped_at: new Date().toISOString() });
      const consentRef = (await callScoreApi.uploadRecording(sessionId, 'consent_recording', consentBlob)).data.storage_ref;
      const audioRef = (await callScoreApi.uploadRecording(sessionId, 'audio', audioBlob)).data.storage_ref;
      const artifacts: object[] = [
        { artifact_type: 'consent_recording', storage_ref: consentRef },
        { artifact_type: 'audio', storage_ref: audioRef },
        { artifact_type: 'questionnaire_response', payload: answers },
      ];
      if (callNumber.trim()) {
        artifacts.push({ artifact_type: 'screenshot_extracted_fields', payload: { number: callNumber.trim() } });
      }
      await callScoreApi.uploadEvidenceBundle(sessionId, artifacts);
      setStage('done');
    } catch {
      setError('Upload failed — check your connection. Nothing is lost; press Stop again to retry.');
      setStage('interview');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', fontSize: 13,
    padding: 10, border: '1px solid #E5E7EB', borderRadius: 6,
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif', maxWidth: 720 }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>
        📞 New Call Interview (laptop)
      </h2>
      <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 16px' }}>
        Place the actual call on your phone as usual — this screen records room audio, shows the
        questionnaire, and uploads the evidence bundle. Needs to stay online.
      </p>
      {error && <p style={{ fontSize: 13, color: '#B91C1C' }}>{error}</p>}

      {stage === 'pick' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {respondents.length === 0 && <p style={{ fontSize: 13, color: '#6B7280' }}>No respondents on this project yet.</p>}
          {respondents.map((r) => (
            <button key={r.id} onClick={() => { setRespondent(r); setStage('consent'); }}
              style={{ textAlign: 'left', cursor: 'pointer', background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 14px', fontFamily: 'Inter, sans-serif' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{r.display_name || 'Unnamed respondent'}</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>{r.phone_number || 'No number on file'}</div>
            </button>
          ))}
        </div>
      )}

      {stage === 'consent' && (
        <div>
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderLeft: `4px solid ${BLUE}`, borderRadius: 8, padding: 16, marginBottom: 14, fontSize: 14, lineHeight: 1.6 }}>
            {script}
          </div>
          <p style={{ fontSize: 12, color: '#6B7280' }}>
            Read this exactly as written while recording. Without a consent recording the interview cannot start.
          </p>
          {!recordingConsent ? (
            <button onClick={async () => { try { await consentRec.start(); setRecordingConsent(true); setError(null); } catch { setError('Microphone access is required.'); } }}
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff', background: BLUE, border: 'none', borderRadius: 8, padding: '12px 20px', cursor: 'pointer' }}>
              ● Record consent
            </button>
          ) : (
            <button onClick={async () => { setConsentBlob(await consentRec.stop()); setRecordingConsent(false); }}
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff', background: '#B91C1C', border: 'none', borderRadius: 8, padding: '12px 20px', cursor: 'pointer' }}>
              ■ Stop — consent given
            </button>
          )}
          {consentBlob && (
            <button onClick={startInterview}
              style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff', background: '#15803D', border: 'none', borderRadius: 8, padding: '12px 20px', cursor: 'pointer', marginLeft: 10 }}>
              ▶ Start Interview
            </button>
          )}
        </div>
      )}

      {stage === 'interview' && (
        <div>
          <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 13, fontWeight: 700, color: '#B91C1C' }}>
            ● Recording — {respondent?.display_name || 'respondent'}
            {sessionId && <span style={{ fontWeight: 400, color: '#6B7280', marginLeft: 12 }}>Link code: {sessionId.slice(-6).toUpperCase()}</span>}
          </div>
          {questions.map((q) => (
            <div key={q.question_key} style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, marginBottom: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
                {q.question_text}{q.is_required && <span style={{ color: '#B91C1C' }}> *</span>}
              </div>
              <input style={inputStyle} value={answers[q.question_key] || ''}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.question_key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 8, padding: 12, marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6 }}>Number dialled (from your phone's call screen)</div>
            <input style={inputStyle} value={callNumber} onChange={(e) => setCallNumber(e.target.value)} placeholder="+234…" />
          </div>
          <button onClick={stopInterview}
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 14, fontWeight: 700, color: '#fff', background: '#B91C1C', border: 'none', borderRadius: 8, padding: '12px 22px', cursor: 'pointer' }}>
            ■ Stop Interview
          </button>
        </div>
      )}

      {stage === 'uploading' && <p style={{ fontSize: 13, color: '#6B7280' }}>Uploading evidence bundle…</p>}

      {stage === 'done' && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#15803D', marginBottom: 6 }}>Interview uploaded ✓</div>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>Analysis is running — it will appear in Verify shortly.</div>
          <button onClick={() => navigate(`/projects/${projectId}/collect`)}
            style={{ fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#fff', background: BLUE, border: 'none', borderRadius: 8, padding: '9px 16px', cursor: 'pointer' }}>
            Back to Collect
          </button>
        </div>
      )}
    </div>
  );
}
