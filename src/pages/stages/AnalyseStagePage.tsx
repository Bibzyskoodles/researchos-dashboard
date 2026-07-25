import React from 'react';
import StagePageWrapper from './StagePageWrapper';
import InsightProjectPage from '../insights/InsightProjectPage';

// The Analyse stage is the InsightScore project view for this project.
// chromeless: InsightProjectPage brings its own header/tabs, but the
// lifecycle stepper + Ada strip stay so Analyse reads as stage 4 of the
// same system, not a separate product.
export default function AnalyseStagePage() {
  return (
    <StagePageWrapper stage="analyse" chromeless>
      <InsightProjectPage />
    </StagePageWrapper>
  );
}
