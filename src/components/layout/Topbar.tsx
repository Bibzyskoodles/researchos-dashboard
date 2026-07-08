import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, HelpCircle, Search } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { dashboardApi } from '../../services/api';

const BLUE = '#2463EB', RED = '#DC2626', AMBER = '#D97706', GREEN = '#059669';

interface Sub {
  submission_id: string; enumerator_id: string; verdict: string;
  overall_score: number; project_id?: string;
}

const pill: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, background: '#F0F4FF', border: '1px solid #E2E8F0', borderRadius: 7, padding: '5px 10px', fontSize: 12.5, fontWeight: 600, color: '#080D1A', cursor: 'pointer' };
const dropdown: React.CSSProperties = { position: 'absolute', top: 'calc(100% + 6px)', background: 'white', border: '1px solid #E8EDF5', borderRadius: 10, boxShadow: '0 8px 28px rgba(10,15,28,.12)', zIndex: 3000, overflow: 'hidden', maxHeight: 340, overflowY: 'auto' };
const item: React.CSSProperties = { padding: '9px 12px', fontSize: 12.5, color: '#374151', cursor: 'pointer', borderBottom: '1px solid #F5F7FB', whiteSpace: 'nowrap' };
const muted: React.CSSProperties = { padding: '12px', fontSize: 12, color: '#9CA3AF', textAlign: 'center' };
const iconBtn: React.CSSProperties = { position: 'relative', width: 30, height: 30, borderRadius: 7, border: '1px solid #E2E8F0', background: 'transparent', display: 'grid', placeItems: 'center', cursor: 'pointer', color: '#6B7280' };

export default function Topbar() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [query, setQuery] = useState('');
  const [openSearch, setOpenSearch] = useState(false);
  const [openBell, setOpenBell] = useState(false);
  const [openProj, setOpenProj] = useState(false);
  const [openUser, setOpenUser] = useState(false);
  const [project, setProject] = useState('All Projects');
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    dashboardApi.getSubmissions({ limit: 200 })
      .then(r => setSubs(r.data?.submissions || []))
      .catch(() => { /* topbar stays functional but empty */ });
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenSearch(false); setOpenBell(false); setOpenProj(false); setOpenUser(false);
      }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return subs.filter(s =>
      (s.submission_id || '').toLowerCase().includes(q) ||
      (s.enumerator_id || '').toLowerCase().includes(q)
    ).slice(0, 6);
  }, [query, subs]);

  const alerts = useMemo(() => subs.filter(s => s.verdict === 'FLAG' || s.verdict === 'REJECT').slice(0, 8), [subs]);
  const projects = useMemo(() => Array.from(new Set(subs.map(s => s.project_id).filter(Boolean))) as string[], [subs]);

  const go = (id: string) => { setOpenSearch(false); setQuery(''); nav(`/submissions/${id}`); };

  return (
    <header ref={rootRef} style={{ height: 52, background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12, flexShrink: 0 }}>
      {/* Project switcher */}
      <div style={{ position: 'relative' }}>
        <div onClick={() => { setOpenProj(o => !o); setOpenBell(false); setOpenSearch(false); }} style={pill}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: GREEN }} />
          {project}
          <span style={{ color: '#9CA3AF', fontSize: 10 }}>▾</span>
        </div>
        {openProj && (
          <div style={{ ...dropdown, left: 0, minWidth: 200 }}>
            {['All Projects', ...projects].map(p => (
              <div key={p} onClick={() => { setProject(p); setOpenProj(false); nav('/submissions'); }}
                style={{ ...item, fontWeight: p === project ? 700 : 400, color: p === project ? BLUE : '#374151' }}>
                {p}
              </div>
            ))}
            {projects.length === 0 && <div style={muted}>No projects yet</div>}
          </div>
        )}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 340 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0F4FF', border: '1px solid #E2E8F0', borderRadius: 8, padding: '6px 12px' }}>
          <Search size={13} color="#9CA3AF" />
          <input
            value={query}
            onChange={e => { setQuery(e.target.value); setOpenSearch(true); }}
            onFocus={() => setOpenSearch(true)}
            onKeyDown={e => { if (e.key === 'Enter' && results[0]) go(results[0].submission_id); }}
            placeholder="Search submissions or enumerators…"
            style={{ border: 'none', background: 'transparent', fontSize: 12.5, fontFamily: 'Inter, sans-serif', color: '#080D1A', outline: 'none', flex: 1 }}
          />
        </div>
        {openSearch && query.trim() && (
          <div style={{ ...dropdown, left: 0, width: '100%' }}>
            {results.length ? results.map(s => (
              <div key={s.submission_id} onClick={() => go(s.submission_id)} style={item}>
                <span style={{ fontWeight: 600, color: '#080D1A' }}>{s.submission_id.slice(0, 20)}</span>
                <span style={{ color: '#9CA3AF' }}> · {s.enumerator_id} · {s.verdict}</span>
              </div>
            )) : <div style={muted}>No matches</div>}
          </div>
        )}
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <div style={{ position: 'relative' }}>
          <button onClick={() => { setOpenBell(o => !o); setOpenProj(false); setOpenSearch(false); }} style={iconBtn}>
            <Bell size={13} />
            {alerts.length > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 15, height: 15, padding: '0 3px', borderRadius: 8, background: RED, color: 'white', fontSize: 9, fontWeight: 700, display: 'grid', placeItems: 'center' }}>
                {alerts.length}
              </span>
            )}
          </button>
          {openBell && (
            <div style={{ ...dropdown, right: 0, width: 300 }}>
              <div style={{ padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #F1F5F9' }}>Alerts</div>
              {alerts.length ? alerts.map(s => (
                <div key={s.submission_id} onClick={() => { setOpenBell(false); nav(`/submissions/${s.submission_id}`); }} style={item}>
                  <span style={{ fontWeight: 700, color: s.verdict === 'REJECT' ? RED : AMBER }}>{s.verdict}</span>
                  <span style={{ color: '#6B7280' }}> · {s.enumerator_id} · {s.overall_score}/100</span>
                </div>
              )) : <div style={muted}>No alerts — all clear</div>}
            </div>
          )}
        </div>
        <button style={iconBtn}><HelpCircle size={13} /></button>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => { setOpenUser(o => !o); setOpenBell(false); setOpenProj(false); setOpenSearch(false); }}
            style={{ width: 28, height: 28, borderRadius: '50%', background: 'linear-gradient(135deg,#2463EB,#7C3AED)', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: 'white', cursor: 'pointer' }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          {openUser && (
            <div style={{ ...dropdown, right: 0, minWidth: 180 }}>
              <div style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, color: '#080D1A', borderBottom: '1px solid #F1F5F9' }}>
                {user?.name}
              </div>
              <div style={{ ...item, borderBottom: 'none' }} onClick={() => { setOpenUser(false); nav('/account/billing'); }}>
                💳 Billing & License
              </div>
              <div style={{ ...item, borderBottom: 'none' }} onClick={() => { setOpenUser(false); nav('/settings'); }}>
                ⚙️ Settings
              </div>
              <div style={{ ...item, borderBottom: 'none', color: RED }} onClick={() => { setOpenUser(false); /* logout will be handled by auth context */ }}>
                🚪 Logout
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
