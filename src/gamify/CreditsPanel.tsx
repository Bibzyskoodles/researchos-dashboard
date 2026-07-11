import React from 'react';
import { Gift, TrendingUp } from 'lucide-react';
import { useGamify, MILESTONES, TIERS } from './GamifyContext';

const GREEN = '#059669';

// Lives inside Settings → Billing. Shows the org's FieldScore Rewards balance
// (earned via quality milestones, applied against the next subscription
// payment) and quiet milestone progress. Intentionally calm — no confetti.
export default function CreditsPanel() {
  const { creditsBalance, creditsEarned, achieved, counters, transactions, tier } = useGamify();

  const nextTier = TIERS.find(t => t.min > achieved.length);

  return (
    <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E8EDF5', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      {/* Header row: balance + tier */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '16px 20px', borderBottom: '1px solid #F1F5F9' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: '#ECFDF5', display: 'grid', placeItems: 'center' }}>
          <Gift size={18} color={GREEN} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#080D1A' }}>FieldScore Rewards</div>
          <div style={{ fontSize: 11.5, color: '#6B7280' }}>Credits earned through quality milestones — automatically applied to your next payment.</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 20, fontWeight: 800, color: creditsBalance > 0 ? GREEN : '#9CA3AF' }}>
            ₦{creditsBalance.toLocaleString()}
          </div>
          <div style={{ fontSize: 10, color: '#9CA3AF' }}>credit toward next payment</div>
        </div>
      </div>

      {/* Tier strip */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: '#FAFBFF', borderBottom: '1px solid #F1F5F9' }}>
        <span style={{ fontSize: 10.5, fontWeight: 700, color: tier.color, background: tier.color + '14', padding: '3px 10px', borderRadius: 12 }}>
          {tier.label}
        </span>
        <span style={{ fontSize: 11, color: '#9CA3AF' }}>
          {achieved.length} of {MILESTONES.length} milestones
          {nextTier ? ` · ${nextTier.min - achieved.length} more to ${nextTier.label}` : ' · highest tier reached'}
        </span>
        {creditsEarned > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 4 }}>
            <TrendingUp size={11} color={GREEN} /> ₦{creditsEarned.toLocaleString()} earned all-time
          </span>
        )}
      </div>

      {/* Milestones */}
      <div style={{ padding: '14px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 8 }}>
        {MILESTONES.map(m => {
          const done = achieved.includes(m.id);
          const progress = Math.min(counters[m.event] || 0, m.target);
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px',
              borderRadius: 10, border: `1px solid ${done ? '#A7F3D0' : '#F1F5F9'}`,
              background: done ? '#F0FDF4' : 'white', opacity: done ? 1 : 0.85,
            }}>
              <span style={{ fontSize: 17, filter: done ? 'none' : 'grayscale(1)', opacity: done ? 1 : 0.5 }}>{m.icon}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: done ? '#065F46' : '#374151' }}>{m.label}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {done ? `Earned ₦${m.credits.toLocaleString()}` : m.target > 1 ? `${progress}/${m.target} · ₦${m.credits.toLocaleString()}` : `₦${m.credits.toLocaleString()} credit`}
                </div>
              </div>
              {done && <span style={{ color: GREEN, fontSize: 13, fontWeight: 800 }}>✓</span>}
            </div>
          );
        })}
      </div>

      {/* Recent transactions */}
      {transactions.length > 0 && (
        <div style={{ borderTop: '1px solid #F1F5F9', padding: '12px 20px' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>Credit history</div>
          {transactions.slice(0, 5).map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: '#374151', padding: '4px 0' }}>
              <span>{t.label}</span>
              <span style={{ fontWeight: 700, color: t.amount > 0 ? GREEN : '#6B7280' }}>
                {t.amount > 0 ? '+' : ''}₦{Math.abs(t.amount).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
