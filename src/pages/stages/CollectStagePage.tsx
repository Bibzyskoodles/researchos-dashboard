import React from 'react';
import StagePageWrapper from './StagePageWrapper';
import SubmissionsPage from '../field-quality/SubmissionsPage';

export default function CollectStagePage() {
  return (
    <StagePageWrapper stage="Collect" icon="📡">
      <SubmissionsPage />
    </StagePageWrapper>
  );
}
