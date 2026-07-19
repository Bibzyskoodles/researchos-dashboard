import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { API_BASE_URL } from '../../services/api';

// Public, unauthenticated view for a report share link
// (POST /api/projects/<id>/reports/share on ReportsPage.tsx creates the
// token; this page resolves it). Deliberately outside AuthProvider's
// ProtectedRoute in App.tsx and renders with no Sidebar/AppShell chrome —
// this is meant to be opened by someone outside the org who has no
// FieldScore account and shouldn't need one.
//
// The backend's GET /shared-report/<token> (report_share_routes.py) already
// renders a complete, styled, self-contained HTML document — the same
// content-generation path used for the Verification Certificate — so this
// page is a thin fetch-and-embed wrapper, not a second report renderer.
// A plain, unauthenticated fetch is used deliberately instead of the `api`
// axios instance: that instance attaches a Bearer token when one exists in
// localStorage and redirects to /login on any 401, neither of which is
// correct for a page a logged-out stranger might open.
export default function SharedReportPage() {
  const { token } = useParams<{ token: string }>();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    if (!token) { setError('No report link provided.'); setLoading(false); return; }
    fetch(`${API_BASE_URL}/shared-report/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!live) return;
        const text = await res.text();
        if (!res.ok) {
          setError('This report link is invalid, has expired, or has been revoked.');
          return;
        }
        setHtml(text);
      })
      .catch(() => { if (live) setError('Could not load this report — please check your connection and try again.'); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [token]);

  const shellStyle: React.CSSProperties = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f5f4f0', fontFamily: 'Inter, system-ui, sans-serif',
  };

  if (loading) {
    return (
      <div style={shellStyle}>
        <div style={{ color: '#6B7280', fontSize: 14 }}>Loading report…</div>
      </div>
    );
  }

  if (error || !html) {
    return (
      <div style={shellStyle}>
        <div style={{ background: 'white', borderRadius: 12, padding: '40px 44px', textAlign: 'center', maxWidth: 420, boxShadow: '0 4px 24px rgba(10,15,28,.08)' }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Report unavailable</div>
          <div style={{ fontSize: 13, color: '#64748b', lineHeight: 1.6 }}>{error || 'This report could not be found.'}</div>
        </div>
      </div>
    );
  }

  // The backend document is a complete, self-contained page (own <html>,
  // styles, print button) — an iframe with srcDoc renders it exactly as
  // the backend intended without this app's own CSS/JS bleeding into it.
  return (
    <iframe
      title="Shared report"
      srcDoc={html}
      style={{ border: 'none', width: '100vw', height: '100vh', display: 'block' }}
    />
  );
}
