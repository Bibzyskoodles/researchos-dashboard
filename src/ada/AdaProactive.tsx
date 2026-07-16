// Ada proactive features:
//   - Celebration modal when milestones are hit for the first time
//   - Daily brief hook for the Overview page
//   - Element guidance context
//
// Ada settings are loaded from org settings (ada_json), with localStorage fallback.

import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { orgSettingsApi } from '../services/api';

export interface AdaSettings {
  proactive: boolean;
  daily_brief: boolean;
  element_guidance: boolean;
  celebrations: boolean;
  personality: 'professional' | 'friendly' | 'concise';
}

const DEFAULT_SETTINGS: AdaSettings = {
  proactive: true,
  daily_brief: true,
  element_guidance: true,
  celebrations: true,
  personality: 'professional',
};

const SETTINGS_KEY = 'ada_proactive_settings';
const MILESTONES_KEY = 'ada_milestones_seen';

export function useAdaSettings(): AdaSettings {
  const [settings, setSettings] = useState<AdaSettings>(() => {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch { return DEFAULT_SETTINGS; }
  });

  useEffect(() => {
    orgSettingsApi.getSettings()
      .then(r => {
        const d = r.data || {};
        const merged: AdaSettings = {
          proactive:         d.ada_proactive         ?? DEFAULT_SETTINGS.proactive,
          daily_brief:       d.ada_daily_brief        ?? DEFAULT_SETTINGS.daily_brief,
          element_guidance:  d.ada_element_guidance   ?? DEFAULT_SETTINGS.element_guidance,
          celebrations:      d.ada_celebrations       ?? DEFAULT_SETTINGS.celebrations,
          personality:       d.ada_personality        ?? DEFAULT_SETTINGS.personality,
        };
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged));
        setSettings(merged);
      })
      .catch(() => {});
  }, []);

  return settings;
}

// ── Milestone definitions ─────────────────────────────────────────────────────

interface Milestone {
  key: string;
  check: (stats: any) => boolean;
  title: string;
  body: string;
  emoji: string;
  color: string;
}

const MILESTONES: Milestone[] = [
  {
    key: 'first_submission',
    check: s => (s?.total_submissions ?? 0) >= 1,
    title: 'First submission scored!',
    body: 'The pipeline is live. Your first submission just cleared all verification checks. Collection has officially begun.',
    emoji: '🎯',
    color: '#2463EB',
  },
  {
    key: 'sub_100',
    check: s => (s?.total_submissions ?? 0) >= 100,
    title: '100 submissions verified',
    body: "You've crossed the 100-submission mark. A real dataset is taking shape — the quality trend is looking strong.",
    emoji: '💯',
    color: '#7C3AED',
  },
  {
    key: 'sub_500',
    check: s => (s?.total_submissions ?? 0) >= 500,
    title: '500 verified submissions',
    body: "Half a thousand interviews cleared. This dataset is getting serious — insights are getting sharper.",
    emoji: '🚀',
    color: '#059669',
  },
  {
    key: 'sub_1000',
    check: s => (s?.total_submissions ?? 0) >= 1000,
    title: '1,000 submissions milestone',
    body: "A thousand verified interviews. This is a substantial, analysis-ready dataset. Outstanding field work.",
    emoji: '🏆',
    color: '#D97706',
  },
  {
    key: 'pass_rate_90',
    check: s => (s?.pass_rate ?? 0) >= 90 && (s?.total_submissions ?? 0) >= 20,
    title: '90%+ pass rate achieved',
    body: 'Your field team is delivering exceptional quality. 9 out of 10 submissions are clearing all verification checks.',
    emoji: '✨',
    color: '#059669',
  },
  {
    key: 'pass_rate_100',
    check: s => (s?.pass_rate ?? 0) === 100 && (s?.total_submissions ?? 0) >= 10,
    title: 'Perfect verification streak',
    body: 'Every single submission has passed verification. That is rare — your field protocols are working exactly as intended.',
    emoji: '🌟',
    color: '#F59E0B',
  },
];

function getSeenMilestones(): Set<string> {
  try {
    const raw = localStorage.getItem(MILESTONES_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function markMilestoneSeen(key: string) {
  const seen = getSeenMilestones();
  seen.add(key);
  localStorage.setItem(MILESTONES_KEY, JSON.stringify(Array.from(seen)));
}

// ── Confetti particle ─────────────────────────────────────────────────────────

function Confetti({ color }: { color: string }) {
  const shapes = ['■', '●', '▲', '◆'];
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    shape: shapes[i % shapes.length],
    x: Math.random() * 100,
    delay: Math.random() * 0.6,
    duration: 1.4 + Math.random() * 0.8,
    rotate: Math.random() * 360,
    scale: 0.6 + Math.random() * 0.8,
    hue: [color, '#7C3AED', '#059669', '#F59E0B', '#E11D48'][i % 5],
  }));
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', borderRadius: 20 }}>
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ y: -20, x: `${p.x}%`, opacity: 1, rotate: p.rotate, scale: p.scale }}
          animate={{ y: '110%', opacity: [1, 1, 0] }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{ position: 'absolute', top: 0, fontSize: 10, color: p.hue, fontWeight: 700 }}
        >
          {p.shape}
        </motion.div>
      ))}
    </div>
  );
}

// ── Celebration modal ─────────────────────────────────────────────────────────

interface CelebrationProps {
  milestone: Milestone;
  onClose: () => void;
}

function CelebrationModal({ milestone, onClose }: CelebrationProps) {
  useEffect(() => {
    const t = setTimeout(onClose, 6000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 9990, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80, pointerEvents: 'all' }}
    >
      <motion.div
        initial={{ y: -40, scale: 0.9, opacity: 0 }}
        animate={{ y: 0, scale: 1, opacity: 1 }}
        exit={{ y: -20, scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 24 }}
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative', background: 'white', borderRadius: 20,
          padding: '28px 32px 24px', maxWidth: 380, width: '90%',
          boxShadow: '0 24px 80px rgba(10,15,28,.25), 0 0 0 1px rgba(10,15,28,.06)',
          overflow: 'hidden',
        }}
      >
        <Confetti color={milestone.color} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontSize: 40, marginBottom: 12, lineHeight: 1 }}>{milestone.emoji}</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0A1230', marginBottom: 8, letterSpacing: -.3 }}>
            {milestone.title}
          </div>
          <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.7, marginBottom: 20 }}>
            {milestone.body}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
            </div>
            <div style={{ fontSize: 11, color: '#9CA3AF' }}>Ada · ResearchOS</div>
            <button onClick={onClose}
              style={{ marginLeft: 'auto', padding: '5px 14px', borderRadius: 7, background: milestone.color, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, color: 'white', fontFamily: 'Inter,sans-serif' }}>
              Got it
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Public hook for overview page ────────────────────────────────────────────

export function useAdaMilestones(stats: any, enabled: boolean) {
  const [pending, setPending] = useState<Milestone | null>(null);

  useEffect(() => {
    if (!enabled || !stats) return;
    const seen = getSeenMilestones();
    for (const m of MILESTONES) {
      if (!seen.has(m.key) && m.check(stats)) {
        setPending(m);
        break; // one at a time
      }
    }
  }, [stats, enabled]);

  const dismiss = useCallback(() => {
    if (pending) {
      markMilestoneSeen(pending.key);
      setPending(null);
    }
  }, [pending]);

  return { pending, dismiss };
}

// ── Celebration renderer ─────────────────────────────────────────────────────

export function AdaCelebrationLayer({ stats, enabled }: { stats: any; enabled: boolean }) {
  const { pending, dismiss } = useAdaMilestones(stats, enabled);
  return (
    <AnimatePresence>
      {pending && <CelebrationModal key={pending.key} milestone={pending} onClose={dismiss} />}
    </AnimatePresence>
  );
}

// ── Daily Brief card ─────────────────────────────────────────────────────────

interface BriefItem {
  icon: string;
  text: React.ReactNode;
  color?: string;
}

export function AdaDailyBrief({ stats, orgName, firstName }: {
  stats: any;
  orgName?: string;
  firstName?: string;
}) {
  const s = stats || {};
  const total = s.total_submissions ?? 0;
  const pass  = s.pass_count    ?? 0;
  const flag  = s.flag_count    ?? 0;
  const rej   = s.reject_count  ?? 0;
  const rate  = s.pass_rate     ?? 0;
  const avg   = s.avg_score     ?? 0;
  const trend = s.score_trend   ?? 0;

  const now = new Date();
  const hr = now.getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  const items: BriefItem[] = [];

  if (total === 0) {
    items.push({ icon: '📋', text: <>Your pipeline is connected and ready. The first submission will be scored within seconds of arriving.</> });
    items.push({ icon: '⚙️', text: <>Check <strong>Engine Settings</strong> to tune GPS, duration, and audio weights before data starts flowing.</> });
  } else {
    items.push({ icon: '✅', text: <><strong>{total.toLocaleString()} submission{total > 1 ? 's' : ''}</strong> verified — average Trust Index {avg}/100</>, color: avg >= 75 ? '#059669' : avg >= 55 ? '#D97706' : '#DC2626' });

    if (trend !== 0) {
      items.push({ icon: trend > 0 ? '📈' : '📉', text: <><strong style={{ color: trend > 0 ? '#059669' : '#DC2626' }}>{trend > 0 ? '↑' : '↓'} {Math.abs(trend)} pts</strong> vs last week</> });
    }
    if (pass > 0) {
      items.push({ icon: '🎯', text: <><strong>{rate}% pass rate</strong> — {pass.toLocaleString()} passed{flag > 0 ? `, ${flag} flagged` : ''}{rej > 0 ? `, ${rej} rejected` : ''}</> });
    }
    if (flag > 0) {
      items.push({ icon: '🔶', text: <><strong style={{ color: '#D97706' }}>{flag} submission{flag > 1 ? 's' : ''} need review</strong> before they can be approved for analysis</>, color: '#D97706' });
    }
    if (rej > 0 && rej / total > 0.1) {
      items.push({ icon: '⚠️', text: <><strong style={{ color: '#DC2626' }}>{Math.round((rej / total) * 100)}% rejection rate</strong> is above the 10% threshold — consider targeted coaching</>, color: '#DC2626' });
    }
    if (rate >= 90 && total >= 20) {
      items.push({ icon: '🌟', text: <><strong style={{ color: '#059669' }}>Exceptional quality</strong> — {rate}% pass rate puts this dataset in the top tier</>, color: '#059669' });
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      style={{
        background: 'linear-gradient(135deg, #EFF6FF 0%, #F5F3FF 100%)',
        border: '1px solid #C7D2FE', borderRadius: 16, padding: '20px 24px',
        display: 'flex', gap: 16, alignItems: 'flex-start',
      }}
    >
      <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '2px solid #BFDBFE', flexShrink: 0 }}>
        <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#2463EB', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 5 }}>
          ◉ Ada · Daily Brief · {dateStr}
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: '#0A1230', marginBottom: 12, letterSpacing: -.2 }}>
          {greet}{firstName ? `, ${firstName}` : ''}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {items.map((item, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#374151', lineHeight: 1.65 }}>
              <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ── Element guidance tooltip ──────────────────────────────────────────────────

interface TooltipDef {
  target: string;   // data-ada-target value
  title: string;
  body: string;
}

const TOOLTIPS: TooltipDef[] = [
  { target: 'trust-gauge',    title: 'Trust Score', body: 'The weighted composite score from all active verification engines. Set your engine weights in Engine Settings.' },
  { target: 'overview-stats', title: 'Live KPIs',   body: 'These update every 30 seconds. Pass rate and Trust Index are the two most important numbers to watch.' },
  { target: 'reports-list',   title: 'Report Types', body: 'Each report type is optimised for a different audience. Executive → board. Client Delivery → donor/client. Technical → your QA team.' },
];

export function AdaGuidanceLayer({ enabled }: { enabled: boolean }) {
  const [visible, setVisible] = useState<TooltipDef | null>(null);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) return;
    const handlers: (() => void)[] = [];

    TOOLTIPS.forEach(tip => {
      const el = document.querySelector(`[data-ada-target="${tip.target}"]`);
      if (!el) return;

      const enter = (e: Event) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        setCoords({ x: rect.left + rect.width / 2, y: rect.top - 12 });
        setVisible(tip);
      };
      const leave = () => setVisible(null);

      el.addEventListener('mouseenter', enter);
      el.addEventListener('mouseleave', leave);
      handlers.push(() => { el.removeEventListener('mouseenter', enter); el.removeEventListener('mouseleave', leave); });
    });

    return () => handlers.forEach(h => h());
  }, [enabled]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key={visible.target}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4 }}
          style={{
            position: 'fixed',
            left: coords.x,
            top: coords.y,
            transform: 'translate(-50%, -100%)',
            zIndex: 9980,
            background: '#0A1230',
            color: 'white',
            borderRadius: 10,
            padding: '10px 14px',
            maxWidth: 260,
            boxShadow: '0 8px 24px rgba(8,13,26,.3)',
            pointerEvents: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,.5)', textTransform: 'uppercase', letterSpacing: 1 }}>Ada · {visible.title}</span>
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', lineHeight: 1.6 }}>{visible.body}</div>
          <div style={{ position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%)', width: 10, height: 10, background: '#0A1230', clipPath: 'polygon(0 0, 100% 0, 50% 100%)' }} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
