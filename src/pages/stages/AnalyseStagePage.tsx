import React from 'react';
import InsightProjectPage from '../insights/InsightProjectPage';

// The Analyse stage is the InsightScore project view for this project.
// Render it directly (no StagePageWrapper) so its own header/tabs show correctly.
export default function AnalyseStagePage() {
  return <InsightProjectPage />;
}
