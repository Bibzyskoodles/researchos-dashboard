/**
 * CollaborationPanel — minimal valid stub component.
 * The original file contained invalid syntax. This placeholder satisfies the build.
 */
import React from 'react';

interface CollaborationPanelProps {
  questionnaireId?: string;
  currentUserId?: string;
}

export default function CollaborationPanel({ questionnaireId, currentUserId }: CollaborationPanelProps) {
  if (!questionnaireId || !currentUserId) return null;
  return (
    <div style={{ padding: 16, fontSize: 14, color: '#6B7280' }}>
      Collaboration features are not available in this build.
    </div>
  );
}
