import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { projectsApi } from '../../services/api';
import { AnimatePresence, motion } from 'framer-motion';
import { Project, ProjectLifecycle } from '../../context/ProjectContext';
import { getIndustry, getStudyType } from '../../context/ResearchContext';

const BLUE = '#2463EB';
const GREEN = '#059669';
const AMBER = '#D97706';
const RED = '#DC2626';
const CARD: React.CSSProperties = {
  background: 'white',
  borderRadius: 16,
  border: '1px solid #E8EDF5',
  boxShadow: '0 2px 12px rgba(10,15,28,.06)',
};

function stageColor(status: string) {
  if (status === 'complete') return GREEN;
  if (status === 'active') return BLUE;
  if (status === 'attention') return AMBER;
  return '#E8EDF5';
}

function StageBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    complete: { label: 'Complete', color: GREEN, bg: GREEN + '14' },
    active: { label: 'Active', color: BLUE, bg: BLUE + '14' },
    not_started: { label: 'Not started', color: '#9CA3AF', bg: '#F3F4F6' },
    attention: { label: 'Needs attention', color: AMBER, bg: AMBER + '14' },
  };
  const c = config[status] || config['not_started'];
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: c.color, background: c.bg,
      borderRadius: 20, padding: '2px 9px',
    }}>{c.label}</span>
  );
}

function StageCard({
  num, icon, title, status, children, adaComment, accentColor
}: {
  num: number; icon: string; title: string; status: string;
  children: React.ReactNode; adaComment?: string; accentColor: string;
}) {
  return (
    <div style={{ ...CARD, display: 'flex', overflow: 'hidden', marginBottom: 12 }}>
      {/* Accent bar */}
      <div style={{ width: 4, background: accentColor, flexShrink: 0 }} />
      <div style={{ flex: 1, padding: '20px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', background: accentColor,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: 'white', flexShrink: 0,
            }}>{num}</div>
            <span style={{ fontSize: 16 }}>{icon}</span>
            <span style={{ fontWeight: 700, fontSize: 15, color: '#080D1A' }}>{title}</span>
          </div>
          <StageBadge status={status} />
        </div>
        {children}
        {adaComment && (
          <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', margin: '12px 0 0', borderTop: '1px solid #F0F4FF', paddingTop: 10 }}>
            Ada: {adaComment}
          </p>
        )}
      </div>
    </div>
  );
}

function ActionBtn({ label, onClick, primary }: { label: string; onClick?: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: primary ? BLUE : 'white',
        color: primary ? 'white' : '#374151',
        border: primary ? 'none' : '1px solid #E2E8F0',
        borderRadius: 7, padding: '7px 14px', fontSize: 12, fontWeight: 600,
        cursor: 'pointer', fontFamily: 'Inter, sans-serif',
      }}
    >
      {label}
    </button>
  );
}

function DeleteProjectModal({ projectName, onCancel, onConfirm, deleting }: {
  projectName: string; onCancel: () => void; onConfirm: () => void; deleting: boolean;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(8,13,26,.55)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.15 }}
        style={{
          background: 'white', borderRadius: 16, border: '1px solid #E8EDF5',
          boxShadow: '0 8px 40px rgba(10,15,28,.18)', padding: '32px 28px',
          width: 420, maxWidth: 'calc(100vw - 32px)', fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: '#080D1A', marginBottom: 12 }}>
          Delete this project?
        </div>
        <p style={{ fontSize: 13.5, color: '#374151', lineHeight: 1.65, margin: '0 0 8px' }}>
          This will permanently delete <strong>"{projectName}"</strong> and all its submissions, verification data, and analysis.
        </p>
        <p style={{ fontSize: 13, color: '#9CA3AF', margin: '0 0 28px' }}>This cannot be undone.</p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            onClick={onCancel}
            disabled={deleting}
            style={{
              padding: '9px 18px', borderRadius: 8, border: '1px solid #E2E8F0',
              background: 'white', color: '#374151', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              padding: '9px 18px', borderRadius: 8, border: 'none',
              background: RED, color: 'white', fontSize: 13, fontWeight: 600,
              cursor: deleting ? 'not-allowed' : 'pointer', fontFamily: 'Inter, sans-serif',
              opacity: deleting ? 0.7 : 1,
            }}
          >{deleting ? 'Deleting…' : 'Delete project'}</button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [lifecycle, setLifecycle] = useState<ProjectLifecycle | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!projectId) return;
    setDeleting(true);
    try {
      await projectsApi.delete(projectId);
      navigate('/projects');
    } catch {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    Promise.all([
      projectsApi.get(projectId),
      projectsApi.lifecycle(projectId),
    ]).then(([pRes, lcRes]) => {
      setProject(pRes.data.project);
      setLifecycle(lcRes.data);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: '#9CA3AF', fontSize: 14 }}>
        Loading project...
      </div>
    );
  }

  if (!project) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>Project not found</div>
        <button onClick={() => navigate('/projects')} style={{
          background: BLUE, color: 'white', border: 'none', borderRadius: 8,
          padding: '10px 20px', cursor: 'pointer', fontFamily: 'Inter, sans-serif',
        }}>← Back to Projects</button>
      </div>
    );
  }

  const industry = getIndustry((project as any).industry_id);
  const studyType = getStudyType(industry, project.study_type_id);
  const lc = lifecycle;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <AnimatePresence>
        {showDeleteModal && (
          <DeleteProjectModal
            projectName={project.name}
            onCancel={() => setShowDeleteModal(false)}
            onConfirm={handleDelete}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #080D1A 0%, #0F1729 100%)',
        borderRadius: 16, padding: '20px 24px', marginBottom: 20,
      }}>
        <button
          onClick={() => navigate('/projects')}
          style={{
            background: 'none', border: 'none', color: 'rgba(255,255,255,.4)',
            fontSize: 12, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            marginBottom: 12, padding: 0, display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ← All Projects
        </button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 800, color: 'white', margin: '0 0 6px' }}>
              {project.name}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>
                {industry.icon} {industry.name}
              </span>
              <span style={{ color: 'rgba(255,255,255,.2)' }}>·</span>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>{studyType.label}</span>
              <span style={{ color: 'rgba(255,255,255,.2)' }}>·</span>
              <span style={{
                fontSize: 11, background: BLUE + '22', color: 'rgba(100,160,255,.9)',
                borderRadius: 20, padding: '2px 9px', fontWeight: 600,
              }}>{project.platform || 'KoboToolbox'}</span>
              {project.target_submissions && (
                <>
                  <span style={{ color: 'rgba(255,255,255,.2)' }}>·</span>
                  <span style={{ fontSize: 13, color: 'rgba(255,255,255,.55)' }}>{project.target_submissions} target</span>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <ActionBtn label="Edit" />
            <button
              onClick={() => setShowDeleteModal(true)}
              style={{
                background: 'none', border: '1px solid rgba(220,38,38,.5)',
                color: RED, borderRadius: 7, padding: '7px 14px',
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              }}
            >Delete</button>
          </div>
        </div>
      </div>

      {/* Ada briefing */}
      {lc && (
        <div style={{
          background: 'linear-gradient(135deg, #0F1729 0%, #1a2544 100%)',
          borderRadius: 16, padding: '18px 20px', marginBottom: 20,
          display: 'flex', gap: 14, alignItems: 'flex-start',
          border: '1px solid rgba(36,99,235,.2)',
        }}>
          <img
            src="/ada-avatar.jpg"
            alt="Ada"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            style={{ width: 48, height: 48, borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
          />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.35)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
              Ada · Project Intelligence
            </div>
            <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,.8)', margin: '0 0 12px', lineHeight: 1.6 }}>
              {lc.ada_status}
            </p>
            <button
              style={{
                background: BLUE, color: 'white', border: 'none', borderRadius: 7,
                padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {lc.ada_next_action}
            </button>
          </div>
        </div>
      )}

      {/* Lifecycle stages */}
      {lc ? (
        <>
          {/* 1. Design */}
          <StageCard
            num={1} icon="📝" title="Design"
            status={lc.stages.design.status}
            accentColor={stageColor(lc.stages.design.status)}
            adaComment={lc.stages.design.status === 'complete' ? 'Questionnaire is ready.' : 'Configure your questionnaire before collecting data.'}
          >
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <ActionBtn label="View questionnaire" onClick={() => navigate(`/projects/${projectId}/design`)} />
              <ActionBtn label="Download XLSForm" />
            </div>
          </StageCard>

          {/* 2. Collect */}
          <StageCard
            num={2} icon="📡" title="Collect"
            status={lc.stages.collect.status}
            accentColor={stageColor(lc.stages.collect.status)}
            adaComment={lc.stages.collect.status === 'active'
              ? `${lc.stages.collect.total_received} submissions received (${lc.stages.collect.percent_complete}% of target).`
              : 'Connect your data collection platform to start receiving submissions.'}
          >
            {lc.stages.collect.status !== 'not_started' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                  <span>{lc.stages.collect.total_received} received</span>
                  <span>{lc.stages.collect.target || '—'} target</span>
                </div>
                <div style={{ height: 6, background: '#F0F4FF', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, background: BLUE,
                    width: `${Math.min(lc.stages.collect.percent_complete, 100)}%`,
                    transition: 'width .3s',
                  }} />
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <ActionBtn label="View all submissions" primary onClick={() => navigate(`/projects/${projectId}/collect`)} />
              <ActionBtn label="Check webhook" />
              <ActionBtn label="Add enumerators" />
            </div>
          </StageCard>

          {/* 3. Verify */}
          <StageCard
            num={3} icon="🔍" title="Verify"
            status={lc.stages.verify.flagged > 0 ? 'attention' : lc.stages.verify.status}
            accentColor={lc.stages.verify.flagged > 0 ? AMBER : stageColor(lc.stages.verify.status)}
            adaComment={lc.stages.verify.flagged > 0
              ? `${lc.stages.verify.flagged} submissions flagged — review before advancing.`
              : `${lc.stages.verify.passed} passed, ${lc.stages.verify.rejected} rejected. Trust score: ${lc.stages.verify.avg_trust_score}%.`}
          >
            {lc.stages.verify.status !== 'not_started' && (
              <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
                {[
                  { label: 'Passed', value: lc.stages.verify.passed, color: GREEN },
                  { label: 'Flagged', value: lc.stages.verify.flagged, color: AMBER },
                  { label: 'Rejected', value: lc.stages.verify.rejected, color: RED },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {lc.stages.verify.flagged > 0 && (
                <ActionBtn label={`Review flagged (${lc.stages.verify.flagged}) →`} primary onClick={() => navigate(`/projects/${projectId}/verify`)} />
              )}
              <ActionBtn label="View all" onClick={() => navigate(`/projects/${projectId}/verify`)} />
              <ActionBtn label="Enumerator performance" onClick={() => navigate(`/projects/${projectId}/verify/enumerators`)} />
            </div>
          </StageCard>

          {/* 4. Analyse */}
          <StageCard
            num={4} icon="✨" title="Analyse"
            status={lc.stages.analyse.status}
            accentColor={stageColor(lc.stages.analyse.status)}
            adaComment={lc.stages.analyse.can_start
              ? `${lc.stages.analyse.available} verified submissions ready. Ada can start analysing now.`
              : `Need ${lc.stages.analyse.minimum_required - lc.stages.analyse.available} more verified submissions to meet the minimum threshold.`}
          >
            <ActionBtn
              label={lc.stages.analyse.can_start ? 'Start analysis →' : `Need ${lc.stages.analyse.minimum_required} verified (${lc.stages.analyse.available} so far)`}
              primary={lc.stages.analyse.can_start}
              onClick={lc.stages.analyse.can_start ? () => navigate(`/projects/${projectId}/analyse`) : undefined}
            />
          </StageCard>

          {/* 5. Report */}
          <StageCard
            num={5} icon="📄" title="Report"
            status={lc.stages.report.status}
            accentColor={stageColor(lc.stages.report.status)}
            adaComment={lc.stages.report.can_start
              ? 'Analysis complete. Generate your final report.'
              : 'Complete the analysis stage first to unlock reporting.'}
          >
            {lc.stages.report.can_start ? (
              <div style={{ display: 'flex', gap: 10 }}>
                {lc.stages.report.available_formats.map(f => (
                  <ActionBtn key={f} label={`Generate .${f}`} primary onClick={() => navigate(`/projects/${projectId}/report`)} />
                ))}
              </div>
            ) : (
              <ActionBtn label="Locked — complete analysis first" />
            )}
          </StageCard>
        </>
      ) : (
        <div style={{ ...CARD, padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
          Loading lifecycle...
        </div>
      )}

      {/* Framework section */}
      <div style={{ ...CARD, padding: '16px 20px', marginTop: 8 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 2 }}>
              Research Framework <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span>
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF' }}>
              Ada aligns her analysis to your specific indicators.
            </div>
          </div>
          {project.framework_filename ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: GREEN }}>✓ {project.framework_filename}</span>
              <ActionBtn label="Replace" />
              <ActionBtn label="Remove" />
            </div>
          ) : (
            <button style={{
              border: '1.5px dashed #CBD5E1', background: 'none', borderRadius: 8,
              padding: '8px 14px', fontSize: 12, color: '#6B7280', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}>
              📄 Upload {studyType.framework_label}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
