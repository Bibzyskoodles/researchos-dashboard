/**
 * The verification engine, made visible. One engine, two capture modes:
 * field submissions and call interviews run through mode-appropriate AI
 * checks but produce the same vocabulary (verdict, grade, confidence,
 * evidence — constitution 01 "shared scoring vocabulary"). This bar
 * shows the user exactly which AI checks stand behind their verdicts.
 */
import React, { useState } from 'react';
import { COLORS } from '../../styles/tokens';

interface Check { icon: string; name: string; what: string }

const FIELD_CHECKS: Check[] = [
  { icon: '📍', name: 'GPS', what: 'Location vs. assigned zone, impossible travel between submissions' },
  { icon: '🖼️', name: 'Image AI', what: 'AI-generation detection, stock/downloaded photo detection, metadata forensics' },
  { icon: '🎙️', name: 'Audio AI', what: 'Genuine-interview detection on recorded audio' },
  { icon: '🗣️', name: 'Voice', what: 'Single-voice detection across one enumerator\'s submissions' },
  { icon: '⏱️', name: 'Timing', what: 'Interview duration vs. expected range, burst-submission clusters' },
  { icon: '🧬', name: 'Duplicates', what: 'Same respondent or answers appearing more than once' },
];

const CALL_CHECKS: Check[] = [
  { icon: '📝', name: 'Transcription', what: 'Multi-provider speech-to-text with speaker diarization' },
  { icon: '🎚️', name: 'Audio quality', what: 'Signal quality gate before any downstream scoring' },
  { icon: '✅', name: 'Compliance', what: 'Were the required questions actually asked, in substance' },
  { icon: '🔁', name: 'Consistency', what: 'Do recorded answers match the submitted questionnaire data' },
  { icon: '💬', name: 'Naturalness', what: 'Scripted or rehearsed exchanges, coached respondents' },
  { icon: '🧬', name: 'Patterns', what: 'Similarity and voice-fingerprint checks across interviews' },
];

export default function VerificationEngineBar({ mode }: { mode: 'field' | 'call' | 'hybrid' | 'historic' }) {
  const [open, setOpen] = useState(false);
  const groups: { label: string; checks: Check[] }[] =
    mode === 'hybrid'
      ? [{ label: 'Field checks', checks: FIELD_CHECKS }, { label: 'Call checks', checks: CALL_CHECKS }]
      : [{ label: mode === 'call' ? 'Call checks' : 'Field checks', checks: mode === 'call' ? CALL_CHECKS : FIELD_CHECKS }];

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
        <span style={{ fontSize: 15 }}>🛡️</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: COLORS.ink }}>
          AI Verification Engine
        </span>
        <span style={{ fontSize: 11.5, color: '#6B7280' }}>
          — {groups.reduce((n, g) => n + g.checks.length, 0)} automated checks behind every verdict
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: COLORS.muted }}>{open ? '▲' : '▼'}</span>
      </button>

      {!open && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {groups.flatMap((g) => g.checks).map((c) => (
            <span key={c.name} title={c.what} style={{
              fontSize: 11, fontWeight: 600, color: '#4B5563', background: '#F6F8FC',
              border: '1px solid #E8EDF5', borderRadius: 999, padding: '3px 10px',
            }}>
              {c.icon} {c.name}
            </span>
          ))}
        </div>
      )}

      {open && groups.map((g) => (
        <div key={g.label} style={{ marginTop: 12 }}>
          {groups.length > 1 && (
            <div style={{ fontSize: 10.5, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              {g.label}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
            {g.checks.map((c) => (
              <div key={c.name} style={{
                display: 'flex', gap: 9, alignItems: 'flex-start',
                background: '#FAFBFE', border: '1px solid #EEF2F9', borderRadius: 10, padding: '9px 11px',
              }}>
                <span style={{ fontSize: 14 }}>{c.icon}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: COLORS.ink }}>{c.name}</div>
                  <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.4 }}>{c.what}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
