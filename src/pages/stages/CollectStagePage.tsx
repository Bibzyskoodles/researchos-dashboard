import React, { useState } from 'react';
import StagePageWrapper from './StagePageWrapper';
import SubmissionsPage from '../field-quality/SubmissionsPage';
import CallCollectPanel from '../call/CallCollectPanel';
import CallConfigPanel from '../call/CallConfigPanel';
import AgentInterviewPanel from '../call/AgentInterviewPanel';
import { useProject } from '../../context/ProjectContext';
import { COLORS } from '../../styles/tokens';

const AGENT_MODE_ENABLED = process.env.REACT_APP_AGENT_MODE_ENABLED === 'true';

export default function CollectStagePage() {
  const { activeProject } = useProject();
  const mode = activeProject?.collection_mode || 'field';

  const showField = mode === 'field' || mode === 'hybrid';
  const showCall = mode === 'call' || mode === 'hybrid';

  const tabs = [
    ...(showField ? [{ key: 'field' as const, label: '🧭 Field', hint: 'In-person submissions' }] : []),
    ...(showCall ? [{ key: 'call' as const, label: '📞 Call', hint: 'Remote interviews' }] : []),
    ...(AGENT_MODE_ENABLED
      ? [{ key: 'agent' as const, label: '🤖 Agent', hint: 'AI-conducted interviews' }]
      : []),
  ];

  const [tab, setTab] = useState<'field' | 'call' | 'agent'>(mode === 'call' ? 'call' : 'field');

  // The project loads asynchronously: on a fresh page load the first
  // render runs with mode defaulted to 'field', so the initial tab can
  // be one this project doesn't have — which rendered NOTHING. Snap to
  // a valid tab whenever the real mode arrives.
  const validKeys = tabs.map((t) => t.key);
  const effectiveTab = validKeys.includes(tab) ? tab : (validKeys[0] ?? 'field');

  const singleMode = tabs.length === 1;

  return (
    <StagePageWrapper stage="collect">
      {!singleMode && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, fontFamily: 'Inter, sans-serif' }}>
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              title={t.hint}
              style={{
                fontFamily: 'Inter, sans-serif', fontSize: 13, padding: '8px 16px', borderRadius: 8,
                cursor: 'pointer', transition: 'all 220ms ease',
                border: effectiveTab === t.key ? `1px solid ${COLORS.blue}` : `1px solid ${COLORS.line}`,
                background: effectiveTab === t.key ? '#EFF6FF' : '#FFFFFF',
                color: effectiveTab === t.key ? COLORS.blue : COLORS.slate,
                fontWeight: effectiveTab === t.key ? 700 : 500,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}
      {effectiveTab === 'field' && showField && <SubmissionsPage />}
      {effectiveTab === 'call' && showCall && (
        <>
          <CallConfigPanel />
          <CallCollectPanel />
        </>
      )}
      {effectiveTab === 'agent' && <AgentInterviewPanel />}
    </StagePageWrapper>
  );
}
