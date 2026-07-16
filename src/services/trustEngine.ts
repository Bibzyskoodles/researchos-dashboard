// FieldScore Trust Intelligence Engine (FTIE)
// Implements docs/15_TRUST_INTELLIGENCE_BIBLE.md — every section reference below
// points into that document. The engine is a pure function: no I/O, no clock,
// no randomness. Same submission + same config = same Trust Index, everywhere.

import type { EngineConfig, EngineRequirement } from "./engineConfig";

// ─── Types ────────────────────────────────────────────────────────────────────

export type EngineKey = "gps" | "duration" | "image" | "audio" | "duplicate" | "text_ai";
export type TrustStatus = "SCORED" | "INELIGIBLE" | "UNVERIFIED";
export type RiskLevel = "VERY_LOW" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type Recommendation = "APPROVE" | "REVIEW" | "REJECT";
export type Verdict = "PASS" | "FLAG" | "REJECT";
export type EvidencePresence = "MEASURED" | "PRESENT_UNMEASURED" | "ABSENT";

export interface EvidenceRecord {
  key: EngineKey;
  label: string;
  primary: boolean;              // Bible §1: primary evidence vs derived analysis
  requirement: EngineRequirement;
  presence: EvidencePresence;
  rawScore: number | null;       // backend measurement (or GPS-derived fallback)
  flagOverride: string | null;   // worst flag that forced this engine down
  effectiveScore: number | null; // min(raw, override) — §6.1
  confidence: number;            // measurement provenance — §6.2
  shrunkScore: number | null;    // after shrinkage toward the neutral prior
  weight: number;                // normalized weight within the inclusion set
  contribution: number;          // shrunkScore × weight, in points
  included: boolean;             // member of the synthesis inclusion set — §6.3
  gated: boolean;
  notes: string[];
}

export interface ConsistencyFinding {
  rule: string;                  // R1..R5
  type: "CORROBORATION" | "CONTRADICTION";
  delta: number;
  reading: string;
}

export interface TrustResult {
  trustIndex: number;
  status: TrustStatus;
  verdict: Verdict;
  recommendation: Recommendation;
  risk: RiskLevel;
  completeness: number;          // 0–1 — §7
  confidence: number;            // 0–1 overall — §7
  breakdown: EvidenceRecord[];
  consistency: ConsistencyFinding[];
  ineligibleReasons: string[];
  audit: string[];               // the explainability contract — §10
  zoneCheck: ZoneCheck | null;   // haversine verification against the assigned zone — §6.7
  backendScore: number | null;
  backendVerdict: string | null;
  delta: number | null;          // trustIndex − backendScore, when both exist
}

export interface SubmissionLike {
  overall_score?: number;
  verdict?: string;
  flags?: string | string[];
  checks?: Record<string, { score?: number; status?: string } | null>;
  gps?: { lat?: any; lon?: any; accuracy_m?: any };
  duration_mins?: any;
  image_url?: string;
  audio_url?: string;
}

// ─── Constants (Bible §3, §6.5, §8, §9) ──────────────────────────────────────

export const ENGINE_KEYS: EngineKey[] = ["gps", "duration", "image", "audio", "duplicate", "text_ai"];

export const ENGINE_LABELS: Record<EngineKey, string> = {
  gps: "GPS Location",
  duration: "Duration",
  image: "Image Evidence",
  audio: "Audio Evidence",
  duplicate: "Duplicate Check",
  text_ai: "AI Detection",
};

const PRIMARY_ENGINES = new Set<EngineKey>(["gps", "duration", "image", "audio"]);

const NEUTRAL_PRIOR = 50;
const CONF_MEASURED = 1.0;
const CONF_GPS_DERIVED = 0.7;
const CONF_LEGACY = 0.3;
const CONSISTENCY_MIN = -10;
const CONSISTENCY_MAX = 3;

const FLAG_ENGINE_OVERRIDES: Record<string, { engine: EngineKey; score: number }> = {
  NO_GPS:                  { engine: "gps",       score: 0 },
  GPS_PARSE_ERROR:         { engine: "gps",       score: 5 },
  GPS_OUTSIDE_NIGERIA:     { engine: "gps",       score: 10 },
  OUTSIDE_ASSIGNED_ZONE:   { engine: "gps",       score: 15 },
  LOW_GPS_ACCURACY:        { engine: "gps",       score: 35 },
  GPS_POOR_ACCURACY:       { engine: "gps",       score: 35 },
  DURATION_NEGATIVE:       { engine: "duration",  score: 0 },
  BACK_TO_BACK:            { engine: "duration",  score: 5 },
  DURATION_PARSE_ERROR:    { engine: "duration",  score: 5 },
  DURATION_TOO_SHORT:      { engine: "duration",  score: 10 },
  DURATION_TOO_LONG:       { engine: "duration",  score: 20 },
  DURATION_NOT_CALCULABLE: { engine: "duration",  score: 20 },
  DUPLICATE_SUBMISSION:    { engine: "duplicate", score: 0 },
  DUPLICATE_IMAGE:         { engine: "duplicate", score: 5 },
  DUPLICATE_AUDIO:         { engine: "duplicate", score: 5 },
  AUDIO_EMPTY:             { engine: "audio",     score: 0 },
  AUDIO_QUALITY_ISSUE:     { engine: "audio",     score: 25 },
  IMAGE_QUALITY_ISSUE:     { engine: "image",     score: 25 },
  AI_GENERATED_IMAGE:      { engine: "image",     score: 5 },
  DOWNLOADED_IMAGE:        { engine: "image",     score: 5 },
};

// A confirmed AI-generated image is fabricated evidence — as disqualifying
// as a duplicate submission or GPS outside the survey country, not a
// weighted-average nudge. Exported so any narrative/UI code (e.g. Ada's
// briefing) can lead with "this is why it was rejected" using the same
// classification as the scoring math, instead of drifting out of sync.
export const HARD_GATE_FLAGS = new Set([
  "DUPLICATE_SUBMISSION", "DUPLICATE_IMAGE", "DUPLICATE_AUDIO",
  "GPS_OUTSIDE_NIGERIA", "OUTSIDE_ASSIGNED_ZONE",
  "DURATION_NEGATIVE", "BACK_TO_BACK", "AUDIO_EMPTY",
  "AI_GENERATED_IMAGE", "DOWNLOADED_IMAGE",
  "SINGLE_VOICE_DETECTED", "ROAMING_PAIR_DETECTED",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseFlags(flags: string | string[] | undefined): string[] {
  // Always copy — the engine may append synthetic flags (§6.7) and must
  // never mutate the caller's submission object (purity, Bible §0.5).
  return Array.isArray(flags)
    ? [...flags]
    : String(flags || "").split(",").map(f => f.trim()).filter(Boolean);
}

function numOrNull(v: any): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// Bible §6.2 — logarithmic GPS score from horizontal accuracy in metres.
export function gpsScoreFromAccuracy(accuracyM: number): number {
  return Math.max(0, Math.round(100 - Math.log10(Math.max(1, accuracyM)) * 40));
}

// Bible §6.7 — great-circle distance in metres between two coordinates.
export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface ZoneCheck {
  distanceM: number;
  radiusM: number;
  withinZone: boolean;
  label?: string;
  matchedZoneIndex?: number; // index into zoneList when matching from a list
}

// ─── The engine ───────────────────────────────────────────────────────────────

export function computeTrustIndex(sub: SubmissionLike, config: EngineConfig): TrustResult {
  const audit: string[] = [];
  const flags = parseFlags(sub.flags);
  const checks = sub.checks || {};
  const backendScore = numOrNull(sub.overall_score);
  const backendVerdict = sub.verdict ?? null;
  const lat = numOrNull(sub.gps?.lat), lon = numOrNull(sub.gps?.lon);
  const accuracy = numOrNull(sub.gps?.accuracy_m);

  // ── Assigned-zone verification (Bible §6.7 / §16) ──
  // When the client tells us where the enumerator should be, we verify by
  // haversine distance. Outside the radius acts exactly like the backend's
  // OUTSIDE_ASSIGNED_ZONE flag (override + hard gate). When no zone is set,
  // the platform simply reports where enumeration happened.
  //
  // If zoneList is non-empty, we pick the CLOSEST zone and verify against it.
  // This lets one config serve many field sites (e.g. 40 PHCs in a state).
  let zoneCheck: ZoneCheck | null = null;
  const effectiveZones: (typeof config.assignedZone)[] =
    (config.zoneList && config.zoneList.length > 0)
      ? config.zoneList
      : (config.assignedZone?.lat != null && config.assignedZone?.lon != null ? [config.assignedZone] : []);

  if (effectiveZones.length > 0 && lat != null && lon != null) {
    // Find the closest zone
    let closestIdx = 0;
    let closestDist = Infinity;
    effectiveZones.forEach((z, i) => {
      if (z.lat == null || z.lon == null) return;
      const d = haversineMeters(lat, lon, z.lat, z.lon);
      if (d < closestDist) { closestDist = d; closestIdx = i; }
    });
    const zone = effectiveZones[closestIdx];
    if (zone && zone.lat != null && zone.lon != null) {
      const distanceM = Math.round(haversineMeters(lat, lon, zone.lat, zone.lon));
      const withinZone = distanceM <= zone.radiusM;
      zoneCheck = {
        distanceM, radiusM: zone.radiusM, withinZone, label: zone.label,
        matchedZoneIndex: config.zoneList && config.zoneList.length > 0 ? closestIdx : undefined,
      };
      if (withinZone) {
        audit.push(`Assigned zone: enumeration was ${distanceM} m from${zone.label ? ` "${zone.label}"` : " the assigned location"} — within the ${zone.radiusM} m radius. Presence corroborated.`);
      } else {
        audit.push(`Assigned zone: enumeration was ${distanceM} m from${zone.label ? ` "${zone.label}"` : " the assigned location"} — OUTSIDE the ${zone.radiusM} m radius.`);
        if (!flags.includes("OUTSIDE_ASSIGNED_ZONE")) flags.push("OUTSIDE_ASSIGNED_ZONE");
      }
    }
  }

  // Worst (lowest) override per engine — Bible §6.5.
  const overrideByEngine: Partial<Record<EngineKey, { score: number; flag: string }>> = {};
  for (const flag of flags) {
    const ovr = FLAG_ENGINE_OVERRIDES[flag];
    if (ovr && (overrideByEngine[ovr.engine] === undefined || ovr.score < overrideByEngine[ovr.engine]!.score)) {
      overrideByEngine[ovr.engine] = { score: ovr.score, flag };
    }
  }

  // ── L1 Validation — the legacy escape hatch (Bible §5) ──
  const anyCheckScore = ENGINE_KEYS.some(k => numOrNull(checks[k]?.score) != null);
  const anyEvidenceData = anyCheckScore || flags.length > 0 || lat != null || lon != null ||
    accuracy != null || numOrNull(sub.duration_mins) != null || !!sub.image_url || !!sub.audio_url;

  if (!anyEvidenceData) {
    const passthrough = backendScore ?? 0;
    const pt = config.passScoreThreshold ?? 60;
    const unverifiedVerdict: Verdict = backendScore != null
      ? (backendScore >= pt ? "PASS" : backendScore >= 45 ? "FLAG" : "REJECT")
      : ((backendVerdict as Verdict) || "FLAG");
    audit.push(backendScore != null
      ? `No per-engine evidence available — legacy submission. Backend score ${backendScore} classified against pass threshold ${pt}.`
      : "No evidence and no backend score — nothing to evaluate.");
    return {
      trustIndex: Math.round(passthrough), status: "UNVERIFIED",
      verdict: unverifiedVerdict,
      recommendation: "REVIEW", risk: "MEDIUM",
      completeness: 0, confidence: CONF_LEGACY,
      breakdown: [], consistency: [], ineligibleReasons: [], audit, zoneCheck,
      backendScore, backendVerdict, delta: null,
    };
  }

  // ── L2 Evidence assembly (Bible §3) ──
  // A backend check with status NOT_AVAILABLE / DISABLED carries a placeholder
  // score of 50 that is NOT a measurement — the channel simply wasn't there
  // (e.g. no audio recorded). Treat it as no score at all, otherwise missing
  // evidence silently contributes 50/100 at full weight (Bible §3: absent
  // optional evidence is excluded, never scored).
  const measuredScore = (check?: { score?: number; status?: string } | null): number | null => {
    const status = (check?.status || "").toUpperCase();
    if (status === "NOT_AVAILABLE" || status === "DISABLED") return null;
    return numOrNull(check?.score);
  };

  // GPS raw score: backend measurement wins; accuracy-derived fallback is lower confidence.
  const gpsBackend = measuredScore(checks.gps);
  const gpsDerived = accuracy != null ? gpsScoreFromAccuracy(accuracy) : null;
  const gpsRaw = gpsBackend != null && gpsBackend > 0 ? gpsBackend : gpsDerived;
  const gpsConfidence = gpsBackend != null && gpsBackend > 0 ? CONF_MEASURED : CONF_GPS_DERIVED;

  const rawScores: Record<EngineKey, number | null> = {
    gps: gpsRaw,
    duration: measuredScore(checks.duration),
    image: measuredScore(checks.image),
    audio: measuredScore(checks.audio),
    duplicate: measuredScore(checks.duplicate),
    text_ai: measuredScore(checks.text_ai),
  };

  // Evidence presence per engine — Bible §3 table.
  const gpsAbsentFlags = flags.includes("NO_GPS") || flags.includes("GPS_PARSE_ERROR");
  const audioEmptyFlag = flags.includes("AUDIO_EMPTY");
  const presence: Record<EngineKey, EvidencePresence> = {
    gps: gpsAbsentFlags ? "ABSENT"
      : rawScores.gps != null ? "MEASURED"
      : (lat != null && lon != null) ? "PRESENT_UNMEASURED" : "ABSENT",
    duration: rawScores.duration != null || overrideByEngine.duration ? "MEASURED"
      : numOrNull(sub.duration_mins) != null ? "PRESENT_UNMEASURED" : "ABSENT",
    image: rawScores.image != null || overrideByEngine.image ? "MEASURED"
      : sub.image_url ? "PRESENT_UNMEASURED" : "ABSENT",
    audio: audioEmptyFlag ? "ABSENT"
      : rawScores.audio != null || overrideByEngine.audio ? "MEASURED"
      : sub.audio_url ? "PRESENT_UNMEASURED" : "ABSENT",
    duplicate: rawScores.duplicate != null || overrideByEngine.duplicate ? "MEASURED" : "ABSENT",
    text_ai: rawScores.text_ai != null || overrideByEngine.text_ai ? "MEASURED" : "ABSENT",
  };
  // A flag override on gps counts as a measurement even when data was absent
  // (the zero it forces is arithmetically identical either way — Bible §6.5 note).
  if (presence.gps === "ABSENT" && overrideByEngine.gps) presence.gps = "MEASURED";
  if (presence.audio === "ABSENT" && overrideByEngine.audio && !audioEmptyFlag) presence.audio = "MEASURED";

  // ── L3 Eligibility (Bible §5) ──
  // For eligibility, flag-forced absence (NO_GPS, AUDIO_EMPTY) counts as absent.
  const absentForEligibility = (k: EngineKey): boolean => {
    if (k === "gps" && gpsAbsentFlags) return true;
    if (k === "audio" && audioEmptyFlag) return true;
    return presence[k] === "ABSENT";
  };
  const ineligibleReasons: string[] = [];
  for (const k of ENGINE_KEYS) {
    if (config.requirements[k] === "HARD_REQUIRED" && PRIMARY_ENGINES.has(k) && absentForEligibility(k)) {
      ineligibleReasons.push(`${ENGINE_LABELS[k]} is hard-required for this project and was not provided.`);
    }
  }

  // ── Build Evidence Records ──
  const records: EvidenceRecord[] = ENGINE_KEYS.map(k => {
    const requirement = config.requirements[k];
    const primary = PRIMARY_ENGINES.has(k);
    const override = overrideByEngine[k] ?? null;
    const raw = rawScores[k];
    const notes: string[] = [];

    let effective: number | null = null;
    if (override && raw != null) effective = Math.min(raw, override.score);
    else if (override) effective = override.score;
    else if (raw != null) effective = raw;

    let conf = k === "gps" ? gpsConfidence : CONF_MEASURED;
    if (override) conf = CONF_MEASURED;

    return {
      key: k, label: ENGINE_LABELS[k], primary, requirement,
      presence: presence[k],
      rawScore: raw,
      flagOverride: override?.flag ?? null,
      effectiveScore: effective,
      confidence: conf,
      shrunkScore: null, weight: 0, contribution: 0,
      included: false, gated: false, notes,
    };
  });

  // ── Gating (Bible §6.6) ──
  const gated = new Set<string>();
  const hasGpsReject = flags.some(f => ["GPS_OUTSIDE_NIGERIA", "GPS_PARSE_ERROR", "NO_GPS"].includes(f));
  const hasDurationReject = flags.some(f => ["DURATION_TOO_SHORT", "DURATION_TOO_LONG", "DURATION_NEGATIVE", "BACK_TO_BACK"].includes(f));
  const hasDuplicateReject = flags.includes("DUPLICATE_SUBMISSION");
  if (hasGpsReject) config.gating.gps_reject_skips.forEach(e => gated.add(e));
  if (hasDurationReject) config.gating.duration_reject_skips.forEach(e => gated.add(e));
  if (hasDuplicateReject) config.gating.duplicate_reject_skips.forEach(e => gated.add(e));

  // ── L4 Trust Synthesis (Bible §6.3–6.4) ──
  for (const r of records) {
    r.gated = gated.has(r.key);
    if (r.requirement === "DISABLED") { r.notes.push("Engine disabled for this project."); continue; }
    if (r.gated) { r.notes.push("Gated: excluded because an upstream check already failed."); continue; }

    const measured = r.effectiveScore != null;
    const requiredAbsent = r.primary &&
      (r.requirement === "REQUIRED" || r.requirement === "HARD_REQUIRED") &&
      r.presence === "ABSENT";

    if (measured) {
      r.included = true;
      if (r.flagOverride) r.notes.push(`Score capped at ${r.effectiveScore} by flag ${r.flagOverride}.`);
      if (r.key === "gps" && r.confidence < 1 && !r.flagOverride) {
        r.notes.push(`Derived from GPS accuracy (confidence ${r.confidence.toFixed(2)}) — shrunk toward the neutral prior.`);
      }
    } else if (requiredAbsent) {
      // The heart of the system: required primary absence enters as a certain zero.
      r.included = true;
      r.effectiveScore = 0;
      r.confidence = CONF_MEASURED;
      r.notes.push("Required evidence missing — scored 0 at full weight (Bible §4).");
    } else if (r.presence === "PRESENT_UNMEASURED") {
      r.notes.push(`${r.label} submitted but not yet analyzed — excluded from synthesis, no penalty (Bible §4).`);
    } else if (!r.primary) {
      r.notes.push("Analysis did not run — platform responsibility, never penalizes the enumerator (Bible §3).");
    } else {
      r.notes.push("Optional evidence not provided — excluded, no penalty.");
    }
  }

  const inclusion = records.filter(r => r.included);
  const totalWeight = inclusion.reduce((s, r) => s + config.weights[r.key], 0);

  let Q = 0;
  if (totalWeight > 0) {
    for (const r of inclusion) {
      r.weight = config.weights[r.key] / totalWeight;
      r.shrunkScore = r.confidence * (r.effectiveScore as number) + (1 - r.confidence) * NEUTRAL_PRIOR;
      r.contribution = r.shrunkScore * r.weight;
      Q += r.contribution;
      audit.push(
        `${r.label}: ${r.effectiveScore}${r.flagOverride ? ` (forced by ${r.flagOverride})` : ""}` +
        `${r.confidence < 1 ? ` → ${r.shrunkScore.toFixed(1)} after confidence shrinkage (c=${r.confidence})` : ""}` +
        ` × ${(r.weight * 100).toFixed(0)}% = ${r.contribution.toFixed(1)} pts`
      );
    }
  }

  // ── Completeness & overall confidence (Bible §7) ──
  const active = records.filter(r => r.requirement !== "DISABLED");
  const activeWeight = active.reduce((s, r) => s + config.weights[r.key], 0);
  const completeness = activeWeight > 0
    ? active.reduce((s, r) => s + config.weights[r.key] *
        (r.presence === "MEASURED" ? 1 : r.presence === "PRESENT_UNMEASURED" ? 0.5 : 0), 0) / activeWeight
    : 0;
  const confidence = inclusion.length > 0
    ? inclusion.reduce((s, r) => s + r.weight * r.confidence, 0)
    : CONF_LEGACY;

  // ── INELIGIBLE short-circuit (after records are built, so the UI can show why) ──
  if (ineligibleReasons.length > 0) {
    ineligibleReasons.forEach(r => audit.push(`INELIGIBLE: ${r}`));
    return {
      trustIndex: 0, status: "INELIGIBLE", verdict: "REJECT",
      recommendation: "REJECT", risk: "CRITICAL",
      completeness, confidence,
      breakdown: records, consistency: [], ineligibleReasons, audit, zoneCheck,
      backendScore, backendVerdict,
      delta: backendScore != null ? 0 - backendScore : null,
    };
  }

  // ── L5 Consistency Engine (Bible §8) ──
  const consistency: ConsistencyFinding[] = [];
  const audioScore = records.find(r => r.key === "audio")?.effectiveScore;
  const textAiScore = records.find(r => r.key === "text_ai")?.effectiveScore;
  const durationMins = numOrNull(sub.duration_mins);
  const audioAbsent = presence.audio === "ABSENT" || audioEmptyFlag;
  // R3 counts only REQUIRED/HARD_REQUIRED channels — optional absence is
  // never a penalty, not even a consistency one (Bible §4, principle 3).
  const primaryAbsentCount = ENGINE_KEYS.filter(k =>
    PRIMARY_ENGINES.has(k) &&
    (config.requirements[k] === "REQUIRED" || config.requirements[k] === "HARD_REQUIRED") &&
    absentForEligibility(k)
  ).length;

  if ((flags.includes("DURATION_TOO_SHORT") || flags.includes("BACK_TO_BACK")) &&
      (audioEmptyFlag || (audioScore != null && audioScore < 30))) {
    consistency.push({ rule: "R1", type: "CONTRADICTION", delta: -5,
      reading: "An impossibly fast interview and no usable audio corroborate fabrication." });
  }
  if (flags.some(f => f.startsWith("DUPLICATE_")) &&
      (flags.includes("DURATION_TOO_SHORT") || (durationMins != null && durationMins < config.minDurationMins))) {
    consistency.push({ rule: "R2", type: "CONTRADICTION", delta: -5,
      reading: "Duplicated content submitted quickly — a content-recycling pattern." });
  }
  if (primaryAbsentCount >= 2) {
    consistency.push({ rule: "R3", type: "CONTRADICTION", delta: -5,
      reading: "Multiple independent evidence channels are missing — itself a pattern." });
  }
  if (textAiScore != null && textAiScore <= 40 && (audioAbsent || audioEmptyFlag)) {
    consistency.push({ rule: "R4", type: "CONTRADICTION", delta: -5,
      reading: "AI-suspect answers with no audio evidence to verify against." });
  }
  const includedPrimary = inclusion.filter(r => r.primary);
  if (flags.length === 0 && includedPrimary.length > 0 && includedPrimary.every(r => (r.effectiveScore as number) >= 80)) {
    consistency.push({ rule: "R5", type: "CORROBORATION", delta: 3,
      reading: "Every evidence channel independently agrees — the story coheres." });
  }

  const rawDelta = consistency.reduce((s, c) => s + c.delta, 0);
  const consistencyDelta = Math.max(CONSISTENCY_MIN, Math.min(CONSISTENCY_MAX, rawDelta));
  consistency.forEach(c => audit.push(`Consistency ${c.rule} (${c.delta > 0 ? "+" : ""}${c.delta}): ${c.reading}`));
  if (rawDelta !== consistencyDelta) audit.push(`Consistency total clamped from ${rawDelta} to ${consistencyDelta}.`);

  const trustIndex = totalWeight > 0
    ? Math.round(Math.min(100, Math.max(0, Q + consistencyDelta)))
    : Math.round(backendScore ?? 0);
  if (totalWeight > 0) {
    audit.push(`Trust Index = ${Q.toFixed(1)}${consistencyDelta !== 0 ? ` ${consistencyDelta > 0 ? "+" : "−"} ${Math.abs(consistencyDelta)} (consistency)` : ""} → ${trustIndex}`);
  }

  // ── L6 Risk & Recommendation (Bible §9) ──
  const hasHardGate = flags.some(f => HARD_GATE_FLAGS.has(f));
  const pt = config.passScoreThreshold ?? 60;
  let risk: RiskLevel; let recommendation: Recommendation; let verdict: Verdict;
  if (hasHardGate) {
    risk = "CRITICAL"; recommendation = "REJECT"; verdict = "REJECT";
    audit.push(`Hard gate: ${flags.filter(f => HARD_GATE_FLAGS.has(f)).join(", ")} → CRITICAL / REJECT regardless of arithmetic.`);
  } else if (trustIndex >= pt) {
    risk = flags.length > 0 ? "LOW" : trustIndex >= 85 && completeness >= 0.9 ? "VERY_LOW" : "LOW";
    recommendation = "APPROVE"; verdict = "PASS";
    audit.push(`Trust ${trustIndex} ≥ pass threshold ${pt} → PASS.`);
  } else if (trustIndex >= 30) {
    risk = trustIndex < pt * 0.6 ? "HIGH" : "MEDIUM";
    recommendation = "REVIEW"; verdict = "FLAG";
    audit.push(`Trust ${trustIndex} is below the pass threshold (${pt}) → FLAG for review.`);
  } else {
    risk = "CRITICAL"; recommendation = "REJECT"; verdict = "REJECT";
    audit.push(`Trust ${trustIndex} is critically low → REJECT.`);
  }

  return {
    trustIndex, status: "SCORED", verdict, recommendation, risk,
    completeness, confidence,
    breakdown: records, consistency, ineligibleReasons: [], audit, zoneCheck,
    backendScore, backendVerdict,
    delta: backendScore != null ? trustIndex - backendScore : null,
  };
}
