import React from 'react';
import StagePageWrapper from './StagePageWrapper';
import InsightsPage from '../insights/InsightsPage';

export default function AnalyseStagePage() {
  return (
    <StagePageWrapper stage="Analyse" icon="✨">
      <InsightsPage />
    </StagePageWrapper>
  );
}
