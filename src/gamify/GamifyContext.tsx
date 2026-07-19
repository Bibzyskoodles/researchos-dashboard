import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../store/AuthContext';

// ─────────────────────────────────────────────────────────────────────────────
// FieldScore Rewards — client-facing incentives.
// Credits are earned by the ORGANISATION (our paying client) through quality
// milestones, and are applied against their NEXT subscription payment.
// No enumerator payouts — recognition for field teams stays ambient/visual only.
// ─────────────────────────────────────────────────────────────────────────────

export interface CreditTransaction {
  id: string;
  label: string;
  amount: number; // in NGN, positive = earned, negative = applied to invoice
  date: string;
  kind: 'earned' | 'applied';
}

// Real stats/signature/QR live on the backend-issued certificate record
// (see fieldscore-backend/certificate.py) — this local copy is just enough
// to power the milestone/credits celebration and the "issued" list; it is
// NOT the source of truth for a certificate's content.
export interface Certificate {
  id: string;               // real backend cert_id, e.g. FS-3F9A21-20260719-001
  projectId: string;
  issuedAt: string;
}

export interface Milestone {
  id: string;
  label: string;
  desc: string;
  icon: string;
  credits: number;         // NGN awarded on achievement
  event: GamifyEvent;
  target: number;
}

export type GamifyEvent =
  | 'project_created'
  | 'project_completed'
  | 'certificate_issued'
  | 'client_invited'
  | 'report_generated'
  | 'submissions_verified';

export const MILESTONES: Milestone[] = [
  { id: 'first_project', label: 'First project live', desc: 'Create your first research project on FieldScore', icon: '🚀', credits: 2000, event: 'project_created', target: 1 },
  { id: 'first_certificate', label: 'Certified data', desc: 'Issue your first Data Integrity Certificate', icon: '🛡️', credits: 5000, event: 'certificate_issued', target: 1 },
  { id: 'five_certificates', label: 'Trusted delivery', desc: 'Issue 5 Data Integrity Certificates to clients', icon: '🏅', credits: 15000, event: 'certificate_issued', target: 5 },
  { id: 'first_client', label: 'Client on board', desc: 'Invite your first client into a project portal', icon: '🤝', credits: 3000, event: 'client_invited', target: 1 },
  { id: 'first_report', label: 'First delivery', desc: 'Generate and share your first report', icon: '📊', credits: 2500, event: 'report_generated', target: 1 },
  { id: 'verified_500', label: 'Quality at scale', desc: 'Verify 500 submissions through FieldScore QC', icon: '⚡', credits: 10000, event: 'submissions_verified', target: 500 },
  { id: 'five_projects', label: 'Research operation', desc: 'Run 5 projects on FieldScore', icon: '🌍', credits: 20000, event: 'project_created', target: 5 },
];

export const TIERS = [
  { id: 'member', label: 'Member', min: 0, color: '#6B7280' },
  { id: 'silver', label: 'Silver Partner', min: 2, color: '#64748B' },
  { id: 'gold', label: 'Gold Partner', min: 4, color: '#D97706' },
  { id: 'platinum', label: 'Platinum Partner', min: 6, color: '#7C3AED' },
];

interface GamifyState {
  counters: Partial<Record<GamifyEvent, number>>;
  achieved: string[];               // milestone ids
  transactions: CreditTransaction[];
  certificates: Certificate[];
}

interface GamifyContextValue extends GamifyState {
  creditsBalance: number;
  creditsEarned: number;
  tier: typeof TIERS[number];
  recordEvent: (event: GamifyEvent, count?: number) => void;
  recordCertificateIssued: (cert: Certificate) => void;
  certificatesForProject: (projectId: string) => Certificate[];
}

const STORAGE_KEY = 'fs_gamify_v1';

const EMPTY: GamifyState = { counters: {}, achieved: [], transactions: [], certificates: [] };

function load(): GamifyState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
  } catch { /* corrupted storage — start fresh */ }
  return EMPTY;
}


const GamifyContext = createContext<GamifyContextValue | null>(null);

export function GamifyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [state, setState] = useState<GamifyState>(load);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* quota */ }
  }, [state]);

  const applyEvent = (prev: GamifyState, event: GamifyEvent, count: number): GamifyState => {
    const counters = { ...prev.counters, [event]: (prev.counters[event] || 0) + count };
    const achieved = [...prev.achieved];
    const transactions = [...prev.transactions];
    for (const m of MILESTONES) {
      if (m.event === event && !achieved.includes(m.id) && (counters[event] || 0) >= m.target) {
        achieved.push(m.id);
        transactions.unshift({
          id: `tx_${Date.now()}_${m.id}`,
          label: `Milestone — ${m.label}`,
          amount: m.credits,
          date: new Date().toISOString(),
          kind: 'earned',
        });
        // Ambient notification — AppShell listens and shows a quiet toast.
        window.dispatchEvent(new CustomEvent('fs-milestone', {
          detail: { milestone: m, message: `${m.icon} ${m.label} — ₦${m.credits.toLocaleString()} credit applied to your next payment` },
        }));
      }
    }
    return { ...prev, counters, achieved, transactions };
  };

  const recordEvent = (event: GamifyEvent, count = 1) => {
    setState(prev => applyEvent(prev, event, count));
  };

  // Records a certificate the backend already issued (see certificateApi.issue
  // in services/api.ts) — this never generates a certificate itself, only
  // tracks the milestone/credits side effect and keeps a local "issued" list.
  const recordCertificateIssued = (cert: Certificate) => {
    setState(prev => {
      const withCert = { ...prev, certificates: [cert, ...prev.certificates] };
      return applyEvent(withCert, 'certificate_issued', 1);
    });
  };

  const certificatesForProject = (projectId: string) =>
    state.certificates.filter(c => c.projectId === projectId);

  const creditsEarned = useMemo(
    () => state.transactions.filter(t => t.kind === 'earned').reduce((s, t) => s + t.amount, 0),
    [state.transactions]
  );
  const creditsBalance = useMemo(
    () => state.transactions.reduce((s, t) => s + t.amount, 0),
    [state.transactions]
  );
  const tier = useMemo(() => {
    const n = state.achieved.length;
    return [...TIERS].reverse().find(t => n >= t.min) || TIERS[0];
  }, [state.achieved]);

  // Keep issuedBy sensible even if the caller forgets
  void user;

  return (
    <GamifyContext.Provider value={{ ...state, creditsBalance, creditsEarned, tier, recordEvent, recordCertificateIssued, certificatesForProject }}>
      {children}
    </GamifyContext.Provider>
  );
}

export function useGamify(): GamifyContextValue {
  const ctx = useContext(GamifyContext);
  if (!ctx) throw new Error('useGamify must be used within GamifyProvider');
  return ctx;
}
