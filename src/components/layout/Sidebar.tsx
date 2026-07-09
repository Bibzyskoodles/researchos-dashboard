import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useAda } from '../../ada/AdaContext';
import { usePlatform } from '../../platform/PlatformProvider';
import { useGuidedExperience } from '../../ada/GuidedExperienceContext';
import { LogOut, Sparkles, Video } from 'lucide-react';

const BLUE = '#2463EB';

export default function Sidebar() {
  const { user, org, logout } = useAuth();
  const { navigatePage } = useAda();
  const { navigation } = usePlatform();
  const { showLauncher } = useGuidedExperience();

  return (
    <aside style={{
      width: 220,
      background: '#FFFFFF',
      borderRight: '1px solid #E8EDF5',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: '16px 16px 14px',
        borderBottom: '1px solid #F1F5F9',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
      }}>
        <img
          src="/researchos-logo.png"
          alt="ResearchOS"
          style={{ width: '100%', maxWidth: 140, height: 'auto', objectFit: 'contain', display: 'block' }}
        />
        <div style={{ fontSize: 11.5, fontWeight: 600, color: BLUE, lineHeight: 1.3, paddingLeft: 2 }}>
          Intelligence for Better Decisions
        </div>
      </div>

      {/* Nav */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 8px' }}>
        {navigation.map(section => (
          <div key={section.id} style={{ marginBottom: 6 }}>
            <div style={{
              fontSize: 9, fontWeight: 700, color: '#CBD5E1',
              letterSpacing: 1.1, textTransform: 'uppercase',
              padding: '0 8px', marginBottom: 3,
            }}>{section.label}</div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => navigatePage(item.to.replace('/', ''))}
                style={({ isActive }) => ({
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 10px', borderRadius: 7, marginBottom: 1,
                  color: isActive ? BLUE : '#6B7280',
                  background: isActive ? '#EFF4FF' : 'transparent',
                  textDecoration: 'none', fontSize: 12.5, fontWeight: isActive ? 600 : 500,
                  transition: 'all .15s', cursor: 'pointer',
                  borderLeft: isActive ? `2px solid ${BLUE}` : '2px solid transparent',
                })}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  if (el.getAttribute('aria-current') !== 'page') {
                    el.style.background = '#F8FAFF';
                    el.style.color = '#374151';
                  }
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLAnchorElement;
                  if (el.getAttribute('aria-current') !== 'page') {
                    el.style.background = 'transparent';
                    el.style.color = '#6B7280';
                  }
                }}
              >
                <item.icon size={14} style={{ flexShrink: 0 }} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* Learn with Ada + Meeting */}
      <div style={{ padding: '6px 8px', borderTop: '1px solid #F1F5F9', display: 'flex', flexDirection: 'column', gap: 5 }}>
        <button
          onClick={showLauncher}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '8px 10px', borderRadius: 8,
            background: 'linear-gradient(135deg, #EFF4FF, #F5F0FF)',
            border: '1px solid #C7D2FE', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', transition: 'all .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #DBEAFE, #EDE9FE)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'linear-gradient(135deg, #EFF4FF, #F5F0FF)'; }}
        >
          <Sparkles size={13} color={BLUE} />
          <span style={{ fontSize: 12, fontWeight: 600, color: BLUE }}>Learn with Ada</span>
        </button>
        <a
          href="/meeting"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            width: '100%', padding: '7px 10px', borderRadius: 8,
            background: 'rgba(220,38,38,0.05)',
            border: '1px solid rgba(220,38,38,0.2)', cursor: 'pointer',
            fontFamily: 'Inter, sans-serif', textDecoration: 'none', transition: 'all .15s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(220,38,38,0.1)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(220,38,38,0.05)'; }}
        >
          <Video size={13} color="#DC2626" />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#DC2626' }}>Meeting Ada</span>
        </a>
      </div>

      {/* User */}
      <div style={{ padding: '10px 8px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '7px 8px', borderRadius: 7,
          background: '#F8FAFF',
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
            display: 'grid', placeItems: 'center',
            fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0,
          }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {user?.name || 'User'}
            </div>
            <div style={{ fontSize: 10, color: '#9CA3AF' }}>
              {org?.name || 'Organisation'}
            </div>
          </div>
          <button
            onClick={logout}
            title="Logout"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#CBD5E1', padding: 4, borderRadius: 4,
              display: 'grid', placeItems: 'center', transition: 'color .15s',
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#EF4444'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#CBD5E1'; }}
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </aside>
  );
}
