import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { projectsApi } from '../../services/api';
import { Project } from '../../context/ProjectContext';
import { getIndustry, getStudyType } from '../../context/ResearchContext';

const BLUE = '#2463EB';
const GREEN = '#059669';
const AMBER = '#D97706';
const CARD_STYLE: React.CSSProperties = {
  background: 'white',
  borderRadius: 16,
  border: '1px solid #E8EDF5',
  boxShadow: '0 2px 12px rgba(10,15,28,.06)',
};

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; dot: string; label: string }> = {
    design: { color: '#6B7280', dot: '#9CA3AF', label: 'Designing' },
    collect: { color: BLUE, dot: BLUE, label: 'Collecting' },
    verify: { color: AMBER, dot: AMBER, label: 'Needs attention' },
    analyse: { color: '#7C3AED', dot: '#7C3AED', label: 'Analysing' },
    report: { color: GREEN, dot: GREEN, label: 'Complete' },
  };
  const c = config[status] || config['design'];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 5,
      background: c.color + '14', borderRadius: 20, padding: '3px 9px',
    }}>
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: c.dot }} />
      <span style={{ fontSize: 11, fontWeight: 600, color: c.color }}>{c.label}</span>
    </div>
  );
}

function LifecycleBar({ status }: { status: string }) {
  const stages = ['design', 'collect', 'verify', 'analyse', 'report'];
  const labels = ['Design', 'Collect', 'Verify', 'Analyse', 'Report'];
  const currentIdx = stages.indexOf(status);
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, marginBottom: 4 }}>
        {stages.map((s, i) => {
          let bg = '#E8EDF5';
          if (i < currentIdx) bg = BLUE;
          else if (i === currentIdx) bg = BLUE;
          return (
            <div key={s} style={{
              flex: 1, height: 4, borderRadius: 2, background: bg,
              opacity: i === currentIdx ? 1 : i < currentIdx ? 0.7 : 0.25,
            }} />
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 2 }}>
        {labels.map((l, i) => (
          <div key={l} style={{
            flex: 1, fontSize: 9, color: i <= currentIdx ? '#6B7280' : '#9CA3AF',
            fontWeight: i === currentIdx ? 600 : 400,
          }}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const industry = getIndustry((project as any).industry_id);
  const studyType = getStudyType(industry, project.study_type_id);
  const status = project.status || 'design';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...CARD_STYLE,
        padding: 20,
        cursor: 'pointer',
        border: hovered ? `1px solid ${BLUE}` : '1px solid #E8EDF5',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all .18s ease',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#080D1A', lineHeight: 1.3 }}>
          {project.name}
        </div>
        <StatusBadge status={status} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
        <span style={{ fontSize: 14 }}>{industry.icon}</span>
        <span style={{ fontSize: 12, color: '#6B7280' }}>{studyType.label}</span>
        <span style={{
          fontSize: 10, color: BLUE, background: BLUE + '12',
          padding: '2px 7px', borderRadius: 20, fontWeight: 600,
        }}>
          {project.platform || 'kobo'}
        </span>
      </div>

      <LifecycleBar status={status} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          {project.target_submissions ? `Target: ${project.target_submissions}` : 'No target set'}
        </span>
        <span style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>Open →</span>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    projectsApi.list()
      .then(r => setProjects(r.data.projects || []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const projectCount = projects.length;
  const collectingCount = projects.filter(p => p.status === 'collect').length;
  const attentionCount = projects.filter(p => p.status === 'verify').length;

  let adaMessage = `Welcome back, ${user?.name?.split(' ')[0] || 'there'}.`;
  if (projectCount === 0) {
    adaMessage = `Welcome to ResearchOS. Every research project you run lives here — from the questionnaire you design to the report your client receives. Let me help you set up your first project.`;
  } else if (attentionCount > 0) {
    adaMessage = `You have ${projectCount} project${projectCount !== 1 ? 's' : ''}. ${attentionCount} need${attentionCount === 1 ? 's' : ''} your attention — there are flagged submissions to review.`;
  } else if (collectingCount > 0) {
    adaMessage = `You have ${projectCount} project${projectCount !== 1 ? 's' : ''} running. ${collectingCount} ${collectingCount === 1 ? 'is' : 'are'} currently collecting data. Everything looks good.`;
  } else {
    adaMessage = `You have ${projectCount} project${projectCount !== 1 ? 's' : ''}. All looking good — no urgent actions needed.`;
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Ada hero card */}
      <div style={{
        background: 'linear-gradient(135deg, #080D1A 0%, #0F1729 100%)',
        borderRadius: 16, padding: 24, marginBottom: 24,
        display: 'flex', alignItems: 'flex-start', gap: 16,
      }}>
        <img
          src="/ada-avatar.jpg"
          alt="Ada"
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
        />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.4)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>
            Ada · Research Intelligence
          </div>
          <p style={{ color: 'rgba(255,255,255,.85)', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
            {adaMessage}
          </p>
          {projectCount === 0 && (
            <button
              onClick={() => navigate('/projects/new')}
              style={{
                marginTop: 16, background: BLUE, color: 'white', border: 'none',
                borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >
              Create your first project →
            </button>
          )}
        </div>
      </div>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#080D1A', margin: 0 }}>My Projects</h1>
        <button
          onClick={() => navigate('/projects/new')}
          style={{
            background: BLUE, color: 'white', border: 'none',
            borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          + New Project
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>
          Loading projects...
        </div>
      ) : projects.length === 0 ? (
        <div style={{
          ...CARD_STYLE, padding: 60, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔬</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#080D1A', marginBottom: 8 }}>
            No projects yet
          </div>
          <div style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>
            Create your first project to get started.
          </div>
          <button
            onClick={() => navigate('/projects/new')}
            style={{
              background: BLUE, color: 'white', border: 'none',
              borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            Create your first project →
          </button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {projects.map(p => (
            <ProjectCard
              key={p.id}
              project={p}
              onClick={() => navigate(`/projects/${p.id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
