import React from 'react';
import StagePageWrapper from './StagePageWrapper';

export default function DesignStagePage() {
  return (
    <StagePageWrapper stage="Design" icon="📝">
      <div style={{
        background: 'white', borderRadius: 16, border: '1px solid #E8EDF5',
        boxShadow: '0 2px 12px rgba(10,15,28,.06)', padding: 48, textAlign: 'center',
      }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📝</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: '#080D1A', marginBottom: 8 }}>Design Stage</div>
        <p style={{ fontSize: 14, color: '#6B7280' }}>
          Questionnaire builder coming soon. Ada will help you design your questionnaire from a brief.
        </p>
      </div>
    </StagePageWrapper>
  );
}
