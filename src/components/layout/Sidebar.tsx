import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useAda } from '../../ada/AdaContext';
import { usePlatform } from '../../platform/PlatformProvider';
import { useGuidedExperience } from '../../ada/GuidedExperienceContext';
import { useIndustry } from '../../store/IndustryContext';
import { LogOut, Sparkles, Video, ChevronDown, RefreshCw } from 'lucide-react';

const BLUE = '#2463EB';

const MODE_ICONS: Record<string, string> = {
  research_agency: '🔬',
  ngo:             '🌍',
  fmcg:            '🛒',
  government:      '🏛',
  health:          '🏥',
  education:       '📚',
  consultancy:     '💼',
};

export default function Sidebar() {
  const { user, org, logout } = useAuth();
  const { navigatePage } = useAda();
  const { navigation } = usePlatform();
  const { showLauncher } = useGuidedExperience();
  const { sessionIndustry, setSessionIndustry, vocab, INDUSTRIES, isSessionOverride, clearSessionOverride } = useIndustry();
  const [modePicker, setModePicker] = useState(false);

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

      {/* Project Mode switcher */}
      <div style={{ padding: '6px 8px', borderTop: '1px solid #F1F5F9', position: 'relative' }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: '#CBD5E1', letterSpacing: 1, textTransform: 'uppercase', padding: '0 2px', marginBottom: 4 }}>
          Project Mode
        </div>
        <button
          onClick={() => setModePicker(p => !p)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
            background: isSessionOverride ? '#EFF6FF' : '#F8FAFF',
            border: `1px solid ${isSessionOverride ? '#BFDBFE' : '#E8EDF5'}`,
            fontFamily: 'Inter, sans-serif', transition: 'all .15s',
          }}
        >
          <span style={{ fontSize: 14 }}>{MODE_ICONS[sessionIndustry]}</span>
          <span style={{ flex: 1, fontSize: 11.5, fontWeight: 600, color: isSessionOverride ? BLUE : '#6B7280', textAlign: 'left' as const, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
            {vocab.label}
          </span>
          <ChevronDown size={11} color={isSessionOverride ? BLUE : '#9CA3AF'} style={{ transform: modePicker ? 'rotate(180deg)' : 'none', transition: 'transform .2s', flexShrink: 0 }} />
        </button>

        {modePicker && (
          <div style={{
            position: 'absolute', bottom: 'calc(100% + 4px)', left: 8, right: 8,
            background: 'white', borderRadius: 10, border: '1px solid #E2E8F0',
            boxShadow: '0 -8px 24px rgba(10,15,28,.12)', zIndex: 100, overflow: 'hidden',
          }}>
            <div style={{ padding: '8px 10px 6px', fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: .7 }}>
              What are you collecting today?
            </div>
            {INDUSTRIES.map(ind => (
              <div
                key={ind.key}
                onClick={() => { setSessionIndustry(ind.key as any); setModePicker(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', cursor: 'pointer',
                  background: sessionIndustry === ind.key ? '#EFF6FF' : 'white',
                  transition: 'background .1s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = '#F8FAFF'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = sessionIndustry === ind.key ? '#EFF6FF' : 'white'; }}
              >
                <span style={{ fontSize: 14 }}>{MODE_ICONS[ind.key]}</span>
                <span style={{ fontSize: 12, fontWeight: sessionIndustry === ind.key ? 600 : 500, color: sessionIndustry === ind.key ? BLUE : '#374151' }}>{ind.label}</span>
              </div>
            ))}
            {isSessionOverride && (
              <div
                onClick={() => { clearSessionOverride(); setModePicker(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderTop: '1px solid #F1F5F9', cursor: 'pointer', color: '#9CA3AF', fontSize: 11.5 }}
              >
                <RefreshCw size={11} /> Reset to org default
              </div>
            )}
          </div>
        )}
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
