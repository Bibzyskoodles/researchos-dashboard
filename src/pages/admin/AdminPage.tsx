import React, { useCallback, useEffect, useState } from 'react';
import { adminApi, AdminWorkspace } from '../../services/api';
import { useAuth } from '../../store/AuthContext';

const BLUE = '#2463EB';
const INK = '#0F172A';
const MUTE = '#64748B';
const LINE = '#E2E8F0';

function fmtDate(s: string): string {
  if (!s) return '—';
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** One row's inline "set limit" control. Kept local so each row owns its own
 *  input state without a parent-level map of edits. */
function LimitCell({ ws, onSaved }: { ws: AdminWorkspace; onSaved: () => void }) {
  const initial = ws.unlimited ? '0' : String(ws.limit ?? '');
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => { setValue(ws.unlimited ? '0' : String(ws.limit ?? '')); }, [ws.limit, ws.unlimited]);

  const save = async () => {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0) { setErr('Whole number (0 = unlimited)'); return; }
    setBusy(true); setErr('');
    try {
      await adminApi.setWorkspaceLimit(ws.email, n);
      onSaved();
    } catch (e: any) {
      setErr(e?.response?.data?.error || 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const dirty = value.trim() !== initial;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        type="number"
        min={0}
        value={value}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && dirty && !busy) save(); }}
        style={{
          width: 92, padding: '6px 8px', borderRadius: 8, border: `1px solid ${LINE}`,
          fontSize: 13, fontFamily: 'Inter, sans-serif', color: INK,
        }}
        title="Verifications allowed (0 = unlimited)"
      />
      <button
        onClick={save}
        disabled={busy || !dirty}
        style={{
          padding: '6px 12px', borderRadius: 8, border: 'none', fontSize: 12.5, fontWeight: 600,
          fontFamily: 'Inter, sans-serif', cursor: busy || !dirty ? 'default' : 'pointer',
          background: dirty ? BLUE : '#EEF2F7', color: dirty ? 'white' : MUTE,
          opacity: busy ? 0.6 : 1,
        }}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
      {err && <span style={{ fontSize: 11.5, color: '#DC2626' }}>{err}</span>}
    </div>
  );
}

export default function AdminPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<AdminWorkspace[] | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');

  const load = useCallback(() => {
    setError('');
    adminApi.listWorkspaces()
      .then(res => setRows(res.data.workspaces || []))
      .catch(e => setError(e?.response?.data?.error || 'Could not load workspaces'));
  }, []);

  useEffect(() => { load(); }, [load]);

  if (!user?.is_platform_admin) {
    return (
      <div style={{ padding: 32, fontFamily: 'Inter, sans-serif', color: MUTE }}>
        This area is for platform administrators only.
      </div>
    );
  }

  const filtered = (rows || []).filter(w => {
    if (!q.trim()) return true;
    const hay = `${w.name} ${w.email} ${w.plan}`.toLowerCase();
    return hay.includes(q.trim().toLowerCase());
  });

  return (
    <div style={{ padding: '28px 32px', fontFamily: 'Inter, sans-serif', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: INK, margin: 0 }}>Admin</h1>
        <button onClick={load} style={{ background: 'none', border: 'none', color: BLUE, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Refresh
        </button>
      </div>
      <p style={{ color: MUTE, fontSize: 14, marginTop: 4, marginBottom: 20 }}>
        Every workspace that has signed up. Set a verification limit per workspace — <strong>0 means unlimited</strong>.
      </p>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search by name, email or plan…"
        style={{
          width: '100%', maxWidth: 340, padding: '9px 12px', borderRadius: 10, border: `1px solid ${LINE}`,
          fontSize: 13.5, fontFamily: 'Inter, sans-serif', color: INK, marginBottom: 18,
        }}
      />

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {rows === null && !error && (
        <div style={{ color: MUTE, fontSize: 14, padding: '24px 0' }}>Loading workspaces…</div>
      )}

      {rows !== null && filtered.length === 0 && (
        <div style={{ color: MUTE, fontSize: 14, padding: '24px 0' }}>No workspaces{q ? ' match your search' : ' yet'}.</div>
      )}

      {filtered.length > 0 && (
        <div style={{ overflowX: 'auto', border: `1px solid ${LINE}`, borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5, minWidth: 760 }}>
            <thead>
              <tr style={{ background: '#F8FAFC', textAlign: 'left', color: MUTE }}>
                <th style={{ padding: '11px 14px', fontWeight: 600 }}>Workspace</th>
                <th style={{ padding: '11px 14px', fontWeight: 600 }}>Signed up</th>
                <th style={{ padding: '11px 14px', fontWeight: 600 }}>Email</th>
                <th style={{ padding: '11px 14px', fontWeight: 600 }}>Used</th>
                <th style={{ padding: '11px 14px', fontWeight: 600 }}>Limit (0 = ∞)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(w => (
                <tr key={w.org_id} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: '11px 14px', color: INK }}>
                    <div style={{ fontWeight: 600 }}>{w.name || '—'}</div>
                    <div style={{ color: MUTE, fontSize: 12 }}>
                      {w.plan}
                      {' · '}
                      <span style={{ color: w.verified ? '#16A34A' : '#B45309' }}>
                        {w.verified ? 'verified' : 'unverified'}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: '11px 14px', color: MUTE, whiteSpace: 'nowrap' }}>{fmtDate(w.created_at)}</td>
                  <td style={{ padding: '11px 14px', color: INK }}>{w.email}</td>
                  <td style={{ padding: '11px 14px', color: INK }}>
                    {w.used ?? '—'}
                    {!w.unlimited && w.limit != null && (
                      <span style={{ color: MUTE }}> / {w.limit}</span>
                    )}
                    {w.unlimited && <span style={{ color: MUTE }}> / ∞</span>}
                  </td>
                  <td style={{ padding: '11px 14px' }}>
                    <LimitCell ws={w} onSaved={load} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
