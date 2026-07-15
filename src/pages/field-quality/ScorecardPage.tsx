import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardApi } from '../../services/api';
import { Submission } from '../../types';
import {
  Award, TrendingUp, TrendingDown, Users, Lock, Globe, Shield,
  ChevronDown, Star, AlertTriangle, CheckCircle2, XCircle,
  Eye, EyeOff, BarChart2, Minus,
} from 'lucide-react';
import { usePlatform } from '../../platform/PlatformProvider';
import { useAdaGreeting } from '../../hooks/useAdaGreeting';
import { useProject } from '../../context/ProjectContext';
import { loadEngineConfig } from '../../services/engineConfig';
import { computeTrustIndex } from '../../services/trustEngine';

const BLUE = '#2463EB', GREEN = '#059669', AMBER = '#D97706', RED = '#DC2626', PURPLE = '#7C3AED';

// ─── Permission tier model ─────────────────────────────────────────────────────
// Tier 0: Intra-project — only this project's admins can see
// Tier 1: Cross-project — all projects within this agency see the profile
// Tier 2: Cross-agency — agencies that opt in can see each other's verdicts (anonymised agency name)
// Tier 3: Public registry — fieldwork platforms (KoboToolbox etc.) can query the score

type PrivacyTier = 0 | 1 | 2 | 3;

const TIER_META: Record<PrivacyTier, { label: string; color: string; icon: React.ElementType; desc: string }> = {
  0: { label: 'This project only', color: '#9CA3AF', icon: Lock,   desc: 'Visible only to this project\'s administrators.' },
  1: { label: 'This agency',       color: BLUE,     icon: Shield,  desc: 'All projects within your agency can see this profile.' },
  2: { label: 'Partner agencies',  color: PURPLE,   icon: Users,   desc: 'Agencies that opt into mutual sharing see anonymised verdicts.' },
  3: { label: 'Public registry',   color: GREEN,    icon: Globe,   desc: 'Score queryable by any platform. Enumerator controls this.' },
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface EnumeratorProfile {
  id: string;
  name?: string;
  totalSubmissions: number;
  passCount: number;
  flagCount: number;
  rejectCount: number;
  passRate: number;
  flagRate: number;
  avgScore: number;
  trend: 'improving' | 'declining' | 'stable';
  trendDelta: number;           // score delta between first and last quartile
  lifetimeScore: number;        // 0-100 composite lifetime quality
  activeProjects: number;
  privacyTier: PrivacyTier;
  // Computed detail
  scoreHistory: number[];       // avg score by week (last 8 wks)
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  badges: Badge[];
}

interface Badge {
  id: string;
  label: string;
  color: string;
  icon: React.ElementType;
}

// ─── Badge assignment ─────────────────────────────────────────────────────────
function assignBadges(p: Omit<EnumeratorProfile, 'badges'>): Badge[] {
  const badges: Badge[] = [];
  if (p.lifetimeScore >= 85) badges.push({ id: 'elite',    label: 'Elite Fieldworker', color: GREEN,  icon: Star });
  if (p.passRate >= 90)      badges.push({ id: 'reliable', label: 'Highly Reliable',   color: BLUE,   icon: CheckCircle2 });
  if (p.flagRate >= 0.4)     badges.push({ id: 'concern',  label: 'Quality Concern',   color: AMBER,  icon: AlertTriangle });
  if (p.rejectCount / (p.totalSubmissions || 1) >= 0.3) badges.push({ id: 'risk', label: 'High Risk', color: RED, icon: XCircle });
  if (p.trend === 'improving' && p.trendDelta >= 10) badges.push({ id: 'rising', label: 'Rising', color: BLUE, icon: TrendingUp });
  if (p.trend === 'declining' && p.trendDelta <= -10) badges.push({ id: 'declining', label: 'Declining', color: AMBER, icon: TrendingDown });
  return badges;
}

// ─── Build profiles from submissions ──────────────────────────────────────────
function buildProfiles(submissions: Submission[]): EnumeratorProfile[] {
  // The Trust Index is the one number on every surface — grading enumerators
  // off the raw backend score would ignore flag-based penalties (e.g. a GPS
  // parse error) that the Trust Index correctly applies.
  const engineCfg = loadEngineConfig();
  const trustOf = (s: Submission) => computeTrustIndex(s as any, engineCfg).trustIndex;
  const map = new Map<string, Submission[]>();
  for (const s of submissions) {
    if (!map.has(s.enumerator_id)) map.set(s.enumerator_id, []);
    map.get(s.enumerator_id)!.push(s);
  }

  return Array.from(map.entries()).map(([id, subs]) => {
    const total = subs.length;
    const pass = subs.filter(s => s.verdict === 'PASS').length;
    const flag = subs.filter(s => s.verdict === 'FLAG').length;
    const reject = subs.filter(s => s.verdict === 'REJECT').length;
    const avgScore = subs.reduce((a, s) => a + trustOf(s), 0) / total;
    const passRate = pass / total * 100;
    const flagRate = (flag + reject) / total;

    // Sort by date for trend
    const sorted = [...subs].filter(s => s.scored_at)
      .sort((a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime());
    const q = Math.max(1, Math.floor(sorted.length / 4));
    const firstQ = sorted.slice(0, q);
    const lastQ = sorted.slice(-q);
    const firstAvg = firstQ.reduce((a, s) => a + trustOf(s), 0) / (firstQ.length || 1);
    const lastAvg = lastQ.reduce((a, s) => a + trustOf(s), 0) / (lastQ.length || 1);
    const trendDelta = lastAvg - firstAvg;
    const trend: EnumeratorProfile['trend'] = Math.abs(trendDelta) < 5 ? 'stable' : trendDelta > 0 ? 'improving' : 'declining';

    // 8-week sparkline (buckets by floor(index / (n/8)))
    const bucketCount = Math.min(8, total);
    const scoreHistory: number[] = [];
    for (let b = 0; b < bucketCount; b++) {
      const start = Math.floor(b * total / bucketCount);
      const end = Math.floor((b + 1) * total / bucketCount);
      const bucket = sorted.slice(start, end);
      scoreHistory.push(bucket.length ? bucket.reduce((a, s) => a + trustOf(s), 0) / bucket.length : avgScore);
    }

    // Lifetime score: weighted composite
    const lifetimeScore = Math.round(
      passRate * 0.5 +
      avgScore * 0.35 +
      (trend === 'improving' ? 10 : trend === 'declining' ? -5 : 0) +
      Math.min(10, total / 10) * 1.5
    );

    const riskLevel: EnumeratorProfile['riskLevel'] =
      flagRate >= 0.5 ? 'critical' :
      flagRate >= 0.3 ? 'high' :
      flagRate >= 0.15 ? 'medium' : 'low';

    const activeProjects = new Set(subs.map(s => (s as any).project_id).filter(Boolean)).size || 1;

    const base: Omit<EnumeratorProfile, 'badges'> = {
      id, totalSubmissions: total, passCount: pass, flagCount: flag, rejectCount: reject,
      passRate, flagRate, avgScore, trend, trendDelta, lifetimeScore,
      activeProjects, privacyTier: 1,
      scoreHistory, riskLevel,
    };
    return { ...base, badges: assignBadges(base) };
  }).sort((a, b) => b.lifetimeScore - a.lifetimeScore);
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ data, color = BLUE, width = 64, height = 24 }: { data: number[]; color?: string; width?: number; height?: number }) {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={pts.split(' ').pop()!.split(',')[0]} cy={pts.split(' ').pop()!.split(',')[1]} r={2.5} fill={color} />
    </svg>
  );
}

// ─── Score badge ──────────────────────────────────────────────────────────────
function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? GREEN : score >= 50 ? BLUE : score >= 30 ? AMBER : RED;
  const label = score >= 75 ? 'A' : score >= 50 ? 'B' : score >= 30 ? 'C' : 'D';
  return (
    <div style={{ width: 36, height: 36, borderRadius: 9, background: color, display: 'grid', placeItems: 'center', flexShrink: 0, boxShadow: `0 2px 8px ${color}40` }}>
      <span style={{ fontSize: 14, fontWeight: 900, color: 'white', fontFamily: 'monospace' }}>{label}</span>
    </div>
  );
}

// ─── Privacy tier picker ──────────────────────────────────────────────────────
function TierPicker({ tier, onChange }: { tier: PrivacyTier; onChange: (t: PrivacyTier) => void }) {
  const [open, setOpen] = useState(false);
  const meta = TIER_META[tier];
  const Icon = meta.icon;
  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', border: `1px solid ${meta.color}30`, borderRadius: 7, background: meta.color + '10', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: meta.color }}>
        <Icon size={11} /> {meta.label}
        <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            style={{ position: 'absolute', top: '100%', right: 0, zIndex: 50, marginTop: 4, background: 'white', borderRadius: 10, border: '1px solid #E8EDF5', boxShadow: '0 8px 24px rgba(0,0,0,.12)', minWidth: 220, overflow: 'hidden' }}>
            {([0, 1, 2, 3] as PrivacyTier[]).map(t => {
              const m = TIER_META[t];
              const TIcon = m.icon;
              return (
                <button key={t} onClick={() => { onChange(t); setOpen(false); }}
                  style={{ width: '100%', display: 'flex', gap: 10, padding: '10px 14px', background: tier === t ? m.color + '10' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left', borderBottom: t < 3 ? '1px solid #F8FAFF' : 'none' }}>
                  <TIcon size={14} color={m.color} style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: m.color }}>{m.label}</div>
                    <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 1, lineHeight: 1.4 }}>{m.desc}</div>
                  </div>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Enumerator row ───────────────────────────────────────────────────────────
function EnumRow({ p, rank, onTierChange, expanded, onToggle }: {
  p: EnumeratorProfile; rank: number;
  onTierChange: (id: string, tier: PrivacyTier) => void;
  expanded: boolean; onToggle: () => void;
}) {
  const TrendIcon = p.trend === 'improving' ? TrendingUp : p.trend === 'declining' ? TrendingDown : Minus;
  const trendColor = p.trend === 'improving' ? GREEN : p.trend === 'declining' ? RED : '#9CA3AF';
  const riskColor = p.riskLevel === 'critical' ? RED : p.riskLevel === 'high' ? AMBER : p.riskLevel === 'medium' ? BLUE : GREEN;
  const lastSpark = p.scoreHistory[p.scoreHistory.length - 1] ?? p.avgScore;
  const sparkColor = lastSpark >= 70 ? GREEN : lastSpark >= 45 ? AMBER : RED;

  return (
    <motion.div layout style={{ borderBottom: '1px solid #F8FAFF', overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '14px 20px', background: expanded ? '#FAFBFF' : 'white', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        {/* Rank */}
        <div style={{ width: 22, fontSize: 11, fontWeight: 700, color: rank <= 3 ? AMBER : '#CBD5E1', textAlign: 'center', flexShrink: 0 }}>
          {rank <= 3 ? '★' : rank}
        </div>

        {/* Score badge */}
        <ScoreBadge score={p.lifetimeScore} />

        {/* Identity */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#080D1A' }}>{p.id}</span>
            {p.badges.slice(0, 2).map(b => {
              const BIcon = b.icon;
              return (
                <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9.5, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: b.color + '15', color: b.color, border: `1px solid ${b.color}25` }}>
                  <BIcon size={9} />{b.label}
                </span>
              );
            })}
          </div>
          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
            {p.totalSubmissions} submissions · {p.passRate.toFixed(0)}% pass rate
          </div>
        </div>

        {/* Sparkline */}
        <div style={{ flexShrink: 0 }}>
          <Sparkline data={p.scoreHistory} color={sparkColor} />
        </div>

        {/* Avg score */}
        <div style={{ textAlign: 'right', flexShrink: 0, minWidth: 44 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#080D1A', fontFamily: 'monospace' }}>{p.lifetimeScore}</div>
          <div style={{ fontSize: 9.5, color: '#9CA3AF' }}>/ 100</div>
        </div>

        {/* Trend */}
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 3 }}>
          <TrendIcon size={13} color={trendColor} />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: trendColor }}>{Math.abs(p.trendDelta).toFixed(0)}</span>
        </div>

        {/* Risk */}
        <div style={{ width: 8, height: 8, borderRadius: '50%', background: riskColor, flexShrink: 0 }} title={`${p.riskLevel} risk`} />

        {/* Privacy tier */}
        <div onClick={e => e.stopPropagation()}>
          <TierPicker tier={p.privacyTier} onChange={t => onTierChange(p.id, t)} />
        </div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }} style={{ overflow: 'hidden' }}>
            <div style={{ padding: '0 20px 16px 54px', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {/* Verdict breakdown */}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 8 }}>Verdict Breakdown</div>
                {([['PASS', p.passCount, GREEN], ['FLAG', p.flagCount, AMBER], ['REJECT', p.rejectCount, RED]] as const).map(([label, count, color]) => (
                  <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <div style={{ width: 36, fontSize: 9.5, fontWeight: 700, color }}>{label}</div>
                    <div style={{ flex: 1, height: 6, background: '#E8EDF5', borderRadius: 3, overflow: 'hidden' }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(count / p.totalSubmissions * 100)}%` }} transition={{ duration: .6 }}
                        style={{ height: '100%', background: color, borderRadius: 3 }} />
                    </div>
                    <div style={{ width: 28, fontSize: 10.5, fontWeight: 700, color, textAlign: 'right', fontFamily: 'monospace' }}>{count}</div>
                  </div>
                ))}
              </div>

              {/* Stats */}
              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 8 }}>Performance Metrics</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {[
                    ['Avg Score',    `${p.avgScore.toFixed(0)}/100`],
                    ['Pass Rate',    `${p.passRate.toFixed(1)}%`],
                    ['Flag Rate',    `${(p.flagRate * 100).toFixed(1)}%`],
                    ['Projects',     String(p.activeProjects)],
                  ].map(([label, val]) => (
                    <div key={label} style={{ background: '#F8FAFF', borderRadius: 7, padding: '7px 10px' }}>
                      <div style={{ fontSize: 9.5, color: '#9CA3AF', marginBottom: 2 }}>{label}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#080D1A', fontFamily: 'monospace' }}>{val}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* All badges */}
              {p.badges.length > 0 && (
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: .7, marginBottom: 8 }}>Badges</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {p.badges.map(b => {
                      const BIcon = b.icon;
                      return (
                        <span key={b.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 700, padding: '5px 10px', borderRadius: 6, background: b.color + '15', color: b.color, border: `1px solid ${b.color}25` }}>
                          <BIcon size={11} />{b.label}
                        </span>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 7, background: '#F8FAFF', border: '1px solid #E8EDF5', fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
                    <strong style={{ color: '#374151' }}>Privacy:</strong> {TIER_META[p.privacyTier].desc}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function ScorecardPage() {
  const { t } = usePlatform();
  useAdaGreeting({ page: "scorecard" });
  const { activeProject } = useProject();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'score' | 'passRate' | 'submissions' | 'risk'>('score');
  const [riskFilter, setRiskFilter] = useState<'all' | 'medium' | 'high' | 'critical'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | 'public'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tiers, setTiers] = useState<Map<string, PrivacyTier>>(new Map());
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);

  useEffect(() => {
    // Active project scopes the data; none = explicit "All projects" view.
    dashboardApi.getSubmissions({ limit: 500, ...(activeProject?.id ? { project_id: activeProject.id } : {}) })
      .then(r => { setSubmissions(Array.isArray(r.data.submissions || r.data) ? (r.data.submissions || r.data) : []); })
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, [activeProject?.id]);

  const profiles = useMemo(() => {
    const raw = buildProfiles(submissions);
    return raw.map(p => ({ ...p, privacyTier: (tiers.get(p.id) ?? p.privacyTier) as PrivacyTier }));
  }, [submissions, tiers]);

  const filtered = useMemo(() => {
    let list = profiles;
    if (search) list = list.filter(p => p.id.toLowerCase().includes(search.toLowerCase()));
    if (riskFilter !== 'all') list = list.filter(p => {
      if (riskFilter === 'critical') return p.riskLevel === 'critical';
      if (riskFilter === 'high') return p.riskLevel === 'critical' || p.riskLevel === 'high';
      return p.riskLevel === 'critical' || p.riskLevel === 'high' || p.riskLevel === 'medium';
    });
    if (tierFilter === 'public') list = list.filter(p => p.privacyTier >= 2);
    if (sortBy === 'score') list = [...list].sort((a, b) => b.lifetimeScore - a.lifetimeScore);
    if (sortBy === 'passRate') list = [...list].sort((a, b) => b.passRate - a.passRate);
    if (sortBy === 'submissions') list = [...list].sort((a, b) => b.totalSubmissions - a.totalSubmissions);
    if (sortBy === 'risk') list = [...list].sort((a, b) => {
      const rank = { critical: 3, high: 2, medium: 1, low: 0 };
      return rank[b.riskLevel] - rank[a.riskLevel];
    });
    return list;
  }, [profiles, search, riskFilter, tierFilter, sortBy]);

  const onTierChange = useCallback((id: string, tier: PrivacyTier) => {
    setTiers(prev => new Map(prev).set(id, tier));
  }, []);

  const stats = useMemo(() => {
    if (!profiles.length) return null;
    const elite = profiles.filter(p => p.lifetimeScore >= 75).length;
    const atRisk = profiles.filter(p => p.riskLevel === 'critical' || p.riskLevel === 'high').length;
    const improving = profiles.filter(p => p.trend === 'improving').length;
    const avgLifetime = Math.round(profiles.reduce((a, p) => a + p.lifetimeScore, 0) / profiles.length);
    return { elite, atRisk, improving, avgLifetime, total: profiles.length };
  }, [profiles]);

  const enumeratorLabel = t('enumerator', 'enumerator');
  const enumeratorsLabel = t('enumerators', 'enumerators');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#FFF7ED,#FEF3C7)', border: '1px solid #FDE68A', display: 'grid', placeItems: 'center' }}>
              <Award size={16} color={AMBER} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#080D1A', letterSpacing: -.6, margin: 0 }}>
              {enumeratorLabel.charAt(0).toUpperCase() + enumeratorLabel.slice(1)} Scorecard
            </h1>
          </div>
          <p style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 4 }}>
            {loading ? 'Loading…' : stats
              ? `${stats.total} ${enumeratorsLabel} tracked · ${stats.elite} elite · ${stats.atRisk} at risk`
              : 'No data'}
          </p>
        </div>
        <button onClick={() => setShowPrivacyInfo(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: showPrivacyInfo ? '#F0F4FF' : 'white', fontSize: 12.5, fontWeight: 600, color: showPrivacyInfo ? BLUE : '#374151', cursor: 'pointer' }}>
          {showPrivacyInfo ? <EyeOff size={13} /> : <Eye size={13} />} Privacy & Sharing
        </button>
      </div>

      {/* Privacy info panel */}
      <AnimatePresence>
        {showPrivacyInfo && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <div style={{ background: 'white', borderRadius: 14, border: '1px solid #E8EDF5', padding: 20, boxShadow: '0 2px 12px rgba(10,15,28,.06)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#374151', marginBottom: 12 }}>How scorecard sharing works</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {([0, 1, 2, 3] as PrivacyTier[]).map(tier => {
                  const m = TIER_META[tier];
                  const TIcon = m.icon;
                  return (
                    <div key={tier} style={{ padding: '12px 14px', borderRadius: 10, background: m.color + '08', border: `1px solid ${m.color}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                        <TIcon size={13} color={m.color} />
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: m.color }}>{m.label}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.5 }}>{m.desc}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#374151' }}>
                  <input type="checkbox" checked={tierFilter === 'public'} onChange={e => setTierFilter(e.target.checked ? 'public' : 'all')} />
                  Show only public-sharing tiers (2+)
                </label>
              </div>
              <div style={{ marginTop: 10, padding: '10px 14px', borderRadius: 9, background: '#FFFBEB', border: '1px solid #FDE68A', fontSize: 11.5, color: '#92400E', lineHeight: 1.6 }}>
                <strong>Enumerator rights:</strong> {enumeratorLabel.charAt(0).toUpperCase() + enumeratorLabel.slice(1)}s can request to view their own scorecard, contest any data point, and opt out of cross-agency sharing at any time. Under NDPA 2023 and GDPR, they have the right to access, correct, and restrict processing of their personal data.
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary chips */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          {[
            { label: 'Avg Lifetime Score',  value: stats.avgLifetime,  unit: '/100', color: stats.avgLifetime >= 70 ? GREEN : AMBER, icon: BarChart2 },
            { label: 'Elite Fieldworkers',  value: stats.elite,        unit: '',     color: AMBER,  icon: Star },
            { label: 'At Risk',             value: stats.atRisk,       unit: '',     color: RED,    icon: AlertTriangle },
            { label: 'Improving Trend',     value: stats.improving,    unit: '',     color: BLUE,   icon: TrendingUp },
          ].map(({ label, value, unit, color, icon: Icon }) => (
            <div key={label} style={{ background: 'white', borderRadius: 12, border: '1px solid #E8EDF5', padding: '14px 16px', boxShadow: '0 2px 8px rgba(10,15,28,.04)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: color + '15', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icon size={16} color={color} />
              </div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#080D1A', fontFamily: 'monospace', lineHeight: 1 }}>{value}{unit}</div>
                <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 3 }}>{label}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E8EDF5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(10,15,28,.06)' }}>
        {/* Filter bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #F1F5F9', flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={`Search ${enumeratorsLabel}…`}
            style={{ flex: 1, minWidth: 180, border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 12px', fontSize: 12.5, outline: 'none', color: '#374151', fontFamily: 'Inter, sans-serif' }} />

          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'medium', 'high', 'critical'] as const).map(r => (
              <button key={r} onClick={() => setRiskFilter(r)}
                style={{ padding: '6px 11px', border: `1px solid ${riskFilter === r ? RED : '#E2E8F0'}`, borderRadius: 7, background: riskFilter === r ? RED + '10' : 'white', fontSize: 11, fontWeight: 600, color: riskFilter === r ? RED : '#6B7280', cursor: 'pointer' }}>
                {r === 'all' ? 'All risk' : r}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: '#6B7280' }}>
            Sort:
            {(['score', 'passRate', 'submissions', 'risk'] as const).map(s => (
              <button key={s} onClick={() => setSortBy(s)}
                style={{ padding: '5px 9px', border: 'none', borderRadius: 6, background: sortBy === s ? BLUE + '15' : 'transparent', fontSize: 11, fontWeight: sortBy === s ? 700 : 500, color: sortBy === s ? BLUE : '#9CA3AF', cursor: 'pointer' }}>
                {s === 'passRate' ? 'Pass rate' : s === 'submissions' ? 'Volume' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 20px', background: '#FAFBFF', borderBottom: '1px solid #F1F5F9' }}>
          <div style={{ width: 22 }} />
          <div style={{ width: 36 }} />
          <div style={{ flex: 1, fontSize: 10, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: .7 }}>{enumeratorLabel.toUpperCase()}</div>
          <div style={{ width: 64, fontSize: 10, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: .7 }}>TREND</div>
          <div style={{ minWidth: 44, fontSize: 10, fontWeight: 700, color: '#CBD5E1', textTransform: 'uppercase', letterSpacing: .7, textAlign: 'right' }}>SCORE</div>
          <div style={{ width: 18 }} />
          <div style={{ width: 8 }} />
          <div style={{ minWidth: 100 }} />
        </div>

        {/* Rows */}
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF' }}>Loading {enumeratorsLabel}…</div>
        ) : !filtered.length ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <Users size={28} color="#E2E8F0" style={{ marginBottom: 8 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>No {enumeratorsLabel} found</div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>Try adjusting your filters</div>
          </div>
        ) : (
          filtered.map((p, i) => (
            <EnumRow key={p.id} p={p} rank={i + 1}
              onTierChange={onTierChange}
              expanded={expandedId === p.id}
              onToggle={() => setExpandedId(prev => prev === p.id ? null : p.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
