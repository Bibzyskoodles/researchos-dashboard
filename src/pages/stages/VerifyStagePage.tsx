import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StagePageWrapper from './StagePageWrapper';
import SubmissionsPage from '../field-quality/SubmissionsPage';
import DataIntegrityCard from '../../gamify/DataIntegrityCard';
import CallReviewQueuePage from '../call/CallReviewQueuePage';
import VerificationEngineBar from '../../components/verify/VerificationEngineBar';
import { useProject } from '../../context/ProjectContext';
import { COLORS } from '../../styles/tokens';

export default function VerifyStagePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { activeProject } = useProject();
  const mode = activeProject?.collection_mode || 'field';

  const showField = mode === 'field' || mode === 'hybrid';
  const showCall = mode === 'call' || mode === 'hybrid';

  return (
    <StagePageWrapper stage="verify">
      <VerificationEngineBar mode={mode} />
      <DataIntegrityCard />

      {/* Call-only projects: the push-ranked review queue IS the verify view. */}
      {showCall && mode === 'call' && <CallReviewQueuePage embedded />}

      {/* Hybrid: both surfaces, clearly sectioned as one engine's output. */}
      {mode === 'hybrid' && (
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={() => navigate(`/projects/${projectId}/verify/call`)}
            style={{
              display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
              background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10,
              padding: '12px 16px', fontFamily: 'Inter, sans-serif',
              fontSize: 13, color: '#1D4ED8', fontWeight: 600,
            }}
          >
            📞 Call Review Queue — remote interviews ranked by what needs you today ›
          </button>
        </div>
      )}

      {showField && (
        <>
          {mode === 'hybrid' && (
            <div style={{
              fontSize: 10.5, fontWeight: 700, color: COLORS.muted, textTransform: 'uppercase',
              letterSpacing: 0.8, margin: '4px 0 10px', fontFamily: 'Inter, sans-serif',
            }}>
              🧭 Field submissions
            </div>
          )}
          <SubmissionsPage />
        </>
      )}
    </StagePageWrapper>
  );
}
