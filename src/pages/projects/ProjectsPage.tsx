import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { projectsApi } from '../../services/api';
import { Project } from '../../context/ProjectContext';
import { getIndustry, getStudyType } from '../../context/ResearchContext';
import { verifyKoboToken } from '../../services/kobo/koboToolboxApi';
import HealthRing from '../../gamify/HealthRing';
import { useGamify } from '../../gamify/GamifyContext';
import { useAdaGreeting } from '../../hooks/useAdaGreeting';

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge status={status} />
          <HealthRing avgScore={project.avg_score} size={32} />
        </div>
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
          {typeof project.submission_count === 'number'
            ? `${project.submission_count} submission${project.submission_count === 1 ? '' : 's'}`
            : project.target_submissions ? `Target: ${project.target_submissions}` : 'No target set'}
        </span>
        <span style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>Open →</span>
      </div>
    </div>
  );
}

const KOBO_BASE = 'https://kf.kobotoolbox.org/api/v2';

interface KoboAssetItem { uid: string; name: string; deployment_count: number; summary: { row_count: number }; date_modified: string; }

type ImportPlatform = 'kobo' | 'odk' | 'surveycto' | 'csv' | null;
type ImportStep = 'platform' | 'auth' | 'pick' | 'importing' | 'done';

function ImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [platform, setPlatform] = useState<ImportPlatform>(null);
  const [step, setStep] = useState<ImportStep>('platform');
  const [token, setToken] = useState(localStorage.getItem('koboToken') || '');
  const [authError, setAuthError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [forms, setForms] = useState<KoboAssetItem[]>([]);
  const [loadingForms, setLoadingForms] = useState(false);
  const [selected, setSelected] = useState<KoboAssetItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  const PLATFORMS = [
    { id: 'kobo', label: 'KoboToolbox', icon: '🗂', desc: 'Import a form and its submissions', live: true },
    { id: 'odk', label: 'ODK Central', icon: '📱', desc: 'Coming soon', live: false },
    { id: 'surveycto', label: 'SurveyCTO', icon: '📋', desc: 'Coming soon', live: false },
    { id: 'csv', label: 'CSV / Excel', icon: '📊', desc: 'Upload a submission export', live: false },
  ] as const;

  const connectKobo = async () => {
    if (!token.trim()) return;
    setVerifying(true); setAuthError('');
    try {
      await verifyKoboToken(token.trim());
      localStorage.setItem('koboToken', token.trim());
      setLoadingForms(true); setStep('pick');
      const res = await fetch(`${KOBO_BASE}/assets/?asset_type=survey&limit=100`, {
        headers: { Authorization: `Token ${token.trim()}` },
      });
      const data = await res.json();
      setForms(data.results || []);
    } catch {
      setAuthError('Invalid token — check it in KoboToolbox → Account Settings → API Token');
    } finally {
      setVerifying(false); setLoadingForms(false);
    }
  };

  const { recordEvent } = useGamify();

  const importProject = async () => {
    if (!selected) return;
    setImporting(true); setImportError('');
    try {
      await projectsApi.create({
        name: selected.name,
        platform: 'kobo',
        kobo_asset_uid: selected.uid,
        target_submissions: selected.deployment_count || undefined,
      });
      recordEvent('project_created');
      setStep('done');
      setTimeout(() => { onImported(); onClose(); }, 1800);
    } catch {
      setImportError('Import failed — the project was created but submissions could not be synced. You can sync manually from the Collect stage.');
      setStep('done');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div ref={overlayRef} onClick={e => { if (e.target === overlayRef.current) onClose(); }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(8,13,26,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: 16 }}>
      <div style={{ background: 'white', borderRadius: 20, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,.25)', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>

        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#080D1A' }}>Import a project</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Bring in an existing project from your data collection platform</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4 }}>✕</button>
        </div>

        <div style={{ padding: 24 }}>

          {/* Step: pick platform */}
          {step === 'platform' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>Select platform</div>
              {PLATFORMS.map(p => (
                <button key={p.id} onClick={() => { if (!p.live) return; setPlatform(p.id); setStep('auth'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px', borderRadius: 12, border: `1px solid ${p.live ? '#E8EDF5' : '#F1F5F9'}`, background: p.live ? 'white' : '#FAFAFA', cursor: p.live ? 'pointer' : 'default', textAlign: 'left', transition: 'border .15s', opacity: p.live ? 1 : 0.55 }}
                  onMouseEnter={e => { if (p.live) (e.currentTarget as HTMLButtonElement).style.borderColor = BLUE; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = p.live ? '#E8EDF5' : '#F1F5F9'; }}
                >
                  <span style={{ fontSize: 26 }}>{p.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: p.live ? '#080D1A' : '#9CA3AF' }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{p.desc}</div>
                  </div>
                  {p.live
                    ? <span style={{ fontSize: 12, color: BLUE, fontWeight: 600 }}>→</span>
                    : <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#F1F5F9', color: '#9CA3AF' }}>SOON</span>}
                </button>
              ))}
            </div>
          )}

          {/* Step: auth (KoboToolbox token) */}
          {step === 'auth' && platform === 'kobo' && (
            <div>
              <button onClick={() => setStep('platform')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 12, padding: '0 0 16px', display: 'flex', alignItems: 'center', gap: 4 }}>← Back</button>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#080D1A', marginBottom: 4 }}>Connect KoboToolbox</div>
              <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 18, lineHeight: 1.6 }}>
                Paste your API token from KoboToolbox. Find it at: <strong>Account Settings → API Token</strong> on kf.kobotoolbox.org
              </div>
              <input
                autoFocus value={token} onChange={e => setToken(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && connectKobo()}
                placeholder="KoboToolbox API token"
                style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', borderRadius: 8, border: `1px solid ${authError ? '#FCA5A5' : '#E2E8F0'}`, fontSize: 13, fontFamily: 'monospace', color: '#111827', outline: 'none', marginBottom: 8 }}
              />
              {authError && <div style={{ fontSize: 12, color: '#DC2626', marginBottom: 12 }}>{authError}</div>}
              <button onClick={connectKobo} disabled={!token.trim() || verifying}
                style={{ width: '100%', padding: '11px', borderRadius: 8, background: token.trim() ? BLUE : '#E2E8F0', border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: token.trim() ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif' }}>
                {verifying ? 'Connecting…' : 'Connect →'}
              </button>
            </div>
          )}

          {/* Step: pick form */}
          {step === 'pick' && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#080D1A', marginBottom: 4 }}>Select a project to import</div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 16 }}>{forms.length} forms found in your KoboToolbox account</div>
              {loadingForms ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>Loading your forms…</div>
              ) : (
                <div style={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
                  {forms.length === 0 && <div style={{ padding: 32, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No deployed forms found in this account.</div>}
                  {forms.map(f => (
                    <button key={f.uid} onClick={() => setSelected(f)}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1px solid ${selected?.uid === f.uid ? BLUE : '#E8EDF5'}`, background: selected?.uid === f.uid ? '#EFF6FF' : 'white', cursor: 'pointer', textAlign: 'left' }}>
                      <span style={{ fontSize: 20 }}>🗂</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#080D1A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.name}</div>
                        <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{f.deployment_count} submissions · {f.summary?.row_count || 0} questions</div>
                      </div>
                      {selected?.uid === f.uid && <span style={{ color: BLUE, fontSize: 16 }}>✓</span>}
                    </button>
                  ))}
                </div>
              )}
              {importError && <div style={{ fontSize: 12, color: '#D97706', marginBottom: 10, padding: '8px 12px', background: '#FFFBEB', borderRadius: 8 }}>{importError}</div>}
              <button onClick={importProject} disabled={!selected || importing}
                style={{ width: '100%', padding: '11px', borderRadius: 8, background: selected ? BLUE : '#E2E8F0', border: 'none', color: 'white', fontSize: 13, fontWeight: 600, cursor: selected ? 'pointer' : 'default', fontFamily: 'Inter, sans-serif' }}>
                {importing ? 'Importing…' : selected ? `Import "${selected.name}"` : 'Select a project above'}
              </button>
            </div>
          )}

          {/* Step: done */}
          {step === 'done' && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#080D1A', marginBottom: 6 }}>Project imported</div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Opening your project…</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CleanupModal({ emptyProjects, onClose, onDone }: { emptyProjects: Project[]; onClose: () => void; onDone: () => void }) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(emptyProjects.map(p => p.id)));
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const toggle = (id: string) => setChecked(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const confirm = async () => {
    setDeleting(true);
    setError('');
    try {
      const ids = Array.from(checked);
      const results = await Promise.allSettled(ids.map(id => projectsApi.delete(id, true)));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed > 0) setError(`${failed} project${failed === 1 ? '' : 's'} could not be deleted — please retry.`);
      onDone();
      if (failed === 0) onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(8,13,26,.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ ...CARD_STYLE, width: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8EDF5' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#080D1A' }}>Clean up empty projects</div>
          <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 4 }}>
            These {emptyProjects.length} project{emptyProjects.length === 1 ? '' : 's'} have 0 submissions — most are
            leftovers from a retried upload that created a duplicate. Review the list, uncheck anything you want to
            keep, then delete. Projects with real data are never shown here.
          </div>
        </div>
        <div style={{ overflowY: 'auto', padding: '8px 24px', flex: 1 }}>
          {emptyProjects.map(p => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #F1F5F9', cursor: 'pointer' }}>
              <input type="checkbox" checked={checked.has(p.id)} onChange={() => toggle(p.id)} style={{ width: 16, height: 16, flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#080D1A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>{p.platform || 'kobo'} · created {p.created_at ? new Date(p.created_at).toLocaleDateString() : 'unknown'}</div>
              </div>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '2px 8px', borderRadius: 20 }}>0 submissions</span>
            </label>
          ))}
        </div>
        {error && (
          <div style={{ margin: '0 24px', padding: '10px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, fontSize: 12.5, color: '#DC2626' }}>{error}</div>
        )}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #E8EDF5', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} disabled={deleting} style={{ padding: '9px 16px', borderRadius: 8, border: '1px solid #E2E8F0', background: 'white', color: '#6B7280', fontSize: 13, fontWeight: 600, cursor: deleting ? 'default' : 'pointer', fontFamily: 'Inter, sans-serif' }}>
            Cancel
          </button>
          <button onClick={confirm} disabled={deleting || checked.size === 0} style={{ padding: '9px 16px', borderRadius: 8, border: 'none', background: '#DC2626', color: 'white', fontSize: 13, fontWeight: 600, cursor: deleting || checked.size === 0 ? 'default' : 'pointer', opacity: deleting || checked.size === 0 ? 0.6 : 1, fontFamily: 'Inter, sans-serif' }}>
            {deleting ? 'Deleting…' : `Delete ${checked.size} project${checked.size === 1 ? '' : 's'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProjectsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [showCleanup, setShowCleanup] = useState(false);

  const loadProjects = () => {
    projectsApi.list()
      .then(r => setProjects(r.data.projects || []))
      .catch(() => { setProjects([]); console.error('Failed to load projects'); })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadProjects(); }, []);

  // Keep the rewards counter in step with reality so long-standing orgs get
  // their project milestones recognised, not just newly created ones.
  const { counters, recordEvent } = useGamify();
  useAdaGreeting({ page: "projects", delay: 1500 });
  useEffect(() => {
    const diff = projects.length - (counters.project_created || 0);
    if (diff > 0) recordEvent('project_created', diff);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects.length]);

  const projectCount = projects.length;
  const collectingCount = projects.filter(p => p.status === 'collect').length;
  const attentionCount = projects.filter(p => p.status === 'verify').length;
  const emptyProjects = projects.filter(p => p.submission_count === 0);

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
      {showImport && <ImportModal onClose={() => setShowImport(false)} onImported={() => { setLoading(true); loadProjects(); }} />}
      {showCleanup && (
        <CleanupModal
          emptyProjects={emptyProjects}
          onClose={() => setShowCleanup(false)}
          onDone={loadProjects}
        />
      )}
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
        <div style={{ display: 'flex', gap: 8 }}>
          {emptyProjects.length > 0 && (
            <button
              onClick={() => setShowCleanup(true)}
              title={`${emptyProjects.length} project(s) with 0 submissions`}
              style={{
                background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'Inter, sans-serif',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              🧹 Clean up ({emptyProjects.length})
            </button>
          )}
          <button
            onClick={() => setShowImport(true)}
            style={{
              background: 'white', color: '#374151', border: '1px solid #E2E8F0',
              borderRadius: 8, padding: '9px 18px', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            ↓ Import
          </button>
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
