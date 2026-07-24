import React from 'react';
import { NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useAda } from '../../ada/AdaContext';
import { useProject } from '../../context/ProjectContext';
import { Settings, LogOut, ChevronLeft, LayoutDashboard, FileText, Users, Map, Sparkles, BookOpen, Puzzle, CreditCard, X } from 'lucide-react';
import FieldScoreLogo from '../brand/FieldScoreLogo';
import BuildInfoBadge from './BuildInfoBadge';
import { useVerifiedReadyCount } from '../../hooks/useVerifiedReadyCount';

interface SidebarProps { onClose?: () => void; }

const BLUE = '#2463EB';

const BROWSE_NAV = [
  { label: 'WORKSPACE', items: [
    { to: '/overview',    icon: LayoutDashboard, label: 'Overview' },
    { to: '/projects',    icon: BookOpen,         label: 'Projects' },
    { to: '/submissions', icon: FileText,         label: 'Submissions' },
    { to: '/enumerators', icon: Users,            label: 'Enumerators' },
    { to: '/map',         icon: Map,              label: 'Coverage Map' },
  ]},
  { label: 'INTELLIGENCE', items: [
    { to: '/insights',    icon: Sparkles,         label: 'AI Analysis' },
    { to: '/reports',     icon: BookOpen,         label: 'Reports' },
  ]},
  { label: 'ACCOUNT', items: [
    { to: '/integrations', icon: Puzzle,          label: 'Integrations' },
    { to: '/settings',     icon: Settings,        label: 'Settings' },
  ]},
];

// A client (an agency's external, read-only guest, scoped server-side to
// specific projects — see project_access in fieldscore-backend) never even
// gets a link to raw submissions, enumerators, the map, integrations,
// settings, or billing. Every one of those is also 403'd server-side if
// hit directly, so this is a UX nicety on top of the real enforcement, not
// the enforcement itself.
const CLIENT_WORKSPACE_ITEMS = new Set(['Overview', 'Projects']);
const CLIENT_HIDDEN_SECTIONS = new Set(['ACCOUNT']);

export default function Sidebar({ onClose }: SidebarProps) {
  const { user, org, logout } = useAuth();
  const { navigatePage } = useAda();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId?: string }>();
  const { activeProject, lifecycle } = useProject();

  const isProjectMode = !!projectId && projectId !== 'new' && (
    location.pathname === `/projects/${projectId}` ||
    location.pathname.startsWith(`/projects/${projectId}/`)
  );

  const stageOrder = ['design', 'collect', 'verify', 'analyse', 'report'];
  const getStageIcon = (stage: string): string => {
    if (!lifecycle) return '○';
    const s = lifecycle.stages[stage as keyof typeof lifecycle.stages];
    if (!s) return '○';
    const status = s.status;
    if (status === 'complete') return '✅';
    if (status === 'active') return '🔵';
    if (stage === 'verify' && lifecycle.stages.verify.flagged > 0) return '⚠️';
    return '○';
  };

  const flaggedCount = lifecycle?.stages?.verify?.flagged || 0;
  // Proactive surfacing (CallScore Bible 1.4): AI Analysis badges itself
  // when freshly-verified interviews are waiting, from either capture mode.
  const verifiedReady = useVerifiedReadyCount();
  const isClient = user?.role === 'client';
  const visibleNav = BROWSE_NAV
    .filter(section => !isClient || !CLIENT_HIDDEN_SECTIONS.has(section.label))
    .map(section => ({
      ...section,
      items: isClient && section.label === 'WORKSPACE'
        ? section.items.filter(item => CLIENT_WORKSPACE_ITEMS.has(item.label))
        : section.items,
    }));

  return (
    <aside style={{
      width: 220, background: '#080D1A', display: 'flex',
      flexDirection: 'column', flexShrink: 0, overflow: 'hidden', height: '100%',
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 16px', borderBottom: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <FieldScoreLogo height={17} mode="dark" casing="#080D1A" sub="ResearchOS" />
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.4)', padding: 4, display: 'grid', placeItems: 'center', borderRadius: 5 }}>
            <X size={15} />
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {isProjectMode ? (
          /* ── PROJECT MODE ── */
          <>
            {/* Back to projects */}
            <button
              onClick={() => navigate('/projects')}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,.4)', fontSize: 11, fontFamily: 'Inter, sans-serif',
                padding: '6px 8px', borderRadius: 6, marginBottom: 8, textAlign: 'left',
              }}
            >
              <ChevronLeft size={12} />
              Projects
            </button>

            {/* Project name */}
            <div style={{
              padding: '6px 8px', marginBottom: 4,
              fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.55)',
              letterSpacing: 0.8, textTransform: 'uppercase',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {activeProject?.name || 'Loading...'}
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '6px 8px 10px' }} />

            {/* Stage nav */}
            {stageOrder.map((stage, i) => {
              const icon = getStageIcon(stage);
              const label = stage.charAt(0).toUpperCase() + stage.slice(1);

              return (
                <NavLink
                  key={stage}
                  to={`/projects/${projectId}/${stage}`}
                  style={({ isActive: stageActive }) => ({
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '7px 10px', borderRadius: 7, marginBottom: 1,
                    color: stageActive ? 'white' : 'rgba(255,255,255,.42)',
                    background: stageActive ? 'rgba(37,99,235,.22)' : 'transparent',
                    textDecoration: 'none', fontSize: 12.5, fontWeight: 500,
                    borderLeft: stageActive ? `2px solid ${BLUE}` : '2px solid transparent',
                  })}
                >
                  <span>{i + 1} {label}</span>
                  <span style={{ fontSize: 11 }}>
                    {stage === 'verify' && flaggedCount > 0 ? `⚠️ ${flaggedCount}` : icon}
                  </span>
                </NavLink>
              );
            })}

            <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '10px 8px' }} />

            {/* Framework + project settings */}
            <button
              onClick={() => navigate(`/projects/${projectId}`)}
              title="View project overview and research framework"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,.35)', fontSize: 12, fontFamily: 'Inter, sans-serif',
                padding: '6px 10px', borderRadius: 6,
              }}
            >
              Project Overview
              <span style={{ fontSize: 14 }}>↗</span>
            </button>
            {!isClient && (
              <button
                onClick={() => navigate('/settings')}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,255,255,.35)', fontSize: 12, fontFamily: 'Inter, sans-serif',
                  padding: '6px 10px', borderRadius: 6, textAlign: 'left',
                }}
              >
                Project Settings
              </button>
            )}
          </>
        ) : (
          /* ── BROWSING MODE ── */
          <>
            {visibleNav.map(section => (
              <div key={section.label} style={{ marginBottom: 8 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.2)',
                  letterSpacing: 1.1, textTransform: 'uppercase',
                  padding: '0 8px', marginBottom: 4,
                }}>{section.label}</div>
                {section.items.map(item => (
                  <NavLink
                    key={item.label}
                    to={item.to}
                    onClick={() => navigatePage(item.to.replace('/', ''))}
                    style={({ isActive }) => ({
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '7px 10px', borderRadius: 7, marginBottom: 1,
                      color: isActive ? 'white' : 'rgba(255,255,255,.42)',
                      background: isActive ? 'rgba(37,99,235,.22)' : 'transparent',
                      textDecoration: 'none', fontSize: 12.5, fontWeight: 500,
                      borderLeft: isActive ? `2px solid ${BLUE}` : '2px solid transparent',
                    })}
                  >
                    <item.icon size={14} style={{ flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.to === '/insights' && verifiedReady > 0 && (
                      <span
                        title={`${verifiedReady} new verified interview${verifiedReady === 1 ? '' : 's'} ready to analyze`}
                        style={{
                          fontSize: 10, fontWeight: 700, color: 'white',
                          background: BLUE, borderRadius: 999,
                          padding: '1px 7px', flexShrink: 0,
                        }}
                      >
                        {verifiedReady > 99 ? '99+' : verifiedReady}
                      </span>
                    )}
                  </NavLink>
                ))}
                {section.label === 'ACCOUNT' && !isClient && (
                  <button
                    onClick={() => navigate('/settings', { state: { section: 'billing' } })}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '7px 10px', borderRadius: 7, marginBottom: 1,
                      color: 'rgba(255,255,255,.42)', background: 'transparent',
                      border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 500,
                      fontFamily: 'Inter, sans-serif', textAlign: 'left',
                      borderLeft: '2px solid transparent',
                    }}
                  >
                    <CreditCard size={14} style={{ flexShrink: 0 }} />
                    Billing
                  </button>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* User */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 7 }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg,#2463EB,#7C3AED)',
            display: 'grid', placeItems: 'center',
            fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
          }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.7)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>{org?.name || 'Organisation'}</div>
          </div>
          <button onClick={logout} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,.3)', padding: 4, borderRadius: 4, display: 'grid', placeItems: 'center' }} title="Logout">
            <LogOut size={13} />
          </button>
        </div>
      </div>
      <BuildInfoBadge />
    </aside>
  );
}
