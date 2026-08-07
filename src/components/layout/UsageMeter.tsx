import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { orgSettingsApi } from '../../services/api';

/**
 * The verification-allowance pill in the topbar: "38 / 500 verifications".
 *
 * Until this existed the only way a workspace discovered its cap was a 402
 * on upload — there was no meter anywhere, no warning at 80%, and Kobo
 * webhook users hit the wall with no UI at all. The numbers come from
 * GET /api/org/billing's `allowance` block, which reads the same
 * workspace_usage() the server enforces with, so this meter and the actual
 * refusal can never disagree.
 *
 * Renders nothing for unlimited plans and while loading — the pill is a
 * cap-awareness device, not decoration.
 */

interface Allowance {
  limit: number | null;
  used: number | null;
  remaining: number | null;
  unlimited: boolean;
}

const REFRESH_MS = 5 * 60 * 1000; // the count moves at upload speed, not click speed

export default function UsageMeter() {
  const navigate = useNavigate();
  const [allowance, setAllowance] = useState<Allowance | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      orgSettingsApi.getBilling()
        .then(r => { if (!cancelled) setAllowance(r.data?.allowance ?? null); })
        .catch(() => { /* no meter is better than a wrong meter */ });
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => { cancelled = true; clearInterval(t); };
  }, []);

  if (!allowance || allowance.unlimited || allowance.limit == null) return null;

  const used = allowance.used ?? 0;
  const limit = allowance.limit;
  const remaining = allowance.remaining ?? Math.max(0, limit - used);
  const fraction = limit > 0 ? remaining / limit : 0;

  const exhausted = remaining <= 0;
  const low = !exhausted && fraction <= 0.2;

  const palette = exhausted
    ? { bg: '#FEF2F2', border: '#FECACA', text: '#DC2626', bar: '#DC2626' }
    : low
      ? { bg: '#FFFBEB', border: '#FDE68A', text: '#B45309', bar: '#D97706' }
      : { bg: '#F5F7FB', border: '#E2E8F0', text: '#4A5468', bar: '#2463EB' };

  const label = exhausted
    ? 'Limit reached · Upgrade'
    : `${used.toLocaleString()} / ${limit.toLocaleString()}`;

  return (
    <button
      onClick={() => navigate('/settings', { state: { section: 'billing' } })}
      title={exhausted
        ? 'This workspace has used its verification allowance. Upgrade to keep verifying.'
        : `${remaining.toLocaleString()} of ${limit.toLocaleString()} verifications left on this workspace. Click for plans.`}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        background: palette.bg, border: `1px solid ${palette.border}`, borderRadius: 7,
        padding: '5px 10px', fontSize: 11.5, fontWeight: 700, color: palette.text,
        cursor: 'pointer', fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        width: 34, height: 4, borderRadius: 2, background: '#E2E8F0',
        position: 'relative', overflow: 'hidden', display: 'inline-block',
      }}>
        <span style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${Math.min(100, Math.round((used / Math.max(1, limit)) * 100))}%`,
          background: palette.bar, borderRadius: 2,
        }} />
      </span>
      {label}
    </button>
  );
}
