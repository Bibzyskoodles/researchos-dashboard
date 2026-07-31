import React, { useCallback, useEffect, useState } from 'react';
import { adminApi, AdminWorkspace, Lead, leadsApi } from '../../services/api';
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

const SOURCE_LABEL: Record<string, string> = {
  demo_request: 'Website — demo request',
  configurator: 'Configurator',
};

/** Everyone who has asked to hear from us. This exists because the marketing
 *  site's form used to be a `mailto:` link that recorded nothing anywhere — so
 *  an enquiry only counted if the visitor's own mail app opened AND they then
 *  pressed Send. Enquiries are now stored before any email is attempted; this
 *  table is the record, and `notified` shows whether the alert also went out. */
function LeadsPanel() {
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(() => {
    setError('');
    leadsApi.list()
      .then(res => setLeads(res.data.leads || []))
      .catch(e => setError(e?.response?.data?.error || 'Could not load enquiries'));
  }, []);

  useEffect(() => { load(); }, [load]);

  const remove = async (id: number) => {
    setBusyId(id);
    try {
      await leadsApi.remove(id);
      setLeads(prev => (prev || []).filter(l => l.id !== id));
    } catch (e) {
      setError('Could not remove that enquiry');
    } finally {
      setBusyId(null);
    }
  };

  const undelivered = (leads || []).filter(l => !l.notified).length;

  return (
    <section style={{ marginTop: 44 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 800, color: INK, margin: 0 }}>Enquiries</h2>
        <button onClick={load} style={{ background: 'none', border: 'none', color: BLUE, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'Inter, sans-serif' }}>
          Refresh
        </button>
      </div>
      <p style={{ color: MUTE, fontSize: 14, marginTop: 4, marginBottom: 18 }}>
        Everyone who has asked for a demo or built a deployment plan. Saved here first,
        so an enquiry is never lost if the notification email fails.
      </p>

      {undelivered > 0 && (
        <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
          {undelivered} {undelivered === 1 ? 'enquiry was' : 'enquiries were'} captured but no alert email went out —
          usually because no sales address is configured. They&rsquo;re safe here either way.
        </div>
      )}

      {error && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', padding: '10px 14px', borderRadius: 10, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {leads === null && !error && (
        <div style={{ color: MUTE, fontSize: 14, padding: '24px 0' }}>Loading enquiries…</div>
      )}

      {leads !== null && leads.length === 0 && (
        <div style={{ color: MUTE, fontSize: 14, padding: '24px 0' }}>No enquiries yet.</div>
      )}

      {(leads || []).length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(leads || []).map(l => (
            <div key={l.id} style={{ border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 700, color: INK, fontSize: 14.5 }}>
                  {l.name || l.email}
                  {l.organisation && <span style={{ color: MUTE, fontWeight: 500 }}> · {l.organisation}</span>}
                </div>
                <div style={{ color: MUTE, fontSize: 12, whiteSpace: 'nowrap' }}>
                  {SOURCE_LABEL[l.source] || l.source} · {fmtDate(l.created_at)}
                  {!l.notified && <span style={{ color: '#B45309' }}> · not emailed</span>}
                </div>
              </div>
              <div style={{ marginTop: 4 }}>
                <a href={`mailto:${l.email}`} style={{ color: BLUE, fontSize: 13.5, textDecoration: 'none' }}>{l.email}</a>
              </div>
              {l.message && (
                <p style={{ color: INK, fontSize: 13.5, margin: '10px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                  {l.message}
                </p>
              )}
              <button
                onClick={() => remove(l.id)}
                disabled={busyId === l.id}
                style={{ background: 'none', border: 'none', color: MUTE, fontSize: 12, cursor: 'pointer', padding: 0, marginTop: 10, fontFamily: 'Inter, sans-serif' }}
              >
                {busyId === l.id ? 'Removing…' : 'Remove'}
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
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

      <LeadsPanel />
    </div>
  );
}
