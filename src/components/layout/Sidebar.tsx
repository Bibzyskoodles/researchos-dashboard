import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useAda } from '../../ada/AdaContext';
import {
  LayoutDashboard, FileText, Users, Map,
  Sparkles, BookOpen, Puzzle, Settings, LogOut, ClipboardList
} from 'lucide-react';

const NAV = [
  { label: 'WORKSPACE', items: [
    { to: '/overview',     icon: LayoutDashboard, label: 'Overview' },
    { to: '/submissions',  icon: FileText,         label: 'Submissions' },
    { to: '/enumerators',  icon: Users,            label: 'Enumerators' },
    { to: '/map',          icon: Map,              label: 'Coverage Map' },
  ]},
  { label: 'INTELLIGENCE', items: [
    { to: '/insights',      icon: Sparkles,      label: 'AI Analysis' },
    { to: '/questionnaire', icon: ClipboardList, label: 'Questionnaire' },
    { to: '/reports',       icon: BookOpen,      label: 'Reports' },
  ]},
  { label: 'PROJECT', items: [
    { to: '/integrations', icon: Puzzle,           label: 'Integrations' },
    { to: '/settings',     icon: Settings,         label: 'Settings' },
  ]},
];

export default function Sidebar() {
  const { user, org, logout } = useAuth();
  const { navigatePage } = useAda();

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
        {/* LOGO_PLACEHOLDER — owner: drop /public/researchos-logo.png (square, ~32px). Falls back to a neutral tile until the file exists. */}
        <img
          src="/researchos-logo.png"
          alt="ResearchOS"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }}
          style={{
            width: 32, height: 32, background: '#2463EB', borderRadius: 8,
            objectFit: 'contain', flexShrink: 0,
          }}
        />
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'white', letterSpacing: -0.3 }}>
            ResearchOS
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,.28)', letterSpacing: 1, textTransform: 'uppercase' }}>
            by Intelligency AI
          </div>
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {NAV.map(section => (
          <div key={section.label} style={{ marginBottom: 8 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,.2)',
              letterSpacing: 1.1, textTransform: 'uppercase',
              padding: '0 8px', marginBottom: 4,
            }}>{section.label}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => navigatePage(item.to.replace('/', ''))}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 7, marginBottom: 1,
                  color: isActive ? 'white' : 'rgba(255,255,255,.42)',
                  background: isActive ? 'rgba(37,99,235,.22)' : 'transparent',
                  textDecoration: 'none', fontSize: 12.5, fontWeight: 500,
                  transition: 'all .15s', cursor: 'pointer',
                  borderLeft: isActive ? '2px solid #2463EB' : '2px solid transparent',
                })}
              >
                <item.icon size={14} style={{ flexShrink: 0 }} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* User */}
      <div style={{ padding: '12px 8px', borderTop: '1px solid rgba(255,255,255,.05)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 8px', borderRadius: 7,
        }}>
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
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,.25)' }}>
              {org?.name || 'Organisation'}
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(255,255,255,.3)', padding: 4, borderRadius: 4,
              display: 'grid', placeItems: 'center',
            }}
            title="Logout"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
