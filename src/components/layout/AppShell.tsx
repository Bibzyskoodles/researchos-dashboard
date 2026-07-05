import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import AdaDock from './AdaDock';

export default function AppShell() {
  const location = useLocation();
  const isOverview = location.pathname === '/overview' || location.pathname === '/';
  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      overflow: 'hidden',
      background: '#F0F4FF',
      fontFamily: 'Inter, sans-serif',
    }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          <Outlet />
        </main>
      </div>
      {!isOverview && <AdaDock />}
    </div>
  );
}
