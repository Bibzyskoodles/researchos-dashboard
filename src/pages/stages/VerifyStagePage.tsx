import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import StagePageWrapper from './StagePageWrapper';
import SubmissionsPage from '../field-quality/SubmissionsPage';
import DataIntegrityCard from '../../gamify/DataIntegrityCard';

export default function VerifyStagePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  return (
    <StagePageWrapper stage="Verify" icon="🔍">
      <DataIntegrityCard />
      {/* Call-mode interviews verify through their own push-ranked queue
          (Bible 8.6) rather than this browsable submissions table. */}
      <button
        onClick={() => navigate(`/projects/${projectId}/verify/call`)}
        style={{
          display: 'block', width: '100%', textAlign: 'left', cursor: 'pointer',
          background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8,
          padding: '12px 16px', marginBottom: 16, fontFamily: 'Inter, sans-serif',
          fontSize: 13, color: '#1D4ED8', fontWeight: 600,
        }}
      >
        📞 Call Review Queue — remote interviews ranked by what needs you today ›
      </button>
      <SubmissionsPage />
    </StagePageWrapper>
  );
}
