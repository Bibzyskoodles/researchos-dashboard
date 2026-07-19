import React from 'react';

// Project health indicator — a small ring in the corner of a project card.
// Previously showed a number hashed from the project id (looked like a real
// quality score, wasn't one — same 30±4 range for every project still in
// "design" status regardless of what its actual submissions looked like).
// Now shows the real average trust score across the project's scored
// submissions, or an honest empty state when there isn't one yet.

export default function HealthRing({ avgScore, size = 34 }: { avgScore?: number | null; size?: number }) {
  const hasData = typeof avgScore === 'number';
  const score = hasData ? Math.round(avgScore as number) : 0;
  const color = !hasData ? '#CBD5E1' : score >= 70 ? '#059669' : score >= 45 ? '#D97706' : '#DC2626';
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div
      title={hasData ? `Average trust score ${score}/100 across scored submissions` : 'No scored submissions yet'}
      style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F8" strokeWidth={3} />
        {hasData && (
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={3} strokeLinecap="round"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
            style={{ transition: 'stroke-dashoffset .6s ease' }}
          />
        )}
      </svg>
      <span style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontSize: hasData ? size * 0.28 : size * 0.4, fontWeight: 800, color, fontFamily: 'Inter, sans-serif',
      }}>
        {hasData ? score : '—'}
      </span>
    </div>
  );
}
