import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, HelpCircle, RefreshCw, Search, Menu, Settings, LogOut, Mail, ExternalLink } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { dashboardApi } from '../../services/api';
import { usePlatform } from '../../platform/PlatformProvider';
import { colors, spacing, typography, transitions, radius, shadows } from '../../designTokens';

interface Sub {
  submission_id: string; enumerator_id: string; verdict: string;
  overall_score: number; project_id?: string;
}

interface TopbarProps {
  onRefresh?: () => void;
  onMenuClick?: () => void;
}

export default function Topbar({ onRefresh, onMenuClick }: TopbarProps) {
  const { user, logout } = useAuth();
  const { t } = usePlatform();
  const nav = useNavigate();
  const [subs, setSubs] = useState<Sub[]>([]);
  const [query, setQuery] = useState('');
  const [openSearch, setOpenSearch] = useState(false);
  const [openBell, setOpenBell] = useState(false);
  const [openProj, setOpenProj] = useState(false);
  const [openHelp, setOpenHelp] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);
  const [project, setProject] = useState('All Projects');
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    dashboardApi.getSubmissions({ limit: 200 })
      .then(r => setSubs(r.data?.submissions || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpenSearch(false);
        setOpenBell(false);
        setOpenProj(false);
        setOpenHelp(false);
        setOpenProfile(false);
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

  const go = (id: string) => {
    setOpenSearch(false);
    setQuery('');
    nav(`/submissions/${id}`);
  };

  const pillStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing.md,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.full,
    padding: `${spacing.sm}px ${spacing.md}px`,
    fontSize: 14,
    fontWeight: 600,
    color: colors.textSecondary,
    cursor: 'pointer',
    transition: transitions.normal,
  };

  const dropdownStyle: React.CSSProperties = {
    position: 'absolute',
    top: `calc(100% + ${spacing.md}px)`,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    borderRadius: radius.lg,
    boxShadow: shadows.lg,
    zIndex: 3000,
    overflow: 'hidden',
    maxHeight: 340,
    overflowY: 'auto',
  };

  const itemStyle: React.CSSProperties = {
    padding: `${spacing.md}px ${spacing.md}px`,
    fontSize: 14,
    color: colors.textSecondary,
    cursor: 'pointer',
    borderBottom: `1px solid ${colors.borderLight}`,
    whiteSpace: 'nowrap',
    transition: transitions.fast,
  };

  const mutedStyle: React.CSSProperties = {
    padding: spacing.lg,
    fontSize: 14,
    color: colors.textQuaternary,
    textAlign: 'center',
  };

  const iconBtnStyle: React.CSSProperties = {
    position: 'relative',
    width: 40,
    height: 40,
    borderRadius: radius.md,
    border: `1px solid ${colors.border}`,
    background: 'transparent',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    color: colors.textTertiary,
    transition: transitions.fast,
  };

  return (
    <header ref={rootRef} style={{
      height: 60,
      background: colors.surface,
      borderBottom: `1px solid ${colors.border}`,
      display: 'flex',
      alignItems: 'center',
      padding: `0 ${spacing.lg}px`,
      gap: spacing.lg,
      flexShrink: 0,
    }}>
      {/* Hamburger — mobile only */}
      {onMenuClick && (
        <button
          onClick={onMenuClick}
          style={{ ...iconBtnStyle, border: 'none', marginRight: 4 }}
          title="Menu"
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = colors.surfaceHover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
        >
          <Menu size={20} />
        </button>
      )}

      {/* Project switcher */}
      <div style={{ position: 'relative' }}>
        <div
          onClick={() => {
            setOpenProj(o => !o);
            setOpenBell(false);
            setOpenSearch(false);
          }}
          style={pillStyle}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = colors.primary;
            (e.currentTarget as HTMLDivElement).style.color = colors.primary;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLDivElement).style.borderColor = colors.border;
            (e.currentTarget as HTMLDivElement).style.color = colors.textSecondary;
          }}
        >
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors.success }} />
          {project}
          <span style={{ color: colors.textTertiary, fontSize: 11 }}>▾</span>
        </div>
        <AnimatePresence>
          {openProj && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.12 }}
              style={{ ...dropdownStyle, left: 0, minWidth: 200 }}>
              {['All Projects', ...projects].map(p => (
                <motion.div
                  key={p}
                  whileHover={{ background: p === project ? colors.primaryLighter : colors.surfaceHover }}
                  onClick={() => {
                    setProject(p);
                    setOpenProj(false);
                    nav('/submissions');
                  }}
                  style={{
                    ...itemStyle,
                    fontWeight: p === project ? 700 : 400,
                    color: p === project ? colors.primary : colors.textSecondary,
                    background: p === project ? colors.primaryLighter : 'transparent',
                  }}
                >
                  {p}
                </motion.div>
              ))}
              {projects.length === 0 && <div style={mutedStyle}>No projects yet</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 400 }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          padding: `${spacing.md}px ${spacing.md}px`,
          transition: transitions.normal,
        }}
          onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = colors.primary; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 0 0 3px ${colors.primaryLighter}`; }}
          onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = colors.border; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
        >
          <Search size={16} color={colors.textTertiary} />
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setOpenSearch(true);
            }}
            onFocus={() => setOpenSearch(true)}
            onKeyDown={e => {
              if (e.key === 'Enter' && results[0]) go(results[0].submission_id);
            }}
            placeholder={`Search submissions or ${t('enumerators', 'enumerators')}…`}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 14,
              fontFamily: typography.fontFamily,
              color: colors.textPrimary,
              outline: 'none',
              flex: 1,
            }}
          />
        </div>
        <AnimatePresence>
          {openSearch && query.trim() && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.12 }}
              style={{ ...dropdownStyle, left: 0, right: 0, width: 'auto' }}>
              {results.length
                ? results.map((s, idx) => (
                    <motion.div
                      key={s.submission_id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.02 }}
                      whileHover={{ background: colors.surfaceHover }}
                      onClick={() => go(s.submission_id)}
                      style={itemStyle}
                    >
                      <span style={{ fontWeight: 600, color: colors.textPrimary }}>
                        {s.submission_id.slice(0, 20)}
                      </span>
                      <span style={{ color: colors.textTertiary }}>
                        {' '}· {s.enumerator_id} · {s.verdict}
                      </span>
                    </motion.div>
                  ))
                : <div style={mutedStyle}>No matches</div>}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginLeft: 'auto' }}>
        {onRefresh && (
          <button
            onClick={onRefresh}
            style={iconBtnStyle}
            title="Refresh"
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <RefreshCw size={18} />
          </button>
        )}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => {
              setOpenBell(o => !o);
              setOpenProj(false);
              setOpenSearch(false);
            }}
            style={iconBtnStyle}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = colors.surfaceHover;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            }}
          >
            <Bell size={18} />
            {alerts.length > 0 && (
              <span style={{
                position: 'absolute',
                top: -4,
                right: -4,
                minWidth: 20,
                height: 20,
                padding: `0 ${spacing.xs}px`,
                borderRadius: radius.full,
                background: colors.error,
                color: colors.white,
                fontSize: 11,
                fontWeight: 700,
                display: 'grid',
                placeItems: 'center',
              }}>
                {alerts.length}
              </span>
            )}
          </button>
          <AnimatePresence>
            {openBell && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.12 }}
                style={{ ...dropdownStyle, right: 0, width: 320 }}>
                <div style={{
                  padding: `${spacing.md}px ${spacing.lg}px`,
                  fontSize: 11,
                  fontWeight: 700,
                  color: colors.textQuaternary,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  borderBottom: `1px solid ${colors.border}`,
                }}>
                  Alerts
                </div>
                {alerts.length
                  ? alerts.map((s, idx) => (
                      <motion.div
                        key={s.submission_id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        whileHover={{ background: colors.surfaceHover }}
                        onClick={() => {
                          setOpenBell(false);
                          nav(`/submissions/${s.submission_id}`);
                        }}
                        style={itemStyle}
                      >
                        <span style={{
                          fontWeight: 700,
                          color: s.verdict === 'REJECT' ? colors.error : colors.warning,
                        }}>
                          {s.verdict}
                        </span>
                        <span style={{ color: colors.textTertiary }}>
                          {' '}· {s.enumerator_id} · {s.overall_score}/100
                        </span>
                      </motion.div>
                    ))
                  : <div style={mutedStyle}>No alerts — all clear</div>}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        {/* Help */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => { setOpenHelp(o => !o); setOpenBell(false); setOpenProj(false); setOpenProfile(false); }}
            title="Help"
            style={iconBtnStyle}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = colors.surfaceHover; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            <HelpCircle size={18} />
          </button>
          <AnimatePresence>
            {openHelp && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.12 }}
                style={{ ...dropdownStyle, right: 0, width: 220 }}>
                <div style={{ padding: '10px 14px 6px', fontSize: 10.5, fontWeight: 700, color: colors.textQuaternary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Help & Support</div>
                {[
                  { label: 'Documentation', icon: ExternalLink, action: () => {} },
                  { label: 'Contact Support', icon: Mail, action: () => { window.location.href = 'mailto:support@intelligencyai.com.ng'; } },
                  { label: 'Settings', icon: Settings, action: () => { nav('/settings'); setOpenHelp(false); } },
                ].map(({ label, icon: Icon, action }) => (
                  <div key={label} onClick={action} style={{ ...itemStyle, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = colors.surfaceHover; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                    <Icon size={13} color={colors.textTertiary} />
                    <span style={{ fontSize: 13, color: colors.textPrimary }}>{label}</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Profile avatar */}
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => { setOpenProfile(o => !o); setOpenHelp(false); setOpenBell(false); setOpenProj(false); }}
            title={user?.name || 'Account'}
            style={{
              width: 40, height: 40, borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
              display: 'grid', placeItems: 'center',
              fontSize: 14, fontWeight: 700, color: colors.white, cursor: 'pointer',
              border: openProfile ? `2px solid ${colors.primary}` : '2px solid transparent',
              transition: 'border-color 0.15s',
            }}>
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <AnimatePresence>
            {openProfile && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.12 }}
                style={{ ...dropdownStyle, right: 0, width: 240 }}>
                <div style={{ padding: '14px 16px', borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: colors.textPrimary }}>{user?.name || 'User'}</div>
                  <div style={{ fontSize: 11.5, color: colors.textTertiary, marginTop: 2 }}>{(user as any)?.email || ''}</div>
                </div>
                <div onClick={() => { nav('/settings'); setOpenProfile(false); }} style={{ ...itemStyle, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = colors.surfaceHover; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                  <Settings size={13} color={colors.textTertiary} />
                  <span style={{ fontSize: 13, color: colors.textPrimary }}>Account Settings</span>
                </div>
                <div onClick={() => { nav('/billing'); setOpenProfile(false); }} style={{ ...itemStyle, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = colors.surfaceHover; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                  <ExternalLink size={13} color={colors.textTertiary} />
                  <span style={{ fontSize: 13, color: colors.textPrimary }}>Billing & Plans</span>
                </div>
                <div onClick={() => { logout(); setOpenProfile(false); }} style={{ ...itemStyle, display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', borderBottom: 'none' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#FEF2F2'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}>
                  <LogOut size={13} color="#DC2626" />
                  <span style={{ fontSize: 13, color: '#DC2626' }}>Sign out</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
