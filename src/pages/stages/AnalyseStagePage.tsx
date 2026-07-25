import React from 'react';
import StagePageWrapper from './StagePageWrapper';
import InsightProjectPage from '../insights/InsightProjectPage';
import { useProject } from '../../context/ProjectContext';
import { COLORS } from '../../styles/tokens';

// The Analyse stage is the InsightScore project view for this project.
// chromeless: InsightProjectPage brings its own header/tabs, but the
// lifecycle stepper + Ada strip stay so Analyse reads as stage 4 of the
// same system, not a separate product.
//
// One insight engine, mode-aware provenance (constitution 01): themes,
// statistics and reports are identical across modes — what differs is
// the evidence trail behind each quote and claim.
const PROVENANCE: Record<string, string> = {
  field: '🧭 Analysis draws on verified field submissions — every quote and claim traces back to its submission evidence (GPS, media, timing).',
  call: '📞 Analysis draws on verified call interviews — every quote traces back to its transcript and recording timestamp.',
  hybrid: '🔀 Analysis draws on verified interviews from both modes — every quote traces back to its evidence, whether a field submission or a call recording.',
};

export default function AnalyseStagePage() {
  const { activeProject } = useProject();
  const mode = activeProject?.collection_mode || 'field';

  return (
    <StagePageWrapper stage="analyse" chromeless>
      <div style={{
        fontSize: 12, color: '#4B5563', background: 'white',
        border: `1px solid ${COLORS.line}`, borderLeft: '3px solid #06B6D4',
        borderRadius: 10, padding: '9px 13px', marginBottom: 16,
        fontFamily: 'Inter, sans-serif', lineHeight: 1.5,
      }}>
        {PROVENANCE[mode]}
      </div>
      <InsightProjectPage />
    </StagePageWrapper>
  );
}
