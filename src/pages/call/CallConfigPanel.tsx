/**
 * Project-level Call configuration — the consent script the enumerator
 * app displays verbatim (Bible Part 7: wording cannot drift), plus
 * language and speech-engine routing. Lives on the Collect stage for
 * call/hybrid projects; the backend upserts CallProjectConfig.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { callScoreApi } from '../../services/api';
import { COLORS } from '../../styles/tokens';

const STT_PROVIDERS = [
  { id: '', label: 'Auto (language-aware default)' },
  { id: 'deepgram', label: 'Deepgram' },
  { id: 'openai', label: 'OpenAI Whisper' },
  { id: 'spitch', label: 'Spitch (Nigerian languages)' },
  { id: 'intron', label: 'Intron (African speech)' },
];

const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'pcm', label: 'Nigerian Pidgin' },
  { id: 'yo', label: 'Yoruba' },
  { id: 'ig', label: 'Igbo' },
  { id: 'ha', label: 'Hausa' },
];

const inputStyle: React.CSSProperties = {
  fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '8px 10px',
  border: `1px solid ${COLORS.line}`, borderRadius: 8, background: 'white',
  color: COLORS.ink, width: '100%', boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase',
  letterSpacing: 0.6, display: 'block', marginBottom: 5,
};

export default function CallConfigPanel() {
  const { projectId } = useParams<{ projectId: string }>();
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [consentScript, setConsentScript] = useState('');
  const [consentLanguage, setConsentLanguage] = useState('en');
  const [sttLanguage, setSttLanguage] = useState('');
  const [sttPrimary, setSttPrimary] = useState('');
  const [sttVerify, setSttVerify] = useState('');
  const [strictness, setStrictness] = useState('standard');
  const [effectiveOrder, setEffectiveOrder] = useState<string[]>([]);
  const [status, setStatus] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    if (!projectId) return;
    callScoreApi.getCallConfig(projectId)
      .then((res) => {
        const c = res.data;
        setConsentScript(c.consent_script || '');
        setConsentLanguage(c.consent_language || 'en');
        setSttLanguage(c.stt_language || '');
        setSttPrimary(c.stt_primary || '');
        setSttVerify(c.stt_verify || '');
        setStrictness(c.strictness || 'standard');
        setEffectiveOrder(c.effective_stt_order || []);
      })
      .catch(() => undefined) // 404 = not configured yet; the form starts blank
      .finally(() => setLoaded(true));
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  const save = () => {
    if (!projectId) return;
    if (!consentScript.trim()) {
      setStatus({ kind: 'err', text: 'The consent script is required — it is read to every respondent.' });
      return;
    }
    setSaving(true);
    setStatus(null);
    callScoreApi.setCallConfig(projectId, {
      consent_script: consentScript.trim(),
      consent_language: consentLanguage,
      stt_language: sttLanguage || null,
      stt_primary: sttPrimary || null,
      stt_verify: sttVerify || null,
      strictness,
    })
      .then((res) => {
        setEffectiveOrder(res.data.effective_stt_order || []);
        setStatus({ kind: 'ok', text: 'Saved. The enumerator app picks this up on its next sync.' });
      })
      .catch(() => setStatus({ kind: 'err', text: 'Could not save — check your connection and try again.' }))
      .finally(() => setSaving(false));
  };

  return (
    <div style={{
      background: 'white', border: `1px solid ${COLORS.line}`, borderRadius: 12,
      padding: '12px 16px', marginBottom: 16, fontFamily: 'Inter, sans-serif',
    }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: 'Inter, sans-serif', textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 15 }}>⚙️</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>Call configuration</span>
        <span style={{ fontSize: 11.5, color: '#6B7280' }}>
          — consent script, language, speech engines
        </span>
        {loaded && !consentScript && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: '#B45309', background: '#FFFBEB',
            border: '1px solid #FDE68A', borderRadius: 999, padding: '2px 8px',
          }}>
            consent script not set
          </span>
        )}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: COLORS.muted }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: 14 }}>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>
              Consent script — read verbatim to every respondent before recording starts
            </label>
            <textarea
              value={consentScript}
              onChange={(e) => setConsentScript(e.target.value)}
              placeholder={'e.g. "This interview will be recorded for quality verification. Your answers stay confidential and you can stop at any time. Do you agree to continue?"'}
              style={{ ...inputStyle, minHeight: 84, resize: 'vertical', lineHeight: 1.5 }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Consent language</label>
              <select value={consentLanguage} onChange={(e) => setConsentLanguage(e.target.value)} style={inputStyle}>
                {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Interview language</label>
              <select value={sttLanguage} onChange={(e) => setSttLanguage(e.target.value)} style={inputStyle}>
                <option value="">Same as consent</option>
                {LANGUAGES.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Primary transcription</label>
              <select value={sttPrimary} onChange={(e) => setSttPrimary(e.target.value)} style={inputStyle}>
                {STT_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Verification pass</label>
              <select value={sttVerify} onChange={(e) => setSttVerify(e.target.value)} style={inputStyle}>
                {STT_PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Cleaning strictness</label>
              <select value={strictness} onChange={(e) => setStrictness(e.target.value)} style={inputStyle}>
                <option value="standard">Standard — directional research</option>
                <option value="strict">Strict — board-deck grade</option>
              </select>
            </div>
          </div>
          {strictness === 'strict' && (
            <div style={{ fontSize: 11.5, color: '#6B7280', marginBottom: 12 }}>
              Strict mode flags earlier and sends more interviews to human review. The findings
              themselves never change — only how hard they bite. Tell your client which mode the
              data was cleaned under; that transparency is the point.
            </div>
          )}

          {effectiveOrder.length > 0 && (
            <div style={{ fontSize: 11.5, color: '#6B7280', marginBottom: 12 }}>
              Effective engine order: {effectiveOrder.join(' → ')}
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={save}
              disabled={saving}
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: 12.5, fontWeight: 600,
                background: saving ? '#93B4F5' : COLORS.blue, color: 'white', border: 'none',
                borderRadius: 8, padding: '8px 18px', cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Saving…' : 'Save configuration'}
            </button>
            {status && (
              <span style={{ fontSize: 12, color: status.kind === 'ok' ? COLORS.green : '#B91C1C' }}>
                {status.text}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
