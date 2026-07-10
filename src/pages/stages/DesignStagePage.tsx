import React from 'react';
import StagePageWrapper from './StagePageWrapper';
import QuestionnairePage from '../questionnaire/QuestionnairePage';

export default function DesignStagePage() {
  return (
    <StagePageWrapper stage="Design" icon="📋">
      <QuestionnairePage />
    </StagePageWrapper>
  );
}
