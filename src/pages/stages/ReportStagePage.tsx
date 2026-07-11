import React from 'react';
import StagePageWrapper from './StagePageWrapper';
import ReportsPage from '../reports/ReportsPage';
import DataIntegrityCard from '../../gamify/DataIntegrityCard';

export default function ReportStagePage() {
  return (
    <StagePageWrapper stage="Report" icon="📄">
      <DataIntegrityCard />
      <ReportsPage />
    </StagePageWrapper>
  );
}
