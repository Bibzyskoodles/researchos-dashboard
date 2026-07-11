import React from 'react';
import StagePageWrapper from './StagePageWrapper';
import SubmissionsPage from '../field-quality/SubmissionsPage';
import DataIntegrityCard from '../../gamify/DataIntegrityCard';

export default function VerifyStagePage() {
  return (
    <StagePageWrapper stage="Verify" icon="🔍">
      <DataIntegrityCard />
      <SubmissionsPage />
    </StagePageWrapper>
  );
}
