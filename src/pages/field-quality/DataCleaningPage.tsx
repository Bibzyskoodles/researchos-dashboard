import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dashboardApi } from '../../services/api';
import { Submission } from '../../types';
import {
  Shield, Clock, Zap, Users, MapPin, ChevronDown,
  Navigation, RotateCcw, FileText, Play, Download,
  CheckCircle2, XCircle, Sliders, Flag, Trash2, Calendar, AlertTriangle,
  Type, Check, Plus, X,
} from 'lucide-react';
import { usePlatform } from '../../platform/PlatformProvider';

const BLUE = '#2463EB', GREEN = '#059669', AMBER = '#D97706', RED = '#DC2626', PURPLE = '#7C3AED';

// ─── Text standardization ─────────────────────────────────────────────────────
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) { dp[i] = [i]; for (let j = 1; j <= n; j++) dp[i][j] = 0; }
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
    }
  }
  return dp[m][n];
}

const CANONICAL_PLACES: string[] = [
  'Lagos','Abuja','Kano','Ibadan','Port Harcourt','Kaduna','Enugu','Benin City',
  'Onitsha','Warri','Aba','Jos','Sokoto','Maiduguri','Calabar','Uyo','Abeokuta',
  'Akure','Osogbo','Ilorin','Owerri','Asaba','Bauchi','Yola','Makurdi','Lafia',
  'Gusau','Birnin Kebbi','Dutse','Jalingo','Damaturu','Gombe','Lokoja','Minna',
  'Awka','Umuahia','Abakaliki','Ado Ekiti','Ikeja','Surulere','Lekki',
  'Victoria Island','Ajah','Yaba','Agege','Alimosho','Ikorodu','Mushin',
  'Nairobi','Accra','Kampala','Dar es Salaam','Addis Ababa','Dakar','Freetown',
  'Bamako','Ouagadougou','Conakry','Abidjan','Kumasi','Douala','Yaoundé',
  'Kigali','Lusaka','Harare','Maputo','Windhoek','Gaborone','Lilongwe',
];

interface TextCorrection {
  raw: string;
  canonical: string;
  distance: number;
  count: number;
  submissionIds: string[];
  field: string;
}

interface CustomCorrection {
  raw: string;
  canonical: string;
}

function detectTextCorrections(submissions: Submission[]): TextCorrection[] {
  const addrMap = new Map<string, string[]>();
  for (const sub of submissions) {
    if (!sub.gps?.address) continue;
    const parts = sub.gps.address.split(',').map((p: string) => p.trim()).filter(Boolean);
    for (const part of parts.slice(0, 3)) {
      if (part.length < 2) continue;
      const key = `addr:${part}`;
      if (!addrMap.has(key)) addrMap.set(key, []);
      addrMap.get(key)!.push(sub.submission_id);
    }
  }

  const corrections: TextCorrection[] = [];
  for (const [key, subIds] of Array.from(addrMap.entries())) {
    const raw = key.replace(/^addr:/, '');
    const rawLower = raw.toLowerCase();
    let bestCanonical = '', bestDist = Infinity;
    for (const canonical of CANONICAL_PLACES) {
      const canonLower = canonical.toLowerCase();
      if (rawLower === canonLower) { bestDist = 0; bestCanonical = canonical; break; }
      const dist = levenshtein(rawLower, canonLower);
      const threshold = Math.max(1, Math.floor(Math.min(rawLower.length, canonLower.length) * 0.25));
      if (dist <= threshold && dist < bestDist) { bestDist = dist; bestCanonical = canonical; }
    }
    if (bestDist > 0 && bestDist < Infinity && bestCanonical) {
      corrections.push({ raw, canonical: bestCanonical, distance: bestDist, count: subIds.length, submissionIds: subIds, field: 'GPS Address' });
    }
  }
  return corrections.sort((a, b) => b.count - a.count || a.distance - b.distance);
}

// ─── Haversine distance (km) ──────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
    * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface RuleConfig {
  minScore: number;
  minDuration: number;
  maxDuration: number;
  maxFlagRate: number;
  maxSpeedKmh: number;
  geoSigma: number;
  retentionDays90: number;
  retentionDays365: number;
}

interface ViolationDetail {
  submissionId: string;
  enumeratorId: string;
  from: string;
  to: string;
  distKm: number;
  minutes: number;
  speedKmh: number;
}

interface RuleState { id: string; enabled: boolean; }

const RULE_META: Record<string, { label: string; desc: string; color: string; icon: React.ElementType; category: string }> = {
  rejected:               { label: 'FieldScore Rejections',     desc: 'All submissions already scored as REJECT by FieldScore engines.', color: RED,    icon: XCircle,       category: 'FieldScore' },
  flagged:                { label: 'FieldScore Flags',           desc: 'Submissions flagged for review — exclude if you need a clean confirmatory dataset.', color: AMBER,  icon: Flag,          category: 'FieldScore' },
  low_score:              { label: 'Low Quality Score',          desc: 'Overall FieldScore below your threshold. Configurable.',                           color: AMBER,  icon: Sliders,       category: 'Score' },
  too_fast:               { label: 'Impossibly Fast Interviews', desc: 'Duration shorter than your minimum — likely scripted or skipped responses.',        color: RED,    icon: Zap,           category: 'Duration' },
  abandoned:              { label: 'Abandoned Surveys',          desc: 'Duration far exceeds norms — respondent likely walked away mid-form.',              color: AMBER,  icon: Clock,         category: 'Duration' },
  contaminated_enumerator:{ label: 'Enumerator Contamination',  desc: 'All submissions from enumerators whose overall flag rate exceeds your threshold. The entire body of work becomes suspect.',  color: PURPLE, icon: Users,  category: 'Enumerators' },
  speed_violation:        { label: 'Speed-of-Light Violations',  desc: 'Consecutive GPS positions from the same enumerator imply travel faster than any vehicle can achieve. GPS was fabricated.', color: RED,    icon: Navigation,    category: 'Advanced' },
  geo_outlier:            { label: 'Geographic Outliers',        desc: 'Submissions captured far outside the GPS cluster of your study area.',              color: BLUE,   icon: MapPin,        category: 'Advanced' },
  stale_90d:              { label: 'Older than 90 days',         desc: 'Submissions collected more than 90 days ago. Stale data can distort longitudinal analysis. Adjust the threshold.',      color: AMBER,  icon: Calendar,      category: 'Retention' },
  stale_1y:               { label: 'Older than 1 year',          desc: 'Submissions older than your retention window. Many data protection laws (NDPA, GDPR) require timely deletion of research data.', color: RED, icon: Trash2, category: 'Retention' },
};

const CATEGORY_ORDER = ['FieldScore', 'Score', 'Duration', 'Enumerators', 'Advanced', 'Retention'];

const DEFAULT_RULES: RuleState[] = [
  { id: 'rejected',                enabled: true  },
  { id: 'flagged',                 enabled: false },
  { id: 'low_score',               enabled: true  },
  { id: 'too_fast',                enabled: true  },
  { id: 'abandoned',               enabled: false },
  { id: 'contaminated_enumerator', enabled: true  },
  { id: 'speed_violation',         enabled: true  },
  { id: 'geo_outlier',             enabled: false },
  { id: 'stale_90d',               enabled: false },
  { id: 'stale_1y',                enabled: false },
];

const DEFAULT_CONFIG: RuleConfig = {
  minScore: 40, minDuration: 5, maxDuration: 180,
  maxFlagRate: 0.3, maxSpeedKmh: 120, geoSigma: 2.5,
  retentionDays90: 90, retentionDays365: 365,
};

// ─── Toggle switch ────────────────────────────────────────────────────────────
function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button onClick={e => { e.stopPropagation(); onChange(); }}
      style={{
        width: 34, height: 18, borderRadius: 9, border: 'none', cursor: 'pointer',
        background: on ? BLUE : '#D1D5DB', transition: 'background .2s', position: 'relative', flexShrink: 0,
      }}>
      <div style={{
        position: 'absolute', top: 2, left: on ? 18 : 2,
        width: 14, height: 14, borderRadius: '50%', background: 'white',
        transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.25)',
      }} />
    </button>
  );
}

// ─── Threshold slider ─────────────────────────────────────────────────────────
function ThresholdSlider({ label, value, min, max, step = 1, unit, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; unit: string; onChange: (v: number) => void;
}) {
  return (
    <div style={{ padding: '8px 0 4px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 10.5, color: BLUE, fontWeight: 700, fontFamily: 'monospace' }}>{value}{unit}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: BLUE, height: 3, cursor: 'pointer' }} />
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────
function StatChip({ label, before, after, unit = '', invert = false }: {
  label: string; before: number; after: number; unit?: string; invert?: boolean;
}) {
  const delta = after - before;
  const better = invert ? delta < 0 : delta > 0;
  const fmt = (n: number) => unit === '%' ? n.toFixed(1) + '%' : String(Math.round(n));
  return (
    <div style={{ background: '#F8FAFF', borderRadius: 10, padding: '10px 14px', border: '1px solid #E8EDF5', minWidth: 0 }}>
      <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 6 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: '#080D1A', fontFamily: 'monospace' }}>{fmt(after)}</span>
        {delta !== 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, color: better ? GREEN : RED }}>
            {delta > 0 ? '+' : ''}{fmt(delta)}
          </span>
        )}
      </div>
      <div style={{ fontSize: 10.5, color: '#CBD5E1', marginTop: 2 }}>was {fmt(before)}</div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function DataCleaningPage() {
  const { t } = usePlatform();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [purging, setPurging] = useState(false);
  const [purgeResult, setPurgeResult] = useState<{ success: number; failed: number } | null>(null);
  const [showPurgeModal, setShowPurgeModal] = useState(false);
  const [anonymizeGps, setAnonymizeGps] = useState(false);
  const [rules, setRules] = useState<RuleState[]>(DEFAULT_RULES);
  const [config, setConfig] = useState<RuleConfig>(DEFAULT_CONFIG);
  const [tab, setTab] = useState<'removed' | 'by-rule' | 'provenance' | 'text-fix'>('removed');
  const [approvedFixes, setApprovedFixes] = useState<Set<string>>(new Set());
  const [customCorrections, setCustomCorrections] = useState<CustomCorrection[]>([]);
  const [addingCustom, setAddingCustom] = useState(false);
  const [customRaw, setCustomRaw] = useState('');
  const [customCanonical, setCustomCanonical] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORY_ORDER));

  useEffect(() => {
    dashboardApi.getSubmissions({ limit: 500 })
      .then(r => { setSubmissions(Array.isArray(r.data.submissions || r.data) ? (r.data.submissions || r.data) : []); })
      .catch(() => setSubmissions([]))
      .finally(() => setLoading(false));
  }, []);

  const toggleRule = useCallback((id: string) => {
    setRules(prev => prev.map(r => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }, []);

  const toggleCategory = useCallback((cat: string) => {
    setExpandedCategories(prev => {
      const n = new Set(prev);
      n.has(cat) ? n.delete(cat) : n.add(cat);
      return n;
    });
  }, []);

  // ─── Analysis engine ────────────────────────────────────────────────────────
  const analysis = useMemo(() => {
    if (!submissions.length) return null;

    // Enumerator stats from submissions
    const enumMap = new Map<string, { total: number; bad: number }>();
    for (const sub of submissions) {
      if (!enumMap.has(sub.enumerator_id)) enumMap.set(sub.enumerator_id, { total: 0, bad: 0 });
      const e = enumMap.get(sub.enumerator_id)!;
      e.total++;
      if (sub.verdict === 'FLAG' || sub.verdict === 'REJECT') e.bad++;
    }
    const contaminatedEnums = new Set<string>();
    Array.from(enumMap.entries()).forEach(([eid, stats]) => {
      if (stats.total >= 3 && stats.bad / stats.total > config.maxFlagRate) contaminatedEnums.add(eid);
    });

    // Speed-of-light violations
    const speedViolations = new Map<string, ViolationDetail>();
    const byEnum = new Map<string, Submission[]>();
    for (const sub of submissions) {
      if (!byEnum.has(sub.enumerator_id)) byEnum.set(sub.enumerator_id, []);
      byEnum.get(sub.enumerator_id)!.push(sub);
    }
    Array.from(byEnum.entries()).forEach(([eid, subList]) => {
      const withGps = subList
        .filter(s => s.gps?.lat && s.gps?.lon && s.scored_at)
        .sort((a, b) => new Date(a.scored_at).getTime() - new Date(b.scored_at).getTime());
      for (let i = 1; i < withGps.length; i++) {
        const prev = withGps[i - 1], curr = withGps[i];
        const tPrev = new Date(prev.scored_at).getTime();
        const tCurr = new Date(curr.scored_at).getTime();
        const minutes = (tCurr - tPrev) / 60000;
        if (minutes <= 0 || minutes > 480) continue;
        const distKm = haversineKm(prev.gps.lat, prev.gps.lon, curr.gps.lat, curr.gps.lon);
        const speedKmh = distKm / (minutes / 60);
        if (speedKmh > config.maxSpeedKmh && distKm > 10) {
          speedViolations.set(curr.submission_id, {
            submissionId: curr.submission_id,
            enumeratorId: eid,
            from: prev.gps.address?.split(',')[0] || `${prev.gps.lat.toFixed(3)},${prev.gps.lon.toFixed(3)}`,
            to: curr.gps.address?.split(',')[0] || `${curr.gps.lat.toFixed(3)},${curr.gps.lon.toFixed(3)}`,
            distKm: Math.round(distKm),
            minutes: Math.round(minutes),
            speedKmh: Math.round(speedKmh),
          });
        }
      }
    });

    // Geographic outliers
    const geoOutliers = new Set<string>();
    const gpsPoints = submissions.filter(s => s.gps?.lat && s.gps?.lon);
    if (gpsPoints.length > 5) {
      const lats = gpsPoints.map(s => s.gps.lat);
      const lons = gpsPoints.map(s => s.gps.lon);
      const meanLat = lats.reduce((a, b) => a + b, 0) / lats.length;
      const meanLon = lons.reduce((a, b) => a + b, 0) / lons.length;
      const sdLat = Math.sqrt(lats.reduce((a, b) => a + (b - meanLat) ** 2, 0) / lats.length);
      const sdLon = Math.sqrt(lons.reduce((a, b) => a + (b - meanLon) ** 2, 0) / lons.length);
      for (const sub of gpsPoints) {
        if (Math.abs(sub.gps.lat - meanLat) > config.geoSigma * sdLat ||
            Math.abs(sub.gps.lon - meanLon) > config.geoSigma * sdLon) {
          geoOutliers.add(sub.submission_id);
        }
      }
    }

    // Per-rule hit sets
    const now = Date.now();
    const ms90 = config.retentionDays90 * 86400000;
    const ms365 = config.retentionDays365 * 86400000;
    const hits: Record<string, Set<string>> = {
      rejected: new Set(), flagged: new Set(), low_score: new Set(),
      too_fast: new Set(), abandoned: new Set(), contaminated_enumerator: new Set(),
      speed_violation: new Set(speedViolations.keys()),
      geo_outlier: geoOutliers,
      stale_90d: new Set(), stale_1y: new Set(),
    };
    for (const sub of submissions) {
      if (sub.verdict === 'REJECT') hits.rejected.add(sub.submission_id);
      if (sub.verdict === 'FLAG') hits.flagged.add(sub.submission_id);
      if (sub.overall_score < config.minScore) hits.low_score.add(sub.submission_id);
      const dur = Number(sub.duration_mins);
      if (dur > 0 && dur < config.minDuration) hits.too_fast.add(sub.submission_id);
      if (dur > config.maxDuration) hits.abandoned.add(sub.submission_id);
      if (contaminatedEnums.has(sub.enumerator_id)) hits.contaminated_enumerator.add(sub.submission_id);
      if (sub.scored_at) {
        const age = now - new Date(sub.scored_at).getTime();
        if (age > ms90) hits.stale_90d.add(sub.submission_id);
        if (age > ms365) hits.stale_1y.add(sub.submission_id);
      }
    }

    // Combine enabled rules
    const enabledRules = new Set(rules.filter(r => r.enabled).map(r => r.id));
    const removedIds = new Set<string>();
    Object.entries(hits).forEach(([ruleId, hitSet]) => {
      if (enabledRules.has(ruleId)) hitSet.forEach(id => removedIds.add(id));
    });

    const removed = submissions.filter(s => removedIds.has(s.submission_id));
    const kept = submissions.filter(s => !removedIds.has(s.submission_id));
    const avgBefore = submissions.reduce((a, s) => a + s.overall_score, 0) / submissions.length;
    const avgAfter = kept.length ? kept.reduce((a, s) => a + s.overall_score, 0) / kept.length : 0;
    const passBefore = submissions.filter(s => s.verdict === 'PASS').length / submissions.length * 100;
    const passAfter = kept.length ? kept.filter(s => s.verdict === 'PASS').length / kept.length * 100 : 0;
    // Margin of error approximation: 1.96 * sqrt(p*(1-p)/n) for a proportion near 0.5
    const moe = (n: number) => n > 1 ? (1.96 * Math.sqrt(0.25 / n) * 100) : 99;

    return {
      hits, removedIds, removed, kept, contaminatedEnums, enumMap, speedViolations, geoOutliers,
      stats: {
        rawCount: submissions.length, cleanCount: kept.length,
        removedCount: removedIds.size, removedPct: removedIds.size / submissions.length * 100,
        avgBefore, avgAfter, passBefore, passAfter,
        moeBefore: moe(submissions.length), moeAfter: moe(kept.length),
      },
    };
  }, [submissions, rules, config]);

  const textCorrections = useMemo(() => {
    const detected = detectTextCorrections(submissions);
    const customMapped: TextCorrection[] = customCorrections.map(cc => {
      const affected = submissions.filter(s =>
        s.gps?.address?.split(',').some((p: string) => p.trim().toLowerCase() === cc.raw.toLowerCase())
      );
      return { raw: cc.raw, canonical: cc.canonical, distance: 1, count: affected.length, submissionIds: affected.map(s => s.submission_id), field: 'Custom' };
    });
    return [...detected, ...customMapped];
  }, [submissions, customCorrections]);

  const approvedTextCount = useMemo(() =>
    textCorrections.filter(c => approvedFixes.has(`${c.raw}→${c.canonical}`)).reduce((a, c) => a + c.count, 0),
  [textCorrections, approvedFixes]);

  const applyClean = useCallback(async () => {
    if (!analysis?.removedIds.size) return;
    setApplying(true);
    const ids = Array.from(analysis.removedIds);
    await Promise.allSettled(ids.map(id => dashboardApi.actionSubmission(id, 'reject')));
    setApplying(false);
    setApplied(true);
    setSubmissions(prev => prev.map(s => analysis.removedIds.has(s.submission_id)
      ? { ...s, verdict: 'REJECT' as const } : s));
  }, [analysis]);

  const exportProvenance = useCallback(() => {
    if (!analysis) return;
    const { stats, hits, contaminatedEnums, speedViolations } = analysis;
    const enabled = rules.filter(r => r.enabled);
    const now = new Date().toISOString();
    let report = `DATA CLEANING REPORT\nResearchOS · Generated ${now}\n${'═'.repeat(48)}\n\n`;
    report += `Raw Dataset:    ${stats.rawCount.toLocaleString()} submissions\n`;
    report += `Removed:        ${stats.removedCount.toLocaleString()} (${stats.removedPct.toFixed(1)}%)\n`;
    report += `Clean Dataset:  ${stats.cleanCount.toLocaleString()} submissions\n\n`;
    report += `REMOVAL BREAKDOWN\n${'─'.repeat(32)}\n`;
    const lines: string[] = [];
    enabled.forEach(rule => {
      const count = hits[rule.id]?.size ?? 0;
      if (!count) return;
      const meta = RULE_META[rule.id];
      lines.push(`${meta.label.padEnd(32)} ${String(count).padStart(4)}  (${(count / stats.rawCount * 100).toFixed(1)}%)`);
      if (rule.id === 'contaminated_enumerator') {
        Array.from(contaminatedEnums).forEach(eid => {
          const es = analysis.enumMap.get(eid);
          if (es) lines.push(`  └─ ${eid}  (${Math.round(es.bad / es.total * 100)}% flag rate, ${es.total} submissions)`);
        });
      }
      if (rule.id === 'speed_violation') {
        Array.from(speedViolations.values()).forEach(v => {
          lines.push(`  └─ ${v.enumeratorId}: ${v.from} → ${v.to}  (${v.distKm}km in ${v.minutes}min = ${v.speedKmh}km/h)`);
        });
      }
    });
    report += lines.join('\n') + '\n';
    report += `\nQUALITY IMPACT\n${'─'.repeat(32)}\n`;
    report += `Average Score:  ${stats.avgBefore.toFixed(1)} → ${stats.avgAfter.toFixed(1)}  (${stats.avgAfter > stats.avgBefore ? '+' : ''}${(stats.avgAfter - stats.avgBefore).toFixed(1)})\n`;
    report += `Pass Rate:      ${stats.passBefore.toFixed(1)}% → ${stats.passAfter.toFixed(1)}%  (${stats.passAfter > stats.passBefore ? '+' : ''}${(stats.passAfter - stats.passBefore).toFixed(1)}pp)\n`;
    report += `Margin of Error: ±${stats.moeBefore.toFixed(1)}% → ±${stats.moeAfter.toFixed(1)}%\n`;
    report += `\n${'─'.repeat(48)}\nGenerated by ResearchOS Data Clean Room\n`;
    const blob = new Blob([report], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'cleaning-provenance.txt'; a.click();
    URL.revokeObjectURL(url);
  }, [analysis, rules]);

  const purgeData = useCallback(async () => {
    if (!analysis?.removedIds.size) return;
    setPurging(true);
    setShowPurgeModal(false);
    const ids = Array.from(analysis.removedIds);
    const results = await Promise.allSettled(ids.map(id => dashboardApi.deleteSubmission(id)));
    const success = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    setPurgeResult({ success, failed });
    setPurging(false);
    if (success > 0) {
      setSubmissions(prev => prev.filter(s => !analysis.removedIds.has(s.submission_id)));
    }
  }, [analysis]);

  const applyTextFix = useCallback((address: string): string => {
    if (!approvedFixes.size) return address;
    let fixed = address;
    for (const correction of textCorrections) {
      const key = `${correction.raw}→${correction.canonical}`;
      if (!approvedFixes.has(key)) continue;
      const parts = fixed.split(',');
      fixed = parts.map((p: string) => {
        const trimmed = p.trim();
        return trimmed.toLowerCase() === correction.raw.toLowerCase() ? p.replace(trimmed, correction.canonical) : p;
      }).join(',');
    }
    return fixed;
  }, [approvedFixes, textCorrections]);

  const exportClean = useCallback(() => {
    if (!analysis) return;
    const headers = ['submission_id', 'enumerator_id', 'verdict', 'overall_score', 'duration_mins', 'scored_at',
      'gps_address',
      ...(anonymizeGps ? ['gps_lat', 'gps_lon'] : [])];
    const rows = analysis.kept.map(s => {
      const fixedAddr = s.gps?.address ? applyTextFix(s.gps.address) : '';
      const base = [s.submission_id, s.enumerator_id, s.verdict, s.overall_score, s.duration_mins ?? '', s.scored_at ?? '', `"${fixedAddr}"`];
      if (anonymizeGps && s.gps?.lat && s.gps?.lon) {
        base.push(s.gps.lat.toFixed(3), s.gps.lon.toFixed(3));
      } else if (anonymizeGps) {
        base.push('', '');
      }
      return base.join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'clean-dataset.csv'; a.click();
    URL.revokeObjectURL(url);
  }, [analysis, anonymizeGps, applyTextFix]);

  // Group rules by category
  const rulesByCategory = useMemo(() => {
    const map = new Map<string, RuleState[]>();
    for (const cat of CATEGORY_ORDER) map.set(cat, []);
    for (const rule of rules) {
      const cat = RULE_META[rule.id].category;
      map.get(cat)?.push(rule);
    }
    return map;
  }, [rules]);

  const s = analysis?.stats;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#EFF4FF,#F5F0FF)', border: '1px solid #C7D2FE', display: 'grid', placeItems: 'center' }}>
              <Shield size={16} color={BLUE} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#080D1A', letterSpacing: -.6, margin: 0 }}>Data Clean Room</h1>
          </div>
          <p style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 4 }}>
            {loading ? 'Loading…' : s
              ? `${s.rawCount.toLocaleString()} raw submissions · ${s.removedCount} marked for removal`
              : 'No data'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={exportProvenance} disabled={!analysis}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: 'white', fontSize: 12.5, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
            <FileText size={13} /> Provenance Report
          </button>
          <button
            onClick={() => setAnonymizeGps(v => !v)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: `1px solid ${anonymizeGps ? BLUE : '#E2E8F0'}`, borderRadius: 8, background: anonymizeGps ? BLUE + '10' : 'white', fontSize: 12.5, fontWeight: 600, color: anonymizeGps ? BLUE : '#374151', cursor: 'pointer' }}>
            <MapPin size={13} /> {anonymizeGps ? 'GPS Anonymized' : 'Anonymize GPS'}
          </button>
          <button onClick={exportClean} disabled={!analysis}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1px solid #E2E8F0', borderRadius: 8, background: 'white', fontSize: 12.5, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
            <Download size={13} /> Export Clean CSV
          </button>
          <button onClick={() => setShowPurgeModal(true)} disabled={purging || !analysis?.removedIds.size || !!purgeResult}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: `1px solid ${purgeResult ? GREEN : '#FECACA'}`, borderRadius: 8,
              background: purgeResult ? GREEN + '10' : '#FEF2F2', fontSize: 12.5, fontWeight: 600,
              color: purgeResult ? GREEN : analysis?.removedIds.size ? RED : '#9CA3AF',
              cursor: purging || !analysis?.removedIds.size || !!purgeResult ? 'not-allowed' : 'pointer',
            }}>
            {purgeResult ? <><CheckCircle2 size={13} /> {purgeResult.success} Purged</> :
             purging ? <><RotateCcw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Purging…</> :
             <><Trash2 size={13} /> Purge Records</>}
          </button>
          <button onClick={applyClean} disabled={applying || !analysis?.removedIds.size || applied}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', border: 'none', borderRadius: 8,
              background: applied ? GREEN : analysis?.removedIds.size ? RED : '#E5E7EB',
              fontSize: 12.5, fontWeight: 700, color: applied || analysis?.removedIds.size ? 'white' : '#9CA3AF',
              cursor: applying || !analysis?.removedIds.size || applied ? 'not-allowed' : 'pointer',
              transition: 'all .2s',
            }}>
            {applied ? <><CheckCircle2 size={13} /> Cleaning Applied</> :
             applying ? <><RotateCcw size={13} style={{ animation: 'spin 1s linear infinite' }} /> Applying…</> :
             <><Play size={13} /> Apply Cleaning ({analysis?.removedIds.size ?? 0})</>}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 16, alignItems: 'start' }}>

        {/* ── Left: Rules panel ──────────────────────────────────────────── */}
        <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E8EDF5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(10,15,28,.06)', position: 'sticky', top: 16 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFF' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .8 }}>Cleaning Rules</div>
            <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 2 }}>Toggle to include in removal</div>
          </div>

          {CATEGORY_ORDER.map(cat => {
            const catRules = rulesByCategory.get(cat) || [];
            const expanded = expandedCategories.has(cat);
            const activeInCat = catRules.filter(r => r.enabled).length;
            return (
              <div key={cat} style={{ borderBottom: '1px solid #F8FAFF' }}>
                <button onClick={() => toggleCategory(cat)}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                  <ChevronDown size={11} color="#9CA3AF" style={{ transform: expanded ? 'none' : 'rotate(-90deg)', transition: 'transform .2s', flexShrink: 0 }} />
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#CBD5E1', letterSpacing: 1, textTransform: 'uppercase', flex: 1 }}>{cat}</span>
                  {activeInCat > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: BLUE + '18', color: BLUE }}>{activeInCat} on</span>
                  )}
                </button>

                <AnimatePresence>
                  {expanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .18 }} style={{ overflow: 'hidden' }}>
                      {catRules.map(rule => {
                        const meta = RULE_META[rule.id];
                        const count = analysis?.hits[rule.id]?.size ?? 0;
                        const Icon = meta.icon;
                        return (
                          <div key={rule.id} style={{ padding: '10px 16px 10px 28px', borderTop: '1px solid #F8FAFF' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: rule.enabled ? 4 : 0 }}>
                              <div style={{ width: 22, height: 22, borderRadius: 5, background: meta.color + '15', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                                <Icon size={11} color={meta.color} />
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{meta.label}</div>
                              </div>
                              {count > 0 && (
                                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: rule.enabled ? meta.color + '15' : '#F1F5F9', color: rule.enabled ? meta.color : '#9CA3AF' }}>
                                  {count}
                                </span>
                              )}
                              <Toggle on={rule.enabled} onChange={() => toggleRule(rule.id)} />
                            </div>
                            <div style={{ fontSize: 10, color: '#B0B9C8', lineHeight: 1.4 }}>{meta.desc}</div>

                            {/* Configurable thresholds */}
                            {rule.enabled && rule.id === 'low_score' && (
                              <ThresholdSlider label="Remove below" value={config.minScore} min={10} max={70} unit="/100"
                                onChange={v => setConfig(c => ({ ...c, minScore: v }))} />
                            )}
                            {rule.enabled && rule.id === 'too_fast' && (
                              <ThresholdSlider label="Minimum duration" value={config.minDuration} min={1} max={30} unit="min"
                                onChange={v => setConfig(c => ({ ...c, minDuration: v }))} />
                            )}
                            {rule.enabled && rule.id === 'abandoned' && (
                              <ThresholdSlider label="Maximum duration" value={config.maxDuration} min={60} max={480} step={10} unit="min"
                                onChange={v => setConfig(c => ({ ...c, maxDuration: v }))} />
                            )}
                            {rule.enabled && rule.id === 'contaminated_enumerator' && (
                              <ThresholdSlider label={`${t('enumerator','enumerator')} flag rate`} value={Math.round(config.maxFlagRate * 100)} min={10} max={80} unit="%"
                                onChange={v => setConfig(c => ({ ...c, maxFlagRate: v / 100 }))} />
                            )}
                            {rule.enabled && rule.id === 'speed_violation' && (
                              <ThresholdSlider label="Max travel speed" value={config.maxSpeedKmh} min={40} max={300} step={10} unit="km/h"
                                onChange={v => setConfig(c => ({ ...c, maxSpeedKmh: v }))} />
                            )}
                            {rule.enabled && rule.id === 'geo_outlier' && (
                              <ThresholdSlider label="Sigma threshold" value={config.geoSigma} min={1} max={5} step={0.5} unit="σ"
                                onChange={v => setConfig(c => ({ ...c, geoSigma: v }))} />
                            )}
                            {rule.enabled && rule.id === 'stale_90d' && (
                              <ThresholdSlider label="Days threshold" value={config.retentionDays90} min={30} max={180} step={10} unit="d"
                                onChange={v => setConfig(c => ({ ...c, retentionDays90: v }))} />
                            )}
                            {rule.enabled && rule.id === 'stale_1y' && (
                              <ThresholdSlider label="Days threshold" value={config.retentionDays365} min={180} max={730} step={30} unit="d"
                                onChange={v => setConfig(c => ({ ...c, retentionDays365: v }))} />
                            )}
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* ── Right: Impact + results ───────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Impact banner */}
          {s && (
            <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E8EDF5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(10,15,28,.06)' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9', background: '#FAFBFF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: .8 }}>Cleaning Impact</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#6B7280' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: s.removedCount > 0 ? RED : GREEN }} />
                  {s.removedCount > 0
                    ? `${s.removedCount} submissions (${s.removedPct.toFixed(1)}%) will be removed`
                    : 'No submissions flagged with current rules'}
                </div>
              </div>

              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Before → After flow */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ textAlign: 'center', padding: '12px 20px', background: '#FEF2F2', borderRadius: 10, border: '1px solid #FECACA', minWidth: 90 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: RED, fontFamily: 'monospace' }}>{s.rawCount.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>RAW</div>
                  </div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, height: 2, background: '#F1F5F9', borderRadius: 1 }} />
                    <div style={{ padding: '4px 10px', borderRadius: 20, background: RED + '15', border: `1px solid ${RED}30`, fontSize: 11, fontWeight: 700, color: RED, whiteSpace: 'nowrap' }}>
                      −{s.removedCount} removed
                    </div>
                    <div style={{ flex: 1, height: 2, background: '#F1F5F9', borderRadius: 1 }} />
                  </div>
                  <div style={{ textAlign: 'center', padding: '12px 20px', background: '#F0FDF4', borderRadius: 10, border: '1px solid #BBF7D0', minWidth: 90 }}>
                    <div style={{ fontSize: 24, fontWeight: 800, color: GREEN, fontFamily: 'monospace' }}>{s.cleanCount.toLocaleString()}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2 }}>CLEAN</div>
                  </div>
                </div>

                {/* Stat chips */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  <StatChip label="Avg Score" before={s.avgBefore} after={s.avgAfter} />
                  <StatChip label="Pass Rate" before={s.passBefore} after={s.passAfter} unit="%" />
                  <StatChip label="Margin of Error" before={s.moeBefore} after={s.moeAfter} unit="%" invert />
                  <div style={{ background: s.moeAfter < 5 ? '#F0FDF4' : '#FFFBEB', borderRadius: 10, padding: '10px 14px', border: `1px solid ${s.moeAfter < 5 ? '#BBF7D0' : '#FDE68A'}` }}>
                    <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: .7, marginBottom: 4 }}>Precision</div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: s.moeAfter < 5 ? GREEN : AMBER, lineHeight: 1.3 }}>
                      {s.moeAfter < 5 ? '✓ Target met' : s.moeAfter < 10 ? '⚠ Review sample' : '✗ Too small'}
                    </div>
                    <div style={{ fontSize: 10, color: '#CBD5E1', marginTop: 2 }}>±{s.moeAfter.toFixed(1)}% at 95% CI</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Results tabs */}
          <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E8EDF5', overflow: 'hidden', boxShadow: '0 2px 12px rgba(10,15,28,.06)' }}>
            {/* Tab bar */}
            <div style={{ display: 'flex', borderBottom: '1px solid #F1F5F9', background: '#FAFBFF' }}>
              {([['removed', 'Submissions to Remove'], ['by-rule', 'By Rule'], ['text-fix', 'Text Standardizer'], ['provenance', 'Provenance Trail']] as const).map(([id, label]) => (
                <button key={id} onClick={() => setTab(id)}
                  style={{
                    padding: '12px 18px', background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: tab === id ? 700 : 500,
                    color: tab === id ? BLUE : '#9CA3AF',
                    borderBottom: tab === id ? `2px solid ${BLUE}` : '2px solid transparent',
                    marginBottom: -1, transition: 'all .15s',
                  }}>
                  {label}
                  {id === 'removed' && analysis && (
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: analysis.removedIds.size ? RED + '18' : '#F1F5F9', color: analysis.removedIds.size ? RED : '#9CA3AF' }}>
                      {analysis.removedIds.size}
                    </span>
                  )}
                  {id === 'text-fix' && textCorrections.length > 0 && (
                    <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: AMBER + '18', color: AMBER }}>
                      {textCorrections.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab: Removed submissions */}
            {tab === 'removed' && (
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {loading ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Loading…</div>
                ) : !analysis?.removed.length ? (
                  <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
                    <CheckCircle2 size={28} color={GREEN} style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>No submissions flagged</div>
                    <div style={{ fontSize: 12.5, marginTop: 4 }}>Enable rules on the left to identify data to remove.</div>
                  </div>
                ) : analysis.removed.map((sub, i) => {
                  // Determine which rules hit this submission
                  const reasons = rules.filter(r => r.enabled && analysis.hits[r.id]?.has(sub.submission_id));
                  const violation = analysis.speedViolations.get(sub.submission_id);
                  return (
                    <div key={sub.submission_id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 20px',
                      borderBottom: i < analysis.removed.length - 1 ? '1px solid #F8FAFF' : 'none',
                      background: '#FEF9F9',
                    }}>
                      <XCircle size={14} color={RED} style={{ marginTop: 2, flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                          <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#6B7280' }}>{sub.submission_id.substring(0, 14)}…</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: '#374151' }}>{sub.enumerator_id}</span>
                          <span style={{ fontSize: 9.5, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#FEF2F2', color: RED }}>REMOVE</span>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {reasons.map(r => {
                            const meta = RULE_META[r.id];
                            return (
                              <span key={r.id} style={{ fontSize: 9.5, fontWeight: 600, padding: '2px 7px', borderRadius: 4, background: meta.color + '12', color: meta.color, border: `1px solid ${meta.color}25` }}>
                                {meta.label}
                              </span>
                            );
                          })}
                        </div>
                        {violation && (
                          <div style={{ marginTop: 5, fontSize: 10.5, color: RED, fontStyle: 'italic', lineHeight: 1.4 }}>
                            "{violation.from}" at {new Date(sub.scored_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} → "{violation.to}" — {violation.distKm}km in {violation.minutes} minutes ({violation.speedKmh} km/h). Physically impossible.
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 800, color: RED, fontFamily: 'monospace' }}>{sub.overall_score}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{sub.duration_mins ? Math.round(Number(sub.duration_mins)) + 'm' : '—'}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab: By rule */}
            {tab === 'by-rule' && (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {rules.map(rule => {
                  const meta = RULE_META[rule.id];
                  const count = analysis?.hits[rule.id]?.size ?? 0;
                  const Icon = meta.icon;
                  const pct = s ? (count / s.rawCount * 100) : 0;
                  return (
                    <div key={rule.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, background: rule.enabled && count > 0 ? meta.color + '08' : '#F8FAFF', border: `1px solid ${rule.enabled && count > 0 ? meta.color + '25' : '#E8EDF5'}`, opacity: rule.enabled ? 1 : .45 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 7, background: meta.color + '18', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Icon size={13} color={meta.color} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 4 }}>{meta.label}</div>
                        <div style={{ height: 4, background: '#E8EDF5', borderRadius: 2, overflow: 'hidden' }}>
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(100, pct)}%` }} transition={{ duration: .6, ease: 'easeOut' }}
                            style={{ height: '100%', background: meta.color, borderRadius: 2 }} />
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 800, color: rule.enabled && count > 0 ? meta.color : '#CBD5E1', fontFamily: 'monospace' }}>{count}</div>
                        <div style={{ fontSize: 10, color: '#9CA3AF' }}>{pct.toFixed(1)}%</div>
                      </div>
                      {!rule.enabled && (
                        <div style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', padding: '2px 8px', borderRadius: 4, background: '#F1F5F9' }}>OFF</div>
                      )}
                    </div>
                  );
                })}

                {/* Contaminated enumerators detail */}
                {analysis && rules.find(r => r.id === 'contaminated_enumerator' && r.enabled) && analysis.contaminatedEnums.size > 0 && (
                  <div style={{ marginTop: 4, padding: '12px 14px', borderRadius: 10, background: PURPLE + '08', border: `1px solid ${PURPLE}25` }}>
                    <div style={{ fontSize: 10.5, fontWeight: 700, color: PURPLE, textTransform: 'uppercase', letterSpacing: .6, marginBottom: 8 }}>
                      {analysis.contaminatedEnums.size} Contaminated {analysis.contaminatedEnums.size === 1 ? t('enumerator','enumerator') : t('enumerators','enumerators')}
                    </div>
                    {Array.from(analysis.contaminatedEnums).map(eid => {
                      const es = analysis.enumMap.get(eid);
                      if (!es) return null;
                      const rate = Math.round(es.bad / es.total * 100);
                      return (
                        <div key={eid} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: '1px solid ' + PURPLE + '18' }}>
                          <div style={{ width: 28, height: 28, borderRadius: '50%', background: PURPLE, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700, color: 'white', flexShrink: 0 }}>{eid.slice(-2)}</div>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{eid}</div>
                            <div style={{ fontSize: 10.5, color: '#9CA3AF' }}>{es.total} submissions · {es.bad} flagged/rejected</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontSize: 14, fontWeight: 800, color: PURPLE, fontFamily: 'monospace' }}>{rate}%</div>
                            <div style={{ fontSize: 10, color: '#9CA3AF' }}>flag rate</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Text Standardizer */}
            {tab === 'text-fix' && (
              <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

                {/* Header row */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#374151' }}>Value Standardization</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      Detected inconsistent text values across submission data. Approve corrections to apply in your clean export.
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {textCorrections.length > 0 && (
                      <button
                        onClick={() => {
                          const all = new Set(textCorrections.map(c => `${c.raw}→${c.canonical}`));
                          setApprovedFixes(prev => prev.size === all.size ? new Set() : all);
                        }}
                        style={{ padding: '6px 12px', border: '1px solid #E2E8F0', borderRadius: 7, background: 'white', fontSize: 11.5, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                        {approvedFixes.size === textCorrections.length ? 'Deselect All' : 'Select All'}
                      </button>
                    )}
                    <button
                      onClick={() => { setAddingCustom(true); setCustomRaw(''); setCustomCanonical(''); }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', border: `1px solid ${BLUE}40`, borderRadius: 7, background: BLUE + '08', fontSize: 11.5, fontWeight: 600, color: BLUE, cursor: 'pointer' }}>
                      <Plus size={11} /> Add Rule
                    </button>
                  </div>
                </div>

                {/* Custom rule composer */}
                <AnimatePresence>
                  {addingCustom && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      style={{ overflow: 'hidden' }}>
                      <div style={{ background: '#F8FAFF', borderRadius: 10, border: `1px solid ${BLUE}25`, padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', flexShrink: 0 }}>Replace</div>
                        <input
                          value={customRaw} onChange={e => setCustomRaw(e.target.value)}
                          placeholder="e.g. Lago"
                          style={{ flex: 1, minWidth: 100, padding: '7px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
                        />
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF', flexShrink: 0 }}>with</div>
                        <input
                          value={customCanonical} onChange={e => setCustomCanonical(e.target.value)}
                          placeholder="e.g. Lagos"
                          style={{ flex: 1, minWidth: 100, padding: '7px 10px', borderRadius: 7, border: '1px solid #E2E8F0', fontSize: 13, fontFamily: 'monospace', outline: 'none' }}
                        />
                        <button
                          onClick={() => {
                            if (customRaw.trim() && customCanonical.trim()) {
                              setCustomCorrections(prev => [...prev, { raw: customRaw.trim(), canonical: customCanonical.trim() }]);
                              const key = `${customRaw.trim()}→${customCanonical.trim()}`;
                              setApprovedFixes(prev => new Set(Array.from(prev).concat(key)));
                            }
                            setAddingCustom(false);
                          }}
                          disabled={!customRaw.trim() || !customCanonical.trim()}
                          style={{ padding: '7px 14px', border: 'none', borderRadius: 7, background: BLUE, fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer', flexShrink: 0 }}>
                          <Check size={12} />
                        </button>
                        <button onClick={() => setAddingCustom(false)}
                          style={{ padding: '7px 10px', border: '1px solid #E2E8F0', borderRadius: 7, background: 'white', fontSize: 12, cursor: 'pointer', color: '#9CA3AF', flexShrink: 0 }}>
                          <X size={12} />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Correction list */}
                {textCorrections.length === 0 ? (
                  <div style={{ padding: '32px 0', textAlign: 'center' }}>
                    <Type size={28} color="#D1D5DB" style={{ marginBottom: 10 }} />
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#374151', marginBottom: 4 }}>No text inconsistencies detected</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      {submissions.length === 0
                        ? 'Load submission data to analyse text values.'
                        : 'All address values match known canonical forms. Use "Add Rule" to create a custom correction.'}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {textCorrections.map((c, i) => {
                      const key = `${c.raw}→${c.canonical}`;
                      const approved = approvedFixes.has(key);
                      const isCustom = c.field === 'Custom';
                      const confidence = Math.max(0, Math.round((1 - c.distance / Math.max(c.raw.length, c.canonical.length)) * 100));
                      return (
                        <motion.div key={key} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
                            borderRadius: 10, border: `1px solid ${approved ? GREEN + '30' : '#E8EDF5'}`,
                            background: approved ? GREEN + '06' : '#FAFBFF',
                            transition: 'all .15s',
                          }}>
                          {/* Approve checkbox */}
                          <button onClick={() => setApprovedFixes(prev => {
                              const n = new Set(prev);
                              n.has(key) ? n.delete(key) : n.add(key);
                              return n;
                            })}
                            style={{
                              width: 18, height: 18, borderRadius: 5, border: `2px solid ${approved ? GREEN : '#D1D5DB'}`,
                              background: approved ? GREEN : 'white', display: 'grid', placeItems: 'center',
                              cursor: 'pointer', flexShrink: 0, transition: 'all .15s',
                            }}>
                            {approved && <Check size={10} color="white" strokeWidth={3} />}
                          </button>

                          {/* Before → After */}
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
                            <code style={{ fontSize: 12.5, fontFamily: 'monospace', fontWeight: 700, color: '#DC2626', background: '#FEF2F2', padding: '2px 8px', borderRadius: 5 }}>{c.raw}</code>
                            <span style={{ fontSize: 11, color: '#9CA3AF', flexShrink: 0 }}>→</span>
                            <code style={{ fontSize: 12.5, fontFamily: 'monospace', fontWeight: 700, color: '#059669', background: '#F0FDF4', padding: '2px 8px', borderRadius: 5 }}>{c.canonical}</code>
                          </div>

                          {/* Meta chips */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                            <span style={{ fontSize: 10, fontWeight: 600, color: '#9CA3AF', padding: '2px 7px', borderRadius: 4, background: '#F1F5F9' }}>
                              {c.field}
                            </span>
                            {!isCustom && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: confidence >= 80 ? GREEN + '18' : AMBER + '18', color: confidence >= 80 ? GREEN : AMBER }}>
                                {confidence}% match
                              </span>
                            )}
                            {isCustom && (
                              <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: BLUE + '18', color: BLUE }}>custom</span>
                            )}
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#374151', minWidth: 28, textAlign: 'right', fontFamily: 'monospace' }}>
                              {c.count}
                            </span>
                            <span style={{ fontSize: 10, color: '#9CA3AF' }}>sub{c.count !== 1 ? 's' : ''}</span>
                            {isCustom && (
                              <button onClick={() => setCustomCorrections(prev => prev.filter(cc => !(cc.raw === c.raw && cc.canonical === c.canonical)))}
                                style={{ padding: 3, border: 'none', background: 'none', cursor: 'pointer', color: '#CBD5E1', lineHeight: 0 }}>
                                <X size={11} />
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}

                {/* Apply summary */}
                {approvedFixes.size > 0 && (
                  <div style={{ borderRadius: 10, background: GREEN + '0A', border: `1px solid ${GREEN}25`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: GREEN }}>
                        <Check size={12} style={{ marginRight: 5, verticalAlign: 'middle' }} />
                        {approvedFixes.size} correction{approvedFixes.size !== 1 ? 's' : ''} approved · {approvedTextCount} submission{approvedTextCount !== 1 ? 's' : ''} affected
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        Corrections apply when you export the clean CSV. Source data is not modified.
                      </div>
                    </div>
                    <button onClick={exportClean}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: 'none', borderRadius: 8, background: GREEN, fontSize: 12, fontWeight: 700, color: 'white', cursor: 'pointer', flexShrink: 0 }}>
                      <Download size={12} /> Export with Fixes
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Provenance */}
            {tab === 'provenance' && (
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: '#374151' }}>Cleaning Audit Trail</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>Attach to your client deliverable to document data quality decisions.</div>
                  </div>
                  <button onClick={exportProvenance}
                    style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', border: '1px solid #E2E8F0', borderRadius: 7, background: 'white', fontSize: 11.5, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                    <Download size={12} /> Download .txt
                  </button>
                </div>
                <div style={{ background: '#0A0F1E', borderRadius: 10, padding: '16px 18px', fontFamily: 'monospace', fontSize: 11, lineHeight: 1.7, color: '#94A3B8', overflowX: 'auto' }}>
                  <div style={{ color: '#E2E8F0', fontWeight: 700 }}>DATA CLEANING REPORT</div>
                  <div style={{ color: '#4B5563' }}>ResearchOS · Generated {new Date().toLocaleString('en-GB')}</div>
                  <div style={{ color: '#1E2D4A', margin: '4px 0' }}>{'═'.repeat(44)}</div>
                  {s && <>
                    <div><span style={{ color: '#64748B' }}>Raw Dataset:   </span><span style={{ color: '#E2E8F0' }}>{s.rawCount.toLocaleString()} submissions</span></div>
                    <div><span style={{ color: '#64748B' }}>Removed:       </span><span style={{ color: RED }}>{s.removedCount.toLocaleString()} ({s.removedPct.toFixed(1)}%)</span></div>
                    <div><span style={{ color: '#64748B' }}>Clean Dataset: </span><span style={{ color: GREEN }}>{s.cleanCount.toLocaleString()} submissions</span></div>
                    <div style={{ color: '#1E2D4A', margin: '8px 0 4px' }}>{'─'.repeat(32)}</div>
                    <div style={{ color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>REMOVAL BREAKDOWN</div>
                    {rules.filter(r => r.enabled).map(rule => {
                      const count = analysis?.hits[rule.id]?.size ?? 0;
                      if (!count) return null;
                      const meta = RULE_META[rule.id];
                      const pct = (count / s.rawCount * 100).toFixed(1);
                      return (
                        <div key={rule.id}>
                          <span style={{ color: meta.color }}>{meta.label.padEnd(28)}</span>
                          <span style={{ color: '#E2E8F0' }}>{String(count).padStart(4)}</span>
                          <span style={{ color: '#4B5563' }}>  ({pct}%)</span>
                          {rule.id === 'contaminated_enumerator' && analysis && Array.from(analysis.contaminatedEnums).map(eid => {
                            const es = analysis.enumMap.get(eid);
                            return es ? (
                              <div key={eid} style={{ paddingLeft: 16, color: '#64748B' }}>
                                └─ {eid}  ({Math.round(es.bad / es.total * 100)}% flag rate, {es.total} subs)
                              </div>
                            ) : null;
                          })}
                          {rule.id === 'speed_violation' && analysis && Array.from(analysis.speedViolations.values() as IterableIterator<ViolationDetail>).map(v => (
                            <div key={v.submissionId} style={{ paddingLeft: 16, color: '#64748B' }}>
                              └─ {v.enumeratorId}: {v.from} → {v.to} ({v.distKm}km/{v.minutes}min = {v.speedKmh}km/h)
                            </div>
                          ))}
                        </div>
                      );
                    })}
                    <div style={{ color: '#1E2D4A', margin: '8px 0 4px' }}>{'─'.repeat(32)}</div>
                    <div style={{ color: '#94A3B8', fontWeight: 600, marginBottom: 4 }}>QUALITY IMPACT</div>
                    <div><span style={{ color: '#64748B' }}>Avg Score:     </span><span style={{ color: '#E2E8F0' }}>{s.avgBefore.toFixed(1)} → <span style={{ color: GREEN }}>{s.avgAfter.toFixed(1)}</span></span></div>
                    <div><span style={{ color: '#64748B' }}>Pass Rate:     </span><span style={{ color: '#E2E8F0' }}>{s.passBefore.toFixed(1)}% → <span style={{ color: GREEN }}>{s.passAfter.toFixed(1)}%</span></span></div>
                    <div><span style={{ color: '#64748B' }}>Margin of Err: </span><span style={{ color: '#E2E8F0' }}>±{s.moeBefore.toFixed(1)}% → <span style={{ color: GREEN }}>±{s.moeAfter.toFixed(1)}%</span></span></div>
                    <div style={{ color: '#1E2D4A', margin: '8px 0 4px' }}>{'─'.repeat(44)}</div>
                    <div style={{ color: '#4B5563' }}>Generated by ResearchOS Data Clean Room</div>
                  </>}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purge confirmation modal */}
      <AnimatePresence>
        {showPurgeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(8,13,26,.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            onClick={() => setShowPurgeModal(false)}>
            <motion.div initial={{ scale: .94, opacity: 0, y: 12 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: .94, opacity: 0 }}
              style={{ background: 'white', borderRadius: 16, padding: 28, maxWidth: 440, width: '90%', boxShadow: '0 24px 60px rgba(0,0,0,.25)' }}
              onClick={e => e.stopPropagation()}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: '#FEF2F2', border: '1px solid #FECACA', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
                <AlertTriangle size={20} color={RED} />
              </div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#080D1A', marginBottom: 8 }}>Permanently delete {analysis?.removedIds.size} submissions?</div>
              <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6, marginBottom: 20 }}>
                This will <strong>permanently delete</strong> the flagged submissions from your database. This action cannot be undone. A provenance report will be your only audit trail.
              </div>
              <div style={{ background: '#FFFBEB', borderRadius: 8, padding: '10px 14px', border: '1px solid #FDE68A', fontSize: 12, color: '#92400E', marginBottom: 20 }}>
                <strong>Tip:</strong> Download the Provenance Report first. It documents every rule that triggered each removal.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowPurgeModal(false)}
                  style={{ flex: 1, padding: '10px 0', border: '1px solid #E2E8F0', borderRadius: 8, background: 'white', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button onClick={purgeData}
                  style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, background: RED, fontSize: 13, fontWeight: 700, color: 'white', cursor: 'pointer' }}>
                  Delete permanently
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
