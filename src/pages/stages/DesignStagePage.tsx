import React from 'react';
import StagePageWrapper from './StagePageWrapper';
import QuestionnairePage from '../questionnaire/QuestionnairePage';
import CallQuestionnaireEditor from '../call/CallQuestionnaireEditor';
import { useProject } from '../../context/ProjectContext';

// Design adapts to the collection mode: call projects get the call
// question editor (the list the enumerator app + AI agents read);
// field projects keep the FieldScore designer; hybrid shows both.
export default function DesignStagePage() {
  const { activeProject } = useProject();
  const mode = activeProject?.collection_mode || 'field';

  return (
    <StagePageWrapper stage="design">
      {(mode === 'call' || mode === 'hybrid') && <CallQuestionnaireEditor />}
      {(mode === 'field' || mode === 'hybrid') && <QuestionnairePage />}
    </StagePageWrapper>
  );
}
