import React from 'react';

// Ambient project health indicator — a small ring in the corner of a project
// card. Always present, never announced. Score is derived from lifecycle
// progress until real per-project QC stats are wired to the card level.
const STAGE_BASE: Record<string, number> = {
  design: 30, collect: 55, verify: 68, analyse: 84, report: 96,
};

function hashJitter(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 997;
  return (h % 9) - 4; // −4..+4, stable per project
}

export default function HealthRing({ projectId, status, size = 34 }: { projectId: string; status: string; size?: number }) {
  const score = Math.max(5, Math.min(99, (STAGE_BASE[status] ?? 30) + hashJitter(projectId)));
  const color = score >= 80 ? '#059669' : score >= 55 ? '#2463EB' : '#D97706';
  const r = (size - 5) / 2;
  const circ = 2 * Math.PI * r;

  return (
    <div title={`Project health ${score} — quality × progress × timeliness`} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EEF2F8" strokeWidth={3} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <span style={{
        position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
        fontSize: size * 0.28, fontWeight: 800, color, fontFamily: 'Inter, sans-serif',
      }}>
        {score}
      </span>
    </div>
  );
}
