import React from 'react';
import { Bell, HelpCircle, Search } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';

export default function Topbar() {
  const { user } = useAuth();

  return (
    <header style={{
      height: 52, background: 'white', borderBottom: '1px solid #E2E8F0',
      display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
      flexShrink: 0,
    }}>
      {/* Project pill */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: '#F0F4FF', border: '1px solid #E2E8F0',
        borderRadius: 7, padding: '5px 10px', fontSize: 12.5,
        fontWeight: 600, color: '#080D1A', cursor: 'pointer',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%', background: '#059669',
        }} />
        Lagos Retail Audit
        <span style={{ color: '#9CA3AF', fontSize: 10 }}>▾</span>
      </div>

      {/* Search */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#F0F4FF', border: '1px solid #E2E8F0',
        borderRadius: 8, padding: '6px 12px', flex: 1, maxWidth: 340,
      }}>
        <Search size={13} color="#9CA3AF" />
        <input
          placeholder="Search anything…"
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
      </div>

      {/* Right */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
        <button style={{
          width: 30, height: 30, borderRadius: 7, border: '1px solid #E2E8F0',
          background: 'transparent', display: 'grid', placeItems: 'center',
          cursor: 'pointer', color: '#6B7280',
        }}>
          <Bell size={13} />
        </button>
        <button style={{
          width: 30, height: 30, borderRadius: 7, border: '1px solid #E2E8F0',
          background: 'transparent', display: 'grid', placeItems: 'center',
          cursor: 'pointer', color: '#6B7280',
        }}>
          <HelpCircle size={13} />
        </button>
        <div style={{
          width: 28, height: 28, borderRadius: '50%',
          background: 'linear-gradient(135deg,#2463EB,#7C3AED)',
          display: 'grid', placeItems: 'center',
          fontSize: 10, fontWeight: 700, color: 'white', cursor: 'pointer',
        }}>
          {user?.name?.charAt(0) || 'U'}
        </div>
      </div>
    </header>
  );
}
