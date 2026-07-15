import React, { useState, useEffect, useRef } from 'react';
import { Bell, HelpCircle, Search, RefreshCw, Gift, Menu, ChevronDown, Check, FolderOpen } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGamify } from '../../gamify/GamifyContext';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useProject } from '../../context/ProjectContext';
import type { Project } from '../../context/ProjectContext';
import { projectsApi } from '../../services/api';

const PAGE_LABELS: Record<string, string> = {
  overview: 'Overview',
  submissions: 'Submissions',
  enumerators: 'Enumerators',
  map: 'Coverage Map',
  insights: 'AI Analysis',
  reports: 'Reports',
  integrations: 'Integrations',
  settings: 'Settings',
};

interface TopbarProps {
  onRefresh?: () => void;
  onMenuToggle?: () => void;
}

// Clickable project switcher — shows the active project, opens a dropdown of
// all projects, and switches the whole workspace scope on selection.
function ProjectSwitcher({ orgName }: { orgName?: string }) {
  const { activeProject, setActiveProject, clearActiveProject } = useProject();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && projects.length === 0) {
      setLoading(true);
      projectsApi.list()
        .then(r => { const d = r.data; setProjects(Array.isArray(d) ? d : Array.isArray(d?.projects) ? d.projects : []); })
        .catch(() => setProjects([]))
        .finally(() => setLoading(false));
    }
  };

  const pick = (p: Project) => {
    setActiveProject(p.id);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={toggle}
        title="Switch project"
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: '#F0F4FF', border: `1px solid ${open ? '#2463EB' : '#E2E8F0'}`,
          borderRadius: 7, padding: '5px 10px', fontSize: 12.5,
          fontWeight: 600, color: '#080D1A', cursor: 'pointer',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
        <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeProject?.name || 'All projects'}
        </span>
        <ChevronDown size={12} color="#9CA3AF" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 1000,
          minWidth: 240, background: 'white', borderRadius: 10,
          border: '1px solid #E2E8F0', boxShadow: '0 8px 28px rgba(10,15,28,.14)',
          padding: 6, maxHeight: 320, overflowY: 'auto',
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.7, padding: '6px 10px 4px' }}>
            Switch project
          </div>
          {/* All projects — org-wide view */}
          <button onClick={() => { clearActiveProject(); setOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%',
              padding: '8px 10px', borderRadius: 7, border: 'none',
              background: !activeProject ? '#EFF6FF' : 'transparent', cursor: 'pointer',
              fontFamily: 'Inter, sans-serif', textAlign: 'left',
            }}
            onMouseEnter={e => { if (activeProject) (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFF'; }}
            onMouseLeave={e => { if (activeProject) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <FolderOpen size={13} color={!activeProject ? '#2463EB' : '#9CA3AF'} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: !activeProject ? '#2463EB' : '#111827' }}>All projects</div>
              <div style={{ fontSize: 10.5, color: '#9CA3AF' }}>Combined view across every project</div>
            </div>
            {!activeProject && <Check size={13} color="#2463EB" style={{ flexShrink: 0 }} />}
          </button>
          {loading && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#9CA3AF' }}>Loading projects…</div>
          )}
          {!loading && projects.length === 0 && (
            <div style={{ padding: '10px 12px', fontSize: 12, color: '#9CA3AF' }}>No projects found.</div>
          )}
          {!loading && projects.map(p => {
            const isActive = p.id === activeProject?.id;
            return (
              <button key={p.id} onClick={() => pick(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                  padding: '8px 10px', borderRadius: 7, border: 'none',
                  background: isActive ? '#EFF6FF' : 'transparent', cursor: 'pointer',
                  fontFamily: 'Inter, sans-serif', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = '#F8FAFF'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
              >
                <FolderOpen size={13} color={isActive ? '#2463EB' : '#9CA3AF'} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: isActive ? '#2463EB' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.name}
                  </div>
                  {p.status && <div style={{ fontSize: 10.5, color: '#9CA3AF', textTransform: 'capitalize' }}>{p.status}</div>}
                </div>
                {isActive && <Check size={13} color="#2463EB" style={{ flexShrink: 0 }} />}
              </button>
            );
          })}
          <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 4, paddingTop: 4 }}>
            <button onClick={() => { setOpen(false); navigate('/projects'); }}
              style={{
                width: '100%', padding: '7px 10px', borderRadius: 7, border: 'none',
                background: 'transparent', cursor: 'pointer', fontSize: 12,
                color: '#2463EB', fontWeight: 600, fontFamily: 'Inter, sans-serif', textAlign: 'left',
              }}>
              Manage projects →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Topbar({ onRefresh, onMenuToggle }: TopbarProps) {
  const { user, org } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState('');
  const { creditsBalance } = useGamify();
  const isMobile = useIsMobile(820);

  const pageName = PAGE_LABELS[location.pathname.replace('/', '')] || 'Overview';

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Global search: navigate to submissions filtered by the query
    if (searchVal.trim()) {
      navigate(`/submissions?q=${encodeURIComponent(searchVal.trim())}`);
    }
  };

  return (
    <header style={{
      height: 52, background: 'white', borderBottom: '1px solid #E2E8F0',
      display: 'flex', alignItems: 'center', padding: '0 16px', gap: isMobile ? 8 : 12,
      flexShrink: 0,
    }}>
      {/* Hamburger — mobile only */}
      {onMenuToggle && (
        <button
          onClick={onMenuToggle}
          style={{
            width: 36, height: 36, borderRadius: 8, border: '1px solid #E2E8F0',
            background: 'transparent', display: 'grid', placeItems: 'center',
            cursor: 'pointer', color: '#374151', flexShrink: 0,
          }}
          aria-label="Open menu"
        >
          <Menu size={17} />
        </button>
      )}

      {/* Project switcher — hide on very small mobile to save space */}
      {!isMobile && <ProjectSwitcher orgName={org?.name} />}

      {/* Search */}
      <form onSubmit={handleSearch} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#F0F4FF', border: '1px solid #E2E8F0',
        borderRadius: 8, padding: '6px 12px', flex: 1, maxWidth: isMobile ? '100%' : 340,
      }}>
        <Search size={13} color="#9CA3AF" />
        <input
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          placeholder="Search submissions…"
          maxLength={200}
          style={{
            border: 'none', background: 'transparent', fontSize: 12.5,
            fontFamily: 'Inter, sans-serif', color: '#080D1A', outline: 'none', flex: 1,
          }}
        />
        {!isMobile && <span style={{
          fontSize: 10, fontFamily: 'monospace', color: '#CBD5E1',
          background: '#EEF2F8', border: '1px solid #E2E8F0',
          borderRadius: 4, padding: '1px 5px',
        }}>⌘K</span>}
      </form>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexShrink: 0 }}>
        {/* Rewards credit — ambient, only visible once credits exist */}
        {creditsBalance > 0 && (
          <button
            onClick={() => navigate('/settings', { state: { section: 'billing' } })}
            title={`₦${creditsBalance.toLocaleString()} rewards credit — applied to your next payment`}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 7,
              padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: '#059669',
              cursor: 'pointer', fontFamily: 'Inter, sans-serif',
            }}
          >
            <Gift size={12} />
            ₦{creditsBalance.toLocaleString()}
          </button>
        )}
        {/* Refresh — only shown on pages with live data */}
        {onRefresh && (
          <button
            onClick={onRefresh}
            title={`Refresh ${pageName}`}
            style={{
              width: 30, height: 30, borderRadius: 7, border: '1px solid #E2E8F0',
              background: 'transparent', display: 'grid', placeItems: 'center',
              cursor: 'pointer', color: '#6B7280',
            }}
          >
            <RefreshCw size={13} />
          </button>
        )}

        {/* Notifications + Help — hidden on mobile to keep topbar clean */}
        {!isMobile && <>
          <button
            style={{
              width: 30, height: 30, borderRadius: 7, border: '1px solid #E2E8F0',
              background: 'transparent', display: 'grid', placeItems: 'center',
              cursor: 'pointer', color: '#6B7280', position: 'relative',
            }}
            title="Notifications"
          >
            <Bell size={13} />
            {(org?.status === 'trial' || org?.status === 'expired') && (
              <span style={{
                position: 'absolute', top: 4, right: 4, width: 6, height: 6,
                borderRadius: '50%', background: org.status === 'expired' ? '#DC2626' : '#D97706',
                border: '1px solid white',
              }} />
            )}
          </button>

          <button
            onClick={() => window.open('https://researchos.notion.site', '_blank')}
            style={{
              width: 30, height: 30, borderRadius: 7, border: '1px solid #E2E8F0',
              background: 'transparent', display: 'grid', placeItems: 'center',
              cursor: 'pointer', color: '#6B7280',
            }} title="Help & Documentation">
            <HelpCircle size={13} />
          </button>
        </>}

        {/* Avatar */}
        <div
          title={user?.name || 'User'}
          style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'linear-gradient(135deg,#2463EB,#7C3AED)',
            display: 'grid', placeItems: 'center',
            fontSize: 10, fontWeight: 700, color: 'white', cursor: 'default',
          }}
        >
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      </div>
    </header>
  );
}
