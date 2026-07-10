import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';

interface StagePageWrapperProps {
  stage: string;
  icon: string;
  children: React.ReactNode;
}

export default function StagePageWrapper({ stage, icon, children }: StagePageWrapperProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeProject } = useProject();
  const navigate = useNavigate();
  const projectName = activeProject?.name || 'Project';

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#9CA3AF', marginBottom: 20 }}>
        <button
          onClick={() => navigate('/projects')}
          style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 12, padding: 0 }}
        >
          All Projects
        </button>
        <span>›</span>
        <button
          onClick={() => navigate(`/projects/${projectId}`)}
          style={{ background: 'none', border: 'none', color: '#6B7280', cursor: 'pointer', fontFamily: 'Inter, sans-serif', fontSize: 12, padding: 0 }}
        >
          {projectName}
        </button>
        <span>›</span>
        <span style={{ color: '#2463EB', fontWeight: 600 }}>{icon} {stage}</span>
      </div>
      {children}
    </div>
  );
}
