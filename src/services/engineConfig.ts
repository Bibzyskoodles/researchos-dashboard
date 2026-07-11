// Persistent engine configuration — stored in localStorage as fs_engine_config_v1.
// This is the single source of truth for scoring thresholds and weights.
// Both SettingsPage sections (Research Defaults + Engine Config) read/write here.
// SubmissionDetailPage reads here to compute adjusted scores.

export interface EngineWeights {
  gps: number;
  duration: number;
  image: number;
  audio: number;
  duplicate: number;
  text_ai: number;
}

export interface EngineEnabled {
  gps: boolean;
  duration: boolean;
  image: boolean;
  audio: boolean;
  duplicate: boolean;
  text_ai: boolean;
}

export interface GatingConfig {
  gps_reject_skips: string[];
  duration_reject_skips: string[];
  duplicate_reject_skips: string[];
}

export interface EngineConfig {
  // Research defaults
  gpsToleranceMeters: number;
  duplicateThresholdPct: number;
  minDurationMins: number;
  maxDurationMins: number;
  passScoreThreshold: number;

  // Engine weights (raw values, will be normalised)
  weights: EngineWeights;
  enabled: EngineEnabled;
  gating: GatingConfig;

  // AI detection penalties
  aiHighPenalty: number;
  aiMediumPenalty: number;
  aiMediumFlag: boolean;

  // Meta
  savedAt: string | null;
}

export const DEFAULT_ENGINE_CONFIG: EngineConfig = {
  gpsToleranceMeters: 50,
  duplicateThresholdPct: 85,
  minDurationMins: 8,
  maxDurationMins: 120,
  passScoreThreshold: 70,

  weights: { gps: 0.25, duration: 0.22, image: 0.20, audio: 0.13, duplicate: 0.10, text_ai: 0.10 },
  enabled: { gps: true, duration: true, image: true, audio: true, duplicate: true, text_ai: true },
  gating: {
    gps_reject_skips: [],
    duration_reject_skips: [],
    duplicate_reject_skips: [],
  },

  aiHighPenalty: 55,
  aiMediumPenalty: 20,
  aiMediumFlag: true,

  savedAt: null,
};

const STORAGE_KEY = "fs_engine_config_v1";

export function loadEngineConfig(): EngineConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ENGINE_CONFIG };
    const parsed = JSON.parse(raw) as Partial<EngineConfig>;
    return {
      ...DEFAULT_ENGINE_CONFIG,
      ...parsed,
      weights: { ...DEFAULT_ENGINE_CONFIG.weights, ...(parsed.weights || {}) },
      enabled: { ...DEFAULT_ENGINE_CONFIG.enabled, ...(parsed.enabled || {}) },
      gating: {
        gps_reject_skips: parsed.gating?.gps_reject_skips ?? [...DEFAULT_ENGINE_CONFIG.gating.gps_reject_skips],
        duration_reject_skips: parsed.gating?.duration_reject_skips ?? [...DEFAULT_ENGINE_CONFIG.gating.duration_reject_skips],
        duplicate_reject_skips: parsed.gating?.duplicate_reject_skips ?? [...DEFAULT_ENGINE_CONFIG.gating.duplicate_reject_skips],
      },
    };
  } catch {
    return { ...DEFAULT_ENGINE_CONFIG };
  }
}

export function saveEngineConfig(config: EngineConfig): void {
  const toSave: EngineConfig = { ...config, savedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  // Notify other tabs / components listening for config changes
  window.dispatchEvent(new CustomEvent("fs-engine-config-changed", { detail: toSave }));
}

// ─── Client-side score adjustment ─────────────────────────────────────────────

export interface EngineScoreBreakdown {
  key: string;
  label: string;
  rawScore: number;     // what the backend returned
  adjScore: number;     // after flag overrides
  weight: number;       // normalised weight (0–1)
  contribution: number; // adjScore * weight
  gated: boolean;
  flagOverride: string | null; // which flag caused an override
}

export interface AdjustedScore {
  overall: number;
  verdict: "PASS" | "FLAG" | "REJECT";
  breakdown: EngineScoreBreakdown[];
  hasAdjustments: boolean; // true if any scores differed from backend raw
}

// Maps flag codes to which engine they affect and what score to force
const FLAG_ENGINE_OVERRIDES: Record<string, { engine: string; score: number }> = {
  GPS_PARSE_ERROR:     { engine: "gps",      score: 5 },
  NO_GPS:              { engine: "gps",      score: 0 },
  GPS_OUTSIDE_NIGERIA: { engine: "gps",      score: 10 },
  OUTSIDE_ASSIGNED_ZONE: { engine: "gps",   score: 15 },
  LOW_GPS_ACCURACY:    { engine: "gps",      score: 35 },
  GPS_POOR_ACCURACY:   { engine: "gps",      score: 35 },
  DURATION_TOO_SHORT:  { engine: "duration", score: 10 },
  DURATION_TOO_LONG:   { engine: "duration", score: 20 },
  DURATION_NEGATIVE:   { engine: "duration", score: 0 },
  DURATION_PARSE_ERROR:{ engine: "duration", score: 5 },
  DURATION_NOT_CALCULABLE: { engine: "duration", score: 20 },
  BACK_TO_BACK:        { engine: "duration", score: 5 },
  DUPLICATE_SUBMISSION:{ engine: "duplicate", score: 0 },
  DUPLICATE_IMAGE:     { engine: "duplicate", score: 5 },
  DUPLICATE_AUDIO:     { engine: "duplicate", score: 5 },
  AUDIO_EMPTY:         { engine: "audio",    score: 0 },
  AUDIO_QUALITY_ISSUE: { engine: "audio",    score: 25 },
  IMAGE_QUALITY_ISSUE: { engine: "image",    score: 25 },
};

const ENGINE_LABELS_MAP: Record<string, string> = {
  gps: "GPS Location",
  duration: "Duration",
  image: "Image Quality",
  audio: "Audio Quality",
  duplicate: "Duplicate Check",
  text_ai: "AI Detection",
};

export function computeAdjustedScore(
  sub: {
    overall_score?: number;
    verdict?: string;
    flags?: string | string[];
    checks?: Record<string, { score?: number; status?: string } | null>;
    gps?: { accuracy_m?: number };
  },
  config: EngineConfig
): AdjustedScore {
  const flags: string[] = Array.isArray(sub.flags)
    ? sub.flags
    : String(sub.flags || "").split(",").map(f => f.trim()).filter(Boolean);

  // Determine which engine each flag overrides (worst-case / lowest score wins)
  const flagOverrideByEngine: Record<string, { score: number; flag: string }> = {};
  for (const flag of flags) {
    const override = FLAG_ENGINE_OVERRIDES[flag];
    if (override) {
      if (
        flagOverrideByEngine[override.engine] === undefined ||
        override.score < flagOverrideByEngine[override.engine].score
      ) {
        flagOverrideByEngine[override.engine] = { score: override.score, flag };
      }
    }
  }

  // Gating
  const gatedEngines = new Set<string>();
  const hasGpsReject = flags.some(f => ["GPS_OUTSIDE_NIGERIA", "GPS_PARSE_ERROR", "NO_GPS"].includes(f));
  const hasDurationReject = flags.some(f => ["DURATION_TOO_SHORT", "DURATION_TOO_LONG", "DURATION_NEGATIVE", "BACK_TO_BACK"].includes(f));
  const hasDuplicateReject = flags.some(f => ["DUPLICATE_SUBMISSION"].includes(f));
  if (hasGpsReject) config.gating.gps_reject_skips.forEach(e => gatedEngines.add(e));
  if (hasDurationReject) config.gating.duration_reject_skips.forEach(e => gatedEngines.add(e));
  if (hasDuplicateReject) config.gating.duplicate_reject_skips.forEach(e => gatedEngines.add(e));

  const engineKeys = ["gps", "duration", "image", "audio", "duplicate", "text_ai"] as const;

  // GPS fallback: if backend check score is absent/zero, derive from accuracy_m
  const gpsFromAccuracy: number | null = (sub as any).gps?.accuracy_m != null
    ? Math.max(0, Math.round(100 - Math.log10(Math.max(1, Number((sub as any).gps.accuracy_m))) * 40))
    : null;

  // Per-engine raw scores — null means "not run / not measured"
  // Use backend check score when it's a positive number; fall back to accuracy formula for GPS;
  // never use overall_score as a proxy for unmeasured engines.
  const rawScores: Record<string, number | null> = {
    gps:       (sub.checks?.gps?.score != null && (sub.checks.gps.score as number) > 0)
                 ? sub.checks.gps.score as number
                 : gpsFromAccuracy,
    duration:  sub.checks?.duration?.score != null ? sub.checks.duration.score as number : null,
    image:     sub.checks?.image?.score     != null ? sub.checks.image.score as number     : null,
    audio:     sub.checks?.audio?.score     != null ? sub.checks.audio.score as number     : null,
    duplicate: sub.checks?.duplicate?.score != null ? sub.checks.duplicate.score as number : null,
    text_ai:   sub.checks?.text_ai?.score   != null ? sub.checks.text_ai.score as number   : null,
  };

  // An engine is "measured" if it has a real raw score OR a flag explicitly failed it
  const isMeasured = (k: string) => rawScores[k] != null || flagOverrideByEngine[k] != null;

  // Normalise weights over enabled, non-gated, measured engines only
  let totalWeight = 0;
  for (const k of engineKeys) {
    if (config.enabled[k] && !gatedEngines.has(k) && isMeasured(k)) {
      totalWeight += config.weights[k];
    }
  }
  if (totalWeight === 0) {
    // Nothing was measured — fall back to backend raw score unchanged
    return {
      overall: sub.overall_score ?? 0,
      verdict: (sub.verdict as "PASS" | "FLAG" | "REJECT") ?? "FLAG",
      breakdown: engineKeys.map(k => ({
        key: k, label: ENGINE_LABELS_MAP[k], rawScore: 0, adjScore: 0,
        weight: 0, contribution: 0, gated: false, flagOverride: null,
      })),
      hasAdjustments: false,
    };
  }

  const breakdown: EngineScoreBreakdown[] = [];
  let weightedSum = 0;

  for (const k of engineKeys) {
    const isEnabled = config.enabled[k];
    const isGated = gatedEngines.has(k);
    const measured = isMeasured(k);
    const raw = rawScores[k] ?? (flagOverrideByEngine[k]?.score ?? 0);
    const override = flagOverrideByEngine[k];
    const adj = override !== undefined ? override.score : raw;
    const normWeight = (isEnabled && !isGated && measured) ? config.weights[k] / totalWeight : 0;

    if (isEnabled && !isGated && measured) {
      weightedSum += adj * normWeight;
    }

    breakdown.push({
      key: k,
      label: ENGINE_LABELS_MAP[k],
      rawScore: raw,
      adjScore: measured ? adj : 0,
      weight: normWeight,
      contribution: isEnabled && !isGated && measured ? adj * normWeight : 0,
      gated: isGated,
      flagOverride: override?.flag ?? null,
    });
  }

  const overall = Math.round(Math.min(100, Math.max(0, weightedSum)));

  const hasHighSeverityFlag = flags.some(f =>
    ["DUPLICATE_SUBMISSION", "DUPLICATE_IMAGE", "DUPLICATE_AUDIO",
     "GPS_OUTSIDE_NIGERIA", "DURATION_NEGATIVE", "BACK_TO_BACK",
     "OUTSIDE_ASSIGNED_ZONE", "AUDIO_EMPTY"].includes(f)
  );
  const hasMediumFlag = flags.length > 0;

  let verdict: "PASS" | "FLAG" | "REJECT";
  if (overall < config.passScoreThreshold || hasHighSeverityFlag) {
    verdict = "REJECT";
  } else if (hasMediumFlag) {
    verdict = "FLAG";
  } else {
    verdict = "PASS";
  }

  const hasAdjustments = breakdown.some(b => b.flagOverride !== null) ||
    overall !== (sub.overall_score ?? overall);

  return { overall, verdict, breakdown, hasAdjustments };
}
