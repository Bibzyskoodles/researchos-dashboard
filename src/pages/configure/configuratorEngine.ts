/**
 * Deployment configurator — recommendation logic.
 *
 * Deliberately separate from the UI so it can be reasoned about (and tested)
 * on its own. Everything here is a pure function of the user's answers.
 *
 * The governing rule (see docs/deployment_configurator_spec.md): Ada states
 * ASSUMPTIONS, never fabricated evidence. Every inferred number carries the
 * assumption that produced it so the UI can show it and let the user correct
 * it. We do not have a dataset of "similar organisations" and must never imply
 * we do — our product detects invented research data; inventing numbers in our
 * own estimator would undermine exactly what we sell.
 */

export type OrgType = 'agency' | 'ngo' | 'government' | 'university' | 'enterprise' | 'other';
export type Criticality = 'helpful' | 'important' | 'critical';
export type SetupHelp = 'none' | 'configuration' | 'configuration_training';
export type Evidence = 'gps' | 'photos' | 'audio' | 'video' | 'documents';

export interface ConfiguratorAnswers {
  orgType: OrgType | null;
  fieldworkers: number;
  projectsPerYear: number;
  /** Interviews per project. Pre-filled from org type, editable by the user —
   *  this is the assumption Ada exposes rather than hides. */
  interviewsPerProject: number;
  evidence: Evidence[];
  criticality: Criticality;
  setupHelp: SetupHelp;
}

export interface OrgProfile {
  label: string;
  icon: string;
  /** Starting points, not claims. Shown as editable defaults. */
  fieldworkers: number;
  projectsPerYear: number;
  interviewsPerProject: number;
  evidence: Evidence[];
  /** One plain-English line Ada says after this type is chosen. */
  note: string;
}

export const ORG_PROFILES: Record<OrgType, OrgProfile> = {
  agency: {
    label: 'Research Agency', icon: '📊',
    fieldworkers: 150, projectsPerYear: 18, interviewsPerProject: 250,
    evidence: ['gps', 'photos', 'audio'],
    note: "I'll tailor this for a research agency — high project turnover, multiple clients.",
  },
  ngo: {
    label: 'NGO', icon: '🤝',
    fieldworkers: 120, projectsPerYear: 8, interviewsPerProject: 400,
    evidence: ['gps', 'photos', 'audio'],
    note: "I'll tailor this for an NGO. Donor reporting usually means evidence needs to be defensible, not just collected.",
  },
  government: {
    label: 'Government', icon: '🏛',
    fieldworkers: 400, projectsPerYear: 6, interviewsPerProject: 1200,
    evidence: ['gps', 'photos'],
    note: "I'll tailor this for a government programme — larger field teams, fewer but bigger exercises.",
  },
  university: {
    label: 'University', icon: '🎓',
    fieldworkers: 40, projectsPerYear: 6, interviewsPerProject: 150,
    evidence: ['gps', 'audio'],
    note: "I'll tailor this for academic research — smaller teams, methodological rigour matters most.",
  },
  enterprise: {
    label: 'Enterprise', icon: '🏢',
    fieldworkers: 200, projectsPerYear: 12, interviewsPerProject: 300,
    evidence: ['gps', 'photos', 'audio'],
    note: "I'll tailor this for an enterprise deployment.",
  },
  other: {
    label: 'Other', icon: '✳️',
    fieldworkers: 100, projectsPerYear: 10, interviewsPerProject: 250,
    evidence: ['gps', 'photos'],
    note: "No problem — I'll start from a general configuration and you can adjust anything.",
  },
};

export const EVIDENCE_META: Record<Evidence, { label: string; icon: string; engine: string | null }> = {
  gps:       { label: 'GPS location', icon: '📍', engine: 'GPS & location verification' },
  photos:    { label: 'Photos',       icon: '📷', engine: 'AI image analysis' },
  audio:     { label: 'Audio',        icon: '🎙',  engine: 'AI audio & voice analysis' },
  video:     { label: 'Video',        icon: '🎬', engine: 'Video evidence review' },
  documents: { label: 'Documents',    icon: '📄', engine: null },
};

export interface Recommendation {
  /** Internal plan key; also what a sales conversation starts from. */
  tier: 'starter' | 'professional' | 'enterprise';
  tierLabel: string;
  annualInterviews: number;
  engines: string[];
  supportLabel: string;
  onboardingLabel: string;
  pilotRecommended: boolean;
  /** Indicative annual range in NGN — deliberately a RANGE, never a quote. */
  investmentLow: number;
  investmentHigh: number;
  /** Plain-English justification, assembled from the actual answers. */
  rationale: string;
}

/** Annual interview volume. The one inferred figure that matters — and the UI
 *  must show the interviewsPerProject assumption next to it. */
export function annualInterviews(a: ConfiguratorAnswers): number {
  return Math.max(0, Math.round(a.projectsPerYear * a.interviewsPerProject));
}

/** Which verification engines the chosen evidence actually enables. */
export function enginesFor(evidence: Evidence[]): string[] {
  const engines = evidence
    .map(e => EVIDENCE_META[e]?.engine)
    .filter((e): e is string => !!e);
  // Always present — they need no particular evidence type to work.
  engines.push('Duplicate & fraud detection', 'Enumerator trust scoring');
  return engines;
}

function tierFor(a: ConfiguratorAnswers): Recommendation['tier'] {
  const volume = annualInterviews(a);
  if (a.criticality === 'critical') return 'enterprise';
  if (a.orgType === 'government') return 'enterprise';
  if (volume >= 50_000 || a.fieldworkers >= 300) return 'enterprise';
  if (volume >= 8_000 || a.fieldworkers >= 50) return 'professional';
  return 'starter';
}

const TIER_LABEL: Record<Recommendation['tier'], string> = {
  starter: 'FieldScore Starter',
  professional: 'FieldScore Professional',
  enterprise: 'FieldScore Enterprise',
};

// Anchored on the published monthly plan prices (payments.PLAN_PRICES_NGN),
// annualised. Presented as a RANGE because implementation/training/support
// pricing isn't set yet — a range is honest about that, a total would not be.
const TIER_MONTHLY_NGN: Record<Recommendation['tier'], number> = {
  starter: 150_000,
  professional: 350_000,
  enterprise: 800_000,
};

const SUPPORT_LABEL: Record<Criticality, string> = {
  helpful: 'Standard support',
  important: 'Business support — priority response',
  critical: 'Enterprise support — dedicated contact',
};

const ONBOARDING_LABEL: Record<SetupHelp, string> = {
  none: 'Self-serve setup',
  configuration: 'Guided configuration',
  configuration_training: 'Guided configuration + team training',
};

export function recommend(a: ConfiguratorAnswers): Recommendation {
  const tier = tierFor(a);
  const volume = annualInterviews(a);
  const base = TIER_MONTHLY_NGN[tier] * 12;

  // The range widens with setup scope, since that's the part not yet priced.
  const uplift = a.setupHelp === 'configuration_training' ? 0.35
               : a.setupHelp === 'configuration' ? 0.18 : 0.08;

  const engines = enginesFor(a.evidence);

  // Rationale assembled from what they actually told us — no invented comparisons.
  const bits: string[] = [];
  bits.push(`a field team of about ${a.fieldworkers.toLocaleString()}`);
  bits.push(`roughly ${volume.toLocaleString()} interviews a year`);
  const richEvidence = a.evidence.filter(e => e === 'photos' || e === 'audio' || e === 'video');
  if (richEvidence.length) {
    bits.push(`and evidence that needs AI review (${richEvidence.map(e => EVIDENCE_META[e].label.toLowerCase()).join(', ')})`);
  }
  const criticalityClause = a.criticality === 'critical'
    ? ' Because you described this as mission critical, I\'ve included our highest support level.'
    : a.criticality === 'important'
    ? ' Since this matters to your operations, I\'ve included priority support.'
    : '';

  const rationale =
    `You described ${bits.join(', ')}. That points to ${TIER_LABEL[tier]}, which covers this volume ` +
    `comfortably and turns on the verification engines your evidence types need.${criticalityClause}`;

  return {
    tier,
    tierLabel: TIER_LABEL[tier],
    annualInterviews: volume,
    engines,
    supportLabel: SUPPORT_LABEL[a.criticality],
    onboardingLabel: ONBOARDING_LABEL[a.setupHelp],
    // A pilot de-risks the bigger commitments; pointless overhead on the smallest.
    pilotRecommended: tier !== 'starter',
    investmentLow: Math.round(base / 100_000) * 100_000,
    investmentHigh: Math.round((base * (1 + uplift)) / 100_000) * 100_000,
    rationale,
  };
}

/** Defaults for a freshly-chosen org type — what makes every slider
 *  pre-positioned so the user can simply press Next. */
export function defaultsFor(orgType: OrgType): Omit<ConfiguratorAnswers, 'orgType'> {
  const p = ORG_PROFILES[orgType];
  return {
    fieldworkers: p.fieldworkers,
    projectsPerYear: p.projectsPerYear,
    interviewsPerProject: p.interviewsPerProject,
    evidence: [...p.evidence],
    criticality: 'important',
    setupHelp: 'configuration',
  };
}
