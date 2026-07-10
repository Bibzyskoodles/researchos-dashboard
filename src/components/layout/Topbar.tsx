import React, { useState } from 'react';
import { Bell, HelpCircle, Search, RefreshCw } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';

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
}

export default function Topbar({ onRefresh }: TopbarProps) {
  const { user, org } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchVal, setSearchVal] = useState('');

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
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
      flexShrink: 0,
    }}>
      {/* Project pill — shows active org name */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: '#F0F4FF', border: '1px solid #E2E8F0',
        borderRadius: 7, padding: '5px 10px', fontSize: 12.5,
        fontWeight: 600, color: '#080D1A',
      }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
        <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {org?.name || 'My Workspace'}
        </span>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#F0F4FF', border: '1px solid #E2E8F0',
        borderRadius: 8, padding: '6px 12px', flex: 1, maxWidth: 340,
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
        <span style={{
          fontSize: 10, fontFamily: 'monospace', color: '#CBD5E1',
          background: '#EEF2F8', border: '1px solid #E2E8F0',
          borderRadius: 4, padding: '1px 5px',
        }}>⌘K</span>
      </form>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
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

        {/* Notifications — badge shows plan status warning if trial/expired */}
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
