import React, { useEffect, useState } from 'react';
import { dashboardApi } from '../../services/api';
import { BUILD_INFO } from '../../buildInfo.generated';

// Gated behind REACT_APP_SHOW_BUILD_INFO=true — never shown to end users.
const ENABLED = process.env.REACT_APP_SHOW_BUILD_INFO === 'true';

export default function BuildInfoBadge() {
  const [open, setOpen] = useState(false);
  const [backend, setBackend] = useState<{ commit: string; branch: string; server_time: string } | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!ENABLED) return;
    dashboardApi.getVersion()
      .then(r => setBackend(r.data))
      .catch(() => setError(true));
  }, []);

  if (!ENABLED) return null;

  const shortFront = BUILD_INFO.commit === 'unknown' ? 'unknown' : BUILD_INFO.commit.slice(0, 7);
  const shortBack = backend?.commit && backend.commit !== 'unknown' ? backend.commit.slice(0, 7) : null;

  return (
    <div
      onClick={() => setOpen(o => !o)}
      style={{
        padding: '8px 8px', borderTop: '1px solid rgba(255,255,255,.05)',
        fontSize: 9.5, color: 'rgba(255,255,255,.22)', cursor: 'pointer',
        fontFamily: 'monospace', lineHeight: 1.6,
      }}
      title="Click for full build details"
    >
      <div>frontend {shortFront}</div>
      {shortBack && <div>backend {shortBack}</div>}
      {error && <div style={{ color: '#DC2626' }}>backend unreachable</div>}
      {open && (
        <div style={{ marginTop: 4, color: 'rgba(255,255,255,.35)' }}>
          <div>branch: {BUILD_INFO.branch}</div>
          <div>built: {new Date(BUILD_INFO.builtAt).toLocaleString()}</div>
          {backend && (
            <>
              <div style={{ marginTop: 4 }}>be branch: {backend.branch}</div>
              <div>be time: {new Date(backend.server_time).toLocaleString()}</div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
