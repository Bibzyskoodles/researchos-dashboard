import React, { useState } from 'react';
import StagePageWrapper from './StagePageWrapper';
import SubmissionsPage from '../field-quality/SubmissionsPage';
import CallCollectPanel from '../call/CallCollectPanel';
import AgentInterviewPanel from '../call/AgentInterviewPanel';

// Capture modes inside one app (Bible Part 1.3 + Part 12) — the mode is a
// per-interview choice made at collection time, so the Collect stage is
// where the split surfaces. Agent mode is optional and clearly labelled
// AI-conducted (Part 12); InsightScore is downstream of all modes.
// Staged-release gates (set in Vercel): hide a mode entirely until it has
// passed testing — UI gating layered on top of the server-side env gates,
// never instead of them.
const CALL_MODE_ENABLED = process.env.REACT_APP_CALL_MODE_ENABLED !== 'false'; // default on
const AGENT_MODE_ENABLED = process.env.REACT_APP_AGENT_MODE_ENABLED === 'true'; // default OFF

const MODES = [
  { key: 'field' as const, label: '🧭 Field', hint: 'In-person submissions' },
  ...(CALL_MODE_ENABLED
    ? [{ key: 'call' as const, label: '📞 Call', hint: 'Remote interviews (human)' }]
    : []),
  ...(AGENT_MODE_ENABLED
    ? [{ key: 'agent' as const, label: '🤖 Agent', hint: 'AI-conducted interviews (optional mode)' }]
    : []),
];

export default function CollectStagePage() {
  const [mode, setMode] = useState<'field' | 'call' | 'agent'>('field');

  return (
    <StagePageWrapper stage="Collect" icon="📡">
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, fontFamily: 'Inter, sans-serif' }}>
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => setMode(m.key)}
            title={m.hint}
            style={{
              fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '8px 16px', borderRadius: 8,
              cursor: 'pointer',
              border: mode === m.key ? '1px solid #2463EB' : '1px solid #E5E7EB',
              background: mode === m.key ? '#EFF6FF' : '#FFFFFF',
              color: mode === m.key ? '#2463EB' : '#374151',
              fontWeight: mode === m.key ? 700 : 500,
            }}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'field' && <SubmissionsPage />}
      {mode === 'call' && <CallCollectPanel />}
      {mode === 'agent' && <AgentInterviewPanel />}
    </StagePageWrapper>
  );
}
