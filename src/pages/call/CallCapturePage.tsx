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
interface QChoice { name: string; label: string }
interface QItem {
  question_key: string; question_text: string; is_required: boolean;
  question_type?: 'text' | 'numeric' | 'select_one' | 'select_multiple';
  choices?: QChoice[] | null;
}

const FALLBACK_SCRIPT =
  'Hello, my name is [your name] and I am calling on behalf of [organisation]. ' +
  'This interview will be recorded for quality and verification purposes. ' +
  'Your answers are confidential and you may stop at any time. ' +
  'Do I have your permission to record and begin?';

function useRecorder(onChunk?: (chunk: Blob) => void) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    chunksRef.current = [];
    const rec = new MediaRecorder(stream);
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) {
        chunksRef.current.push(e.data);
        onChunk?.(e.data); // same chunks, second consumer: live transcription
      }
    };
    rec.start(1000);
    recorderRef.current = rec;
  };
  const stop = () => new Promise<Blob>((resolve, reject) => {
    const rec = recorderRef.current;
    if (!rec) return reject(new Error('not recording'));
    const finish = () => {
      try { rec.stream.getTracks().forEach((t) => t.stop()); } catch { /* already stopped */ }
      resolve(new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' }));
    };
    // Already stopped (double-tap, tab suspension): resolve with what we
    // have instead of waiting forever for an onstop that never fires.
    if (rec.state === 'inactive') return finish();
    const safety = setTimeout(finish, 5000);
    rec.onstop = () => { clearTimeout(safety); finish(); };
    try { rec.stop(); } catch { clearTimeout(safety); finish(); }
  });
  return { start, stop };
}

function AddRespondentForm({ projectId, onAdded }: { projectId: string; onAdded: (r: Respondent) => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const add = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await callScoreApi.createRespondent(projectId, name.trim(), phone.trim() || undefined);
      onAdded(res.data);
      setName('');
      setPhone('');
    } catch {
      setErr('Could not add — check your connection and try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div style={{ background: '#F8FAFF', border: '1px solid #DBE5F8', borderRadius: 8, padding: 12, marginBottom: 6 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#111827', marginBottom: 8 }}>＋ Add someone to call</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          value={name} onChange={(e) => setName(e.target.value)} placeholder="Name"
          onKeyDown={(e) => e.key === 'Enter' && add()}
          style={{ flex: 2, minWidth: 140, fontFamily: 'Inter, sans-serif', fontSize: 13, padding: 9, border: '1px solid #E5E7EB', borderRadius: 6 }}
        />
        <input
          value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)"
          onKeyDown={(e) => e.key === 'Enter' && add()}
          style={{ flex: 1, minWidth: 120, fontFamily: 'Inter, sans-serif', fontSize: 13, padding: 9, border: '1px solid #E5E7EB', borderRadius: 6 }}
        />
        <button
          onClick={add} disabled={busy || !name.trim()}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 13, fontWeight: 600, color: '#fff',
            background: busy || !name.trim() ? '#93B4F5' : BLUE, border: 'none', borderRadius: 6,
            padding: '9px 16px', cursor: busy || !name.trim() ? 'default' : 'pointer',
          }}
        >
          {busy ? 'Adding…' : 'Add'}
        </button>
      </div>
      {err && <p style={{ fontSize: 12, color: '#B91C1C', margin: '8px 0 0' }}>{err}</p>}
    </div>
  );
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
  const [usingDefaultScript, setUsingDefaultScript] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  // Live Glance-Confirm state: AI-suggested answers awaiting confirmation
  // (amber), fields the enumerator has touched (AI never overwrites), and
  // the streaming socket itself.
  const [liveState, setLiveState] = useState<'off' | 'live' | 'unavailable'>('off');
  const [uploadStep, setUploadStep] = useState('');
  const [aiSuggested, setAiSuggested] = useState<Record<string, number>>({}); // key -> confidence
  const touchedRef = useRef<Set<string>>(new Set());
  const liveWsRef = useRef<WebSocket | null>(null);
  const [sttLanguage, setSttLanguage] = useState('en');
  const consentRec = useRecorder();
  const audioRec = useRecorder((chunk) => {
    const s = liveWsRef.current;
    if (s && s.readyState === WebSocket.OPEN) s.send(chunk);
  });

  useEffect(() => {
    if (!projectId) return;
    callScoreApi.listRespondents(projectId)
      .then((r) => setRespondents(r.data.respondents || []))
      .catch(() => setError('Could not load respondents.'));
    callScoreApi.getQuestionnaire(projectId)
      .then((r) => { if (r.data.items?.length) setQuestions(r.data.items); })
      .catch(() => undefined);
    callScoreApi.getCallConfig(projectId)
      .then((r) => {
        if (r.data.consent_script) { setScript(r.data.consent_script); setUsingDefaultScript(false); }
        setSttLanguage(r.data.stt_language || r.data.consent_language || 'en');
      })
      .catch(() => undefined);
  }, [projectId]);

  // Live transcription socket — opens with the interview, dies with it.
  // Network-adaptive (constitution 00 §6): if the connection drops
  // mid-interview it retries with backoff and resumes when signal
  // returns; capture is never touched either way (recording stays
  // client-side until Stop). Audio during an outage simply isn't
  // live-transcribed — the post-hoc pipeline still hears all of it.
  const liveDesiredRef = useRef(false);
  const liveBackoffRef = useRef(3000);
  const liveRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openLiveSocket = () => {
    if (!projectId) return;
    liveDesiredRef.current = true;
    try {
      const base = (process.env.REACT_APP_CALLSCORE_API_URL ||
        'https://researchos-dashboard-production.up.railway.app').replace(/^http/, 'ws');
      const token = localStorage.getItem('fs_token') || '';
      const socket = new WebSocket(
        `${base}/api/v1/live/transcribe?project_id=${encodeURIComponent(projectId)}` +
        `&language=${encodeURIComponent(sttLanguage)}&token=${encodeURIComponent(token)}`,
      );
      socket.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          if (msg.type === 'status') {
            setLiveState(msg.state === 'live' ? 'live' : 'unavailable');
            if (msg.state === 'live') liveBackoffRef.current = 3000; // healthy again
            if (msg.state === 'unauthorized' || msg.state === 'unavailable') {
              liveDesiredRef.current = false; // server said no — don't hammer it
            }
          } else if (msg.type === 'answers') {
            for (const a of msg.answers || []) {
              const key = a.question_key as string;
              if (touchedRef.current.has(key)) continue; // human input wins, always
              setAnswers((prev) => (prev[key] || '').trim() && !aiSuggestedRef.current[key]
                ? prev : { ...prev, [key]: a.answer });
              setAiSuggested((prev) => ({ ...prev, [key]: a.confidence }));
            }
          }
        } catch { /* non-JSON frame — ignore */ }
      };
      socket.onerror = () => setLiveState('unavailable');
      socket.onclose = () => {
        if (liveWsRef.current === socket) liveWsRef.current = null;
        // Signal cut mid-interview: retry with backoff until Stop or the
        // server refuses. Live resumes by itself when the network does.
        if (liveDesiredRef.current) {
          setLiveState('unavailable');
          const delay = liveBackoffRef.current;
          liveBackoffRef.current = Math.min(delay * 2, 30000);
          liveRetryTimerRef.current = setTimeout(() => {
            if (liveDesiredRef.current) openLiveSocket();
          }, delay);
        }
      };
      liveWsRef.current = socket;
    } catch {
      setLiveState('unavailable');
    }
  };
  const aiSuggestedRef = useRef<Record<string, number>>({});
  useEffect(() => { aiSuggestedRef.current = aiSuggested; }, [aiSuggested]);
  const closeLiveSocket = () => {
    liveDesiredRef.current = false;
    if (liveRetryTimerRef.current) { clearTimeout(liveRetryTimerRef.current); liveRetryTimerRef.current = null; }
    liveWsRef.current?.close();
    liveWsRef.current = null;
    setLiveState('off');
  };

  // A refresh or closed tab mid-interview loses the recording entirely —
  // the browser flow has no offline queue (by design), so guard the exit.
  useEffect(() => {
    if (stage !== 'consent' && stage !== 'interview' && stage !== 'uploading') return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [stage]);

  // Elapsed interview timer — enumerators need to see the recording is alive.
  useEffect(() => {
    if (stage !== 'interview' || !startedAt) return;
    const t = setInterval(
      () => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))),
      1000,
    );
    return () => clearInterval(t);
  }, [stage, startedAt]);

  const startInterview = async () => {
    if (!respondent || !projectId || !consentBlob) return;
    openLiveSocket(); // open first so early chunks stream too
    try {
      await audioRec.start();
    } catch {
      closeLiveSocket();
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
    // Same guard the mobile app applies (parity): blank required questions
    // will be flagged by the compliance agent — confirm before uploading.
    const blank = questions.filter((q) => q.is_required && !(answers[q.question_key] || '').trim());
    if (blank.length > 0) {
      const ok = window.confirm(
        `${blank.length} required question${blank.length === 1 ? ' is' : 's are'} blank ` +
        `(${blank.map((q) => q.question_text).slice(0, 3).join('; ')}${blank.length > 3 ? '…' : ''}). ` +
        'The compliance check will flag them. Stop and upload anyway?',
      );
      if (!ok) return;
    }
    setStage('uploading');
    setError(null);
    closeLiveSocket();
    try {
      setUploadStep('Finishing the recording…');
      const audioBlob = await audioRec.stop();
      const user = JSON.parse(localStorage.getItem('fs_user') || '{}');
      setUploadStep('Saving the interview…');
      // Recreate idempotently in case the at-start create failed.
      await callScoreApi.createSession({
        id: sessionId, org_id: user.org || '', project_id: projectId,
        enumerator_id: user.id || user.email || 'unknown',
        respondent_id: respondent!.id, started_at: startedAt, consent_captured: true,
      });
      await callScoreApi.stopSession(sessionId, { stopped_at: new Date().toISOString() });
      setUploadStep('Uploading the consent recording…');
      const consentRef = (await callScoreApi.uploadRecording(sessionId, 'consent_recording', consentBlob)).data.storage_ref;
      setUploadStep('Uploading the interview recording…');
      const audioRef = (await callScoreApi.uploadRecording(sessionId, 'audio', audioBlob)).data.storage_ref;
      setUploadStep('Finalising…');
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
          <AddRespondentForm
            projectId={projectId!}
            onAdded={(r) => setRespondents((prev) => [r, ...prev])}
          />
          {respondents.length === 0 && (
            <p style={{ fontSize: 13, color: '#6B7280' }}>
              No one to call yet — add your first respondent above.
            </p>
          )}
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
          {usingDefaultScript && (
            <p style={{ fontSize: 12, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '8px 12px', marginBottom: 10 }}>
              ⚠️ This project has no consent script configured — you are reading the generic default.
              Set the project's own script in Collect → Call configuration.
            </p>
          )}
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
          <div style={{ background: '#FEE2E2', borderRadius: 8, padding: '10px 12px', marginBottom: 6, fontSize: 13, fontWeight: 700, color: '#B91C1C', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span>● Recording — {respondent?.display_name || 'respondent'}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>
              {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}
            </span>
            {sessionId && <span style={{ fontWeight: 400, color: '#6B7280' }}>Link code: {sessionId.slice(-6).toUpperCase()}</span>}
            {liveState === 'live' && (
              <span style={{ fontWeight: 600, fontSize: 11, color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 999, padding: '2px 8px' }}>
                🎧 Live listening — answers pre-fill as they're heard
              </span>
            )}
            {liveState === 'unavailable' && liveDesiredRef.current && (
              <span style={{ fontWeight: 600, fontSize: 11, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 999, padding: '2px 8px' }}>
                🎧 Live paused — reconnecting… recording is unaffected
              </span>
            )}
            <span style={{ marginLeft: 'auto', fontWeight: 400, color: '#6B7280', fontSize: 12 }}>
              {questions.length > 0 && `${questions.filter((q) => (answers[q.question_key] || '').trim()).length}/${questions.length} answered`}
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '0 0 14px' }}>
            Keep recording until the call has fully ended — stopping early leaves an unverifiable gap
            and the interview will carry a timing flag.
          </p>
          {questions.length === 0 && (
            <p style={{ fontSize: 13, color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 10 }}>
              No questionnaire loaded for this project — the recording still uploads, but answers can't
              be captured here. Import a questionnaire in the Design stage.
            </p>
          )}
          {questions.map((q) => {
            const val = answers[q.question_key] || '';
            const suggested = aiSuggested[q.question_key] !== undefined && !touchedRef.current.has(q.question_key);
            const setVal = (v: string) => {
              touchedRef.current.add(q.question_key); // human input wins from now on
              setAiSuggested((prev) => { const { [q.question_key]: _gone, ...rest } = prev; return rest; });
              setAnswers((a) => ({ ...a, [q.question_key]: v }));
            };
            const confirmSuggestion = () => {
              touchedRef.current.add(q.question_key);
              setAiSuggested((prev) => { const { [q.question_key]: _gone, ...rest } = prev; return rest; });
            };
            const hasChoices = (q.question_type === 'select_one' || q.question_type === 'select_multiple') && (q.choices?.length || 0) > 0;
            const multi = q.question_type === 'select_multiple';
            const selected = new Set(val.split(',').map((s) => s.trim()).filter(Boolean));
            return (
              <div key={q.question_key} style={{
                background: suggested ? '#FFFBEB' : '#fff',
                border: suggested ? '1px solid #FDE68A' : '1px solid #E5E7EB',
                borderRadius: 8, padding: 12, marginBottom: 10, transition: 'all 220ms ease',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 6 }}>
                  {q.question_text}{q.is_required && <span style={{ color: '#B91C1C' }}> *</span>}
                  {multi && <span style={{ fontWeight: 400, color: '#9CA3AF', fontSize: 11 }}> (select all that apply)</span>}
                </div>
                {hasChoices ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {q.choices!.map((c) => {
                      const on = multi ? selected.has(c.name) : val === c.name;
                      return (
                        <button
                          key={c.name} type="button"
                          onClick={() => {
                            if (multi) {
                              const next = new Set(selected);
                              if (next.has(c.name)) next.delete(c.name); else next.add(c.name);
                              setVal(Array.from(next).join(', '));
                            } else {
                              setVal(on ? '' : c.name);
                            }
                          }}
                          style={{
                            fontFamily: 'Inter, sans-serif', fontSize: 12.5, fontWeight: on ? 700 : 500,
                            padding: '7px 14px', borderRadius: 999, cursor: 'pointer',
                            border: on ? `1.5px solid ${BLUE}` : '1px solid #E5E7EB',
                            background: on ? '#EFF6FF' : '#fff', color: on ? BLUE : '#374151',
                          }}
                        >
                          {c.label}
                        </button>
                      );
                    })}
                  </div>
                ) : q.question_type === 'numeric' ? (
                  <input style={inputStyle} type="number" inputMode="decimal" value={val}
                    onChange={(e) => setVal(e.target.value)} />
                ) : (
                  <input style={inputStyle} value={val} onChange={(e) => setVal(e.target.value)} />
                )}
                {suggested && (
                  <button type="button" onClick={confirmSuggestion} style={{
                    marginTop: 8, fontFamily: 'Inter, sans-serif', fontSize: 12, fontWeight: 700,
                    color: '#B45309', background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}>
                    🎧 Heard live ({aiSuggested[q.question_key]}%) — tap to confirm ✓
                  </button>
                )}
              </div>
            );
          })}
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

      {stage === 'uploading' && (
        <p style={{ fontSize: 13, color: '#6B7280' }}>
          {uploadStep || 'Uploading…'} <span style={{ color: '#9CA3AF' }}>(this takes under a minute — if it fails you can retry, nothing is lost)</span>
        </p>
      )}

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
