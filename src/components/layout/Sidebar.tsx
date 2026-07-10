import React from 'react';
import { NavLink, useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useAda } from '../../ada/AdaContext';
import { useProject } from '../../context/ProjectContext';
import { Settings, LogOut, ChevronLeft } from 'lucide-react';

const BLUE = '#2463EB';

export default function Sidebar() {
  const { user, org, logout } = useAuth();
  const { navigatePage } = useAda();
  const navigate = useNavigate();
  const location = useLocation();
  const { projectId } = useParams<{ projectId?: string }>();
  const { activeProject, lifecycle } = useProject();

  const isProjectMode = !!projectId && location.pathname.startsWith('/projects/') && projectId !== 'new';

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

  return (
    <aside style={{
      width: 220, background: '#080D1A', display: 'flex',
      flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '18px 16px', borderBottom: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 32, height: 32, background: BLUE, borderRadius: 8,
          display: 'grid', placeItems: 'center', fontSize: 12,
          fontWeight: 800, color: 'white', flexShrink: 0,
        }}>FS</div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: -0.3 }}>
            FieldScore
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.28)', letterSpacing: 1, textTransform: 'uppercase' }}>
            ResearchOS
          </div>
        </div>
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
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(255,255,255,.35)', fontSize: 12, fontFamily: 'Inter, sans-serif',
                padding: '6px 10px', borderRadius: 6,
              }}
            >
              Framework
              <span style={{ fontSize: 14 }}>+</span>
            </button>
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
          </>
        ) : (
          /* ── BROWSING MODE ── */
          <>
            <NavLink
              to="/projects"
              onClick={() => navigatePage('projects')}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 7, marginBottom: 1,
                color: isActive ? 'white' : 'rgba(255,255,255,.42)',
                background: isActive ? 'rgba(37,99,235,.22)' : 'transparent',
                textDecoration: 'none', fontSize: 12.5, fontWeight: 500,
                borderLeft: isActive ? `2px solid ${BLUE}` : '2px solid transparent',
              })}
            >
              All Projects
            </NavLink>

            <div style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '8px 8px' }} />

            <NavLink
              to="/settings"
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 10px', borderRadius: 7, marginBottom: 1,
                color: isActive ? 'white' : 'rgba(255,255,255,.42)',
                background: isActive ? 'rgba(37,99,235,.22)' : 'transparent',
                textDecoration: 'none', fontSize: 12.5, fontWeight: 500,
                borderLeft: isActive ? `2px solid ${BLUE}` : '2px solid transparent',
              })}
            >
              <Settings size={14} /> Settings
            </NavLink>
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
    </aside>
  );
}
