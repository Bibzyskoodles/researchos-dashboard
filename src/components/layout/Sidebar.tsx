import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useAda } from '../../ada/AdaContext';
import { usePlatform } from '../../platform/PlatformProvider';
import { LogOut } from 'lucide-react';

// Navigation is now resolved from the Platform Registry (docs/04_ARCHITECTURE.md),
// not hardcoded here (ADR-002 No-Hardcoding Rule).

export default function Sidebar() {
  const { user, org, logout } = useAuth();
  const { navigatePage } = useAda();
  const { navigation } = usePlatform();

  return (
    <aside style={{
      width: 220, background: '#080D1A', display: 'flex',
      flexDirection: 'column', flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '16px 16px', borderBottom: '1px solid rgba(255,255,255,.06)',
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8,
      }}>
        <img
          src="/researchos-logo.png"
          alt="ResearchOS"
          style={{ width: '100%', maxWidth: 150, height: 'auto', objectFit: 'contain', display: 'block' }}
        />
        <div style={{ fontSize: 12.5, fontWeight: 600, color: '#2463EB', lineHeight: 1.3, paddingLeft: 2 }}>
          Intelligence for Better Decisions
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.32)', letterSpacing: 0.5, textTransform: 'uppercase', paddingLeft: 2, fontWeight: 500 }}>
          by Intelligency AI
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 8px' }}>
        {navigation.map(section => (
          <div key={section.id} style={{ marginBottom: 8 }}>
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
