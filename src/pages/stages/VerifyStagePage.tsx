import React from 'react';
import StagePageWrapper from './StagePageWrapper';
import SubmissionsPage from '../field-quality/SubmissionsPage';

export default function VerifyStagePage() {
  return (
    <StagePageWrapper stage="Verify" icon="🔍">
      <SubmissionsPage />
    </StagePageWrapper>
  );
}
