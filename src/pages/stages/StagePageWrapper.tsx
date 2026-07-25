/**
 * The shared chrome for all five lifecycle stages — one system, one look.
 * Renders breadcrumb → lifecycle stepper → stage header → Ada strip →
 * stage content. Stage identity (icon, label, accent) comes from the
 * STAGES manifest in styles/tokens.ts; never redeclare it per page.
 */
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '../../context/ProjectContext';
import {
  COLORS, MODE_META, STAGES, StageId, stageDef,
} from '../../styles/tokens';

interface StagePageWrapperProps {
  stage: StageId | string; // legacy callers pass "Design" etc.
  icon?: string;           // legacy prop, ignored — manifest owns icons
  /** For pages that bring their own header/tabs (Analyse): keep the
      stepper + Ada strip but skip the big stage header. */
  chromeless?: boolean;
  children: React.ReactNode;
}

const STATUS_DONE = new Set(['complete', 'completed', 'done']);

export default function StagePageWrapper({ stage, chromeless, children }: StagePageWrapperProps) {
  const { projectId } = useParams<{ projectId: string }>();
  const { activeProject, lifecycle } = useProject();
  const navigate = useNavigate();
  const projectName = activeProject?.name || 'Project';

  const stageId = (typeof stage === 'string' ? stage.toLowerCase() : stage) as StageId;
  const def = stageDef(stageId) || STAGES[0];
  const mode = activeProject?.collection_mode || 'field';
  const modeMeta = MODE_META[mode] || MODE_META.field;

  // Mode-aware blurb for the stages where the mode changes what the user does
  const blurb =
    def.id === 'collect'
      ? mode === 'call'
        ? 'Remote interviews — captured by the CallScore app, verified by AI.'
        : mode === 'hybrid'
          ? 'Field and remote interviews, one project, one dashboard.'
          : 'In-person submissions from your enumerators in the field.'
      : def.id === 'verify'
        ? mode === 'call'
          ? 'Every remote interview scored by the verification engine — evidence-backed, explainable.'
          : mode === 'hybrid'
            ? 'One verification engine across field and call — same verdicts, same evidence standard.'
            : 'Every submission scored by the verification engine — evidence-backed, explainable.'
        : def.blurb;

  // Ada's contextual line for this stage: prefer the lifecycle stage
  // summary the backend already writes; fall back to the project-level
  // next action when it's the active stage.
  const stageState: any = lifecycle?.stages?.[def.id as keyof typeof lifecycle.stages];
  const isActiveStage = stageState?.status === 'active';
  const adaLine: string | null =
    (stageState?.summary && String(stageState.summary)) ||
    (isActiveStage && lifecycle?.ada_next_action ? lifecycle.ada_next_action : null);

  const stageStatusIcon = (id: StageId): React.ReactNode => {
    const s: any = lifecycle?.stages?.[id as keyof typeof lifecycle.stages];
    if (s && STATUS_DONE.has(s.status)) return '✓';
    return String(stageDef(id).num);
  };

  return (
    <div style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Breadcrumb */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.muted, marginBottom: 14 }}>
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
        <span style={{ color: def.accent, fontWeight: 600 }}>{def.icon} {def.label}</span>
        <span style={{
          marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: '#6B7280',
          background: '#F3F4F6', border: '1px solid #E5E7EB', borderRadius: 999,
          padding: '3px 10px', whiteSpace: 'nowrap',
        }}>
          {modeMeta.icon} {modeMeta.label} · {modeMeta.engine}
        </span>
      </div>

      {/* Lifecycle stepper — the same five stages on every stage page */}
      <div style={{
        display: 'flex', alignItems: 'center', marginBottom: chromeless ? 18 : 22,
        background: 'white', border: `1px solid ${COLORS.line}`, borderRadius: 12,
        padding: '10px 14px', overflowX: 'auto',
      }}>
        {STAGES.map((s, i) => {
          const isCurrent = s.id === def.id;
          const st: any = lifecycle?.stages?.[s.id as keyof typeof lifecycle.stages];
          const done = st && STATUS_DONE.has(st.status);
          const color = isCurrent ? s.accent : done ? COLORS.green : COLORS.muted;
          return (
            <React.Fragment key={s.id}>
              {i > 0 && (
                <div style={{ flex: 1, minWidth: 14, height: 1.5, background: done || isCurrent ? '#D3DCEC' : '#EDF1F7', margin: '0 8px' }} />
              )}
              <button
                onClick={() => navigate(`/projects/${projectId}/${s.id}`)}
                title={s.blurb}
                style={{
                  display: 'flex', alignItems: 'center', gap: 7, background: 'none',
                  border: 'none', cursor: 'pointer', padding: '2px 2px',
                  fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                }}
              >
                <span style={{
                  width: 22, height: 22, borderRadius: '50%', fontSize: 11, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: isCurrent ? s.accent : done ? '#E7F6EF' : '#F3F4F6',
                  color: isCurrent ? 'white' : done ? COLORS.green : COLORS.muted,
                  transition: 'all 220ms ease',
                }}>
                  {stageStatusIcon(s.id)}
                </span>
                <span style={{ fontSize: 12, fontWeight: isCurrent ? 700 : 500, color }}>
                  {s.label}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {!chromeless && (
        <div style={{ marginBottom: 6 }}>
          <h1 style={{
            fontSize: 22, fontWeight: 800, color: COLORS.ink, margin: 0,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span>{def.icon}</span> {def.label}
          </h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>{blurb}</p>
          <div style={{ width: 44, height: 3, borderRadius: 2, background: def.accent, margin: '12px 0 18px' }} />
        </div>
      )}

      {/* Ada's contextual line — she is present on every stage, not just
          in the floating dock (constitution 04: Ada proactively surfaces). */}
      {adaLine && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 18,
          background: 'linear-gradient(135deg,#F5F8FF 0%,#F8F7FF 100%)',
          border: '1px solid #E3EAFB', borderRadius: 12, padding: '11px 14px',
        }}>
          <span style={{
            width: 26, height: 26, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
            background: 'linear-gradient(135deg,#2463EB,#7C3AED)', color: 'white',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, position: 'relative',
          }}>
            A
            <img
              src="/ada-avatar.jpg" alt=""
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              style={{ position: 'absolute', inset: 0, width: 26, height: 26, objectFit: 'cover' }}
            />
          </span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#7C89B0', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 }}>
              Ada · {def.label}
            </div>
            <div style={{ fontSize: 13, color: '#1F2937', lineHeight: 1.45 }}>{adaLine}</div>
          </div>
        </div>
      )}

      {children}
    </div>
  );
}
