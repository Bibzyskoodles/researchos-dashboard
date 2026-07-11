import React, { useState } from 'react';
import { Bell, HelpCircle, Search, RefreshCw, Gift, Menu } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { useGamify } from '../../gamify/GamifyContext';
import { useIsMobile } from '../../hooks/useIsMobile';

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

      {/* Project pill — hide on very small mobile to save space */}
      {!isMobile && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          background: '#F0F4FF', border: '1px solid #E2E8F0',
          borderRadius: 7, padding: '5px 10px', fontSize: 12.5,
          fontWeight: 600, color: '#080D1A', flexShrink: 0,
        }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
          <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {org?.name || 'My Workspace'}
          </span>
        </div>
      )}

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

          <button style={{
            width: 30, height: 30, borderRadius: 7, border: '1px solid #E2E8F0',
            background: 'transparent', display: 'grid', placeItems: 'center',
            cursor: 'pointer', color: '#6B7280',
          }} title="Help">
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
