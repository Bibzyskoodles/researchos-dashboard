import React from 'react';
import StagePageWrapper from './StagePageWrapper';
import ReportsPage from '../reports/ReportsPage';

export default function ReportStagePage() {
  return (
    <StagePageWrapper stage="Report" icon="📄">
      <ReportsPage />
    </StagePageWrapper>
  );
}
