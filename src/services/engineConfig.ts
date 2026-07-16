// Persistent engine configuration — stored in localStorage as fs_engine_config_v1,
// mirrored to the backend per-organization so every browser/user computes the
// Trust Index from the SAME shared policy, not a private per-device copy.
// Both SettingsPage sections (Research Defaults + Engine Config) read/write here.
// SubmissionDetailPage reads here to compute adjusted scores.
//
// Sync model: localStorage is a fast local cache so every page can read the
// config synchronously without waiting on a network round-trip. On app boot,
// syncEngineConfigFromServer() fetches the org's saved config and — if one
// exists — overwrites the local cache and fires the same change event every
// consumer already listens for. saveEngineConfig() writes locally AND pushes
// to the backend so the change becomes visible to every other session.

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

// Trust Intelligence Bible §4 — per-engine requirement levels. Never a boolean.
export type EngineRequirement = "DISABLED" | "OPTIONAL" | "REQUIRED" | "HARD_REQUIRED";

export interface EngineRequirements {
  gps: EngineRequirement;
  duration: EngineRequirement;
  image: EngineRequirement;
  audio: EngineRequirement;
  duplicate: EngineRequirement;
  text_ai: EngineRequirement;
}

// Bible §3 default requirement per engine — GPS/Duration/Image are the channels an
// enumerator physically controls at the point of interview.
export const DEFAULT_REQUIREMENTS: EngineRequirements = {
  gps: "OPTIONAL",
  duration: "OPTIONAL",
  image: "REQUIRED",
  audio: "OPTIONAL",
  duplicate: "OPTIONAL",
  text_ai: "OPTIONAL",
};

// Bible §6.7 — client-assigned enumeration location. When set, the engine
// verifies presence by haversine distance; when unset, the platform simply
// reports where enumeration happened (coordinates + reverse-geocoded address).
export interface AssignedZone {
  lat: number | null;
  lon: number | null;
  radiusM: number;
  label?: string;
}

// Bible §16 (new) — a project may have many named field sites.
// The engine picks the closest zone from the list and verifies against it.
// An empty list means no zone verification (same as lat/lon = null in the single zone).
export type ZoneList = AssignedZone[];

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
  flagScoreThreshold: number;

  // Engine weights (raw values, will be normalised)
  weights: EngineWeights;
  enabled: EngineEnabled;          // legacy boolean map, kept in sync with requirements
  requirements: EngineRequirements; // Bible §4 — the authoritative per-engine policy
  assignedZone: AssignedZone;       // Bible §6.7 — single zone (legacy / simple projects)
  zoneList: ZoneList;               // Bible §16 — many named field sites; overrides assignedZone when non-empty
  gating: GatingConfig;

  // Content requirements — client-defined hints for reviewers and the AI
  imageContentHint: string;   // e.g. "Must show respondent's face and household entry"
  audioContentHint: string;   // e.g. "Must capture both interviewer and respondent voices"

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
  flagScoreThreshold: 50,

  weights: { gps: 0.25, duration: 0.22, image: 0.20, audio: 0.13, duplicate: 0.10, text_ai: 0.10 },
  enabled: { gps: true, duration: true, image: true, audio: true, duplicate: true, text_ai: true },
  requirements: { ...DEFAULT_REQUIREMENTS },
  assignedZone: { lat: null, lon: null, radiusM: 250, label: "" },
  zoneList: [],
  gating: {
    gps_reject_skips: [],
    duration_reject_skips: [],
    duplicate_reject_skips: [],
  },

  imageContentHint: "",
  audioContentHint: "",

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
    const enabled = { ...DEFAULT_ENGINE_CONFIG.enabled, ...(parsed.enabled || {}) };
    // Migrate configs saved before requirement levels existed (Bible §11):
    // enabled:false → DISABLED, enabled:true → the default level for that engine.
    const requirements = { ...DEFAULT_REQUIREMENTS } as EngineRequirements;
    (Object.keys(requirements) as (keyof EngineRequirements)[]).forEach(k => {
      const stored = parsed.requirements?.[k];
      if (stored) requirements[k] = stored;
      else if (enabled[k] === false) requirements[k] = "DISABLED";
    });
    return {
      ...DEFAULT_ENGINE_CONFIG,
      ...parsed,
      weights: { ...DEFAULT_ENGINE_CONFIG.weights, ...(parsed.weights || {}) },
      enabled,
      requirements,
      assignedZone: { ...DEFAULT_ENGINE_CONFIG.assignedZone, ...(parsed.assignedZone || {}) },
      zoneList: Array.isArray(parsed.zoneList) ? parsed.zoneList : [],
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
  // Keep the legacy boolean map derived from requirements (Bible §11).
  const enabled = { ...config.enabled };
  (Object.keys(config.requirements) as (keyof EngineRequirements)[]).forEach(k => {
    enabled[k] = config.requirements[k] !== "DISABLED";
  });
  const toSave: EngineConfig = { ...config, enabled, savedAt: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  // Notify other tabs / components listening for config changes
  window.dispatchEvent(new CustomEvent("fs-engine-config-changed", { detail: toSave }));

  // Push to the backend so every other browser/session in this organisation
  // picks up the same policy — fire-and-forget, never blocks the local save.
  import("./api").then(({ engineConfigApi }) => {
    engineConfigApi.save(toSave).catch(() => {
      // Offline / logged out / server hiccup — the local save already
      // succeeded, so scoring in THIS session is unaffected. It will sync
      // again next time saveEngineConfig() runs.
    });
  });
}

/**
 * Applies a config fetched from the backend to the local cache WITHOUT
 * pushing it back to the server (avoids an infinite sync loop). Fires the
 * same change event saveEngineConfig() does, so every already-mounted page
 * picks it up immediately via their existing "fs-engine-config-changed" listener.
 */
function applyServerConfig(config: EngineConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  window.dispatchEvent(new CustomEvent("fs-engine-config-changed", { detail: config }));
}

/**
 * Call once at app boot (after login). Fetches the organisation's shared
 * Trust Index policy from the backend and, if one has been saved, makes it
 * authoritative on this device — overwriting whatever was previously in
 * localStorage (a stale copy, or another org's leftover defaults).
 * Never throws — a failed sync just leaves the local cache as-is.
 */
export async function syncEngineConfigFromServer(): Promise<void> {
  try {
    const { engineConfigApi } = await import("./api");
    const res = await engineConfigApi.get();
    const remote = res.data?.config;
    if (remote && typeof remote === "object") {
      // Route through loadEngineConfig()'s merge/migration logic first so a
      // config saved by an older frontend version still comes out complete.
      localStorage.setItem(STORAGE_KEY, JSON.stringify(remote));
      const merged = loadEngineConfig();
      applyServerConfig(merged);
    }
  } catch {
    // No network, logged out, or nothing saved yet — keep using local/defaults.
  }
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
  // Backend checks with status NOT_AVAILABLE / DISABLED carry a placeholder
  // score of 50 that is not a measurement (e.g. no audio in the submission)
  // — treat those as absent rather than letting them contribute points.
  const realScore = (check?: { score?: number; status?: string } | null): number | null => {
    const st = (check?.status || "").toUpperCase();
    if (st === "NOT_AVAILABLE" || st === "DISABLED") return null;
    return check?.score != null ? (check.score as number) : null;
  };
  const gpsCheckScore = realScore(sub.checks?.gps);
  const rawScores: Record<string, number | null> = {
    gps:       (gpsCheckScore != null && gpsCheckScore > 0) ? gpsCheckScore : gpsFromAccuracy,
    duration:  realScore(sub.checks?.duration),
    image:     realScore(sub.checks?.image),
    audio:     realScore(sub.checks?.audio),
    duplicate: realScore(sub.checks?.duplicate),
    text_ai:   realScore(sub.checks?.text_ai),
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

  // Must stay in sync with score_engine.py's HARD_GATE_FLAGS
  const hasHighSeverityFlag = flags.some(f =>
    ["DUPLICATE_SUBMISSION", "DUPLICATE_IMAGE", "DUPLICATE_AUDIO",
     "GPS_OUTSIDE_NIGERIA", "DURATION_NEGATIVE", "BACK_TO_BACK",
     "OUTSIDE_ASSIGNED_ZONE", "AUDIO_EMPTY",
     "AI_GENERATED_IMAGE", "DOWNLOADED_IMAGE"].includes(f)
  );
  const hasMediumFlag = flags.length > 0;

  let verdict: "PASS" | "FLAG" | "REJECT";
  if (hasHighSeverityFlag || overall < config.flagScoreThreshold) {
    verdict = "REJECT";
  } else if (hasMediumFlag || overall < config.passScoreThreshold) {
    verdict = "FLAG";
  } else {
    verdict = "PASS";
  }

  const hasAdjustments = breakdown.some(b => b.flagOverride !== null) ||
    overall !== (sub.overall_score ?? overall);

  return { overall, verdict, breakdown, hasAdjustments };
}
