// FieldScore Trust Intelligence Engine (FTIE)
// Implements docs/15_TRUST_INTELLIGENCE_BIBLE.md — every section reference below
// points into that document. The engine is a pure function: no I/O, no clock,
// no randomness. Same submission + same config = same Trust Index, everywhere.

import type { AssignedZone, EngineConfig, EngineRequirement } from "./engineConfig";
import type { ZoneEvaluation, ZoneShape } from "./zoneGeometry";
import { describeZone, evaluateZone, readableDistance } from "./zoneGeometry";

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

// Out-of-zone scoring — must equal scorer.py's ZONE_BREACH_CEILING and
// ZONE_UNCERTAIN_SCORE. A confirmed breach can score at best half; a reading
// too coarse to place cannot be scored as a breach at all.
export const ZONE_BREACH_CEILING = 50;
export const ZONE_UNCERTAIN_SCORE = 70;

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
  // OUTSIDE_ASSIGNED_ZONE is deliberately absent. A flat override here made
  // 673 m and 50 km score identically — 15/100, which renders as 1 out of the
  // 6 available GPS points — while the server had already computed a
  // distance-proportional score (max(0, 100 - km*10) → 94 at 673 m) and sent
  // it on the submission. Overriding it discarded the only number that carried
  // the distance, and left the dashboard unable to answer "how far outside?"
  // at all. The server's gps score is used as-is; see zone_severity() there.
  LOW_GPS_ACCURACY:        { engine: "gps",       score: 35 },
  GPS_POOR_ACCURACY:       { engine: "gps",       score: 35 },
  DURATION_NEGATIVE:       { engine: "duration",  score: 0 },
  BACK_TO_BACK:            { engine: "duration",  score: 5 },
  DURATION_PARSE_ERROR:    { engine: "duration",  score: 5 },
  DURATION_TOO_SHORT:      { engine: "duration",  score: 10 },
  DURATION_TOO_LONG:       { engine: "duration",  score: 20 },
  // DURATION_NOT_CALCULABLE deliberately has no entry. The server already
  // scores this case 50 — "we could not measure it", not "this was wrong" —
  // and overriding it to 20 here made the dashboard disagree with the engine,
  // the same divergence that once showed a flat 15 for a submission scored 94.
  //
  // It mattered more than a normal disagreement: until the XLSForm builders
  // started emitting start/end metadata, NO generated form collected times, so
  // this flag was on essentially every submission and quietly cost each one 8
  // of its 10 duration points for an omission of the platform's. The flag
  // still shows on the submission; it just no longer invents a penalty the
  // server did not ask for.
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
  "GPS_OUTSIDE_NIGERIA",
  // OUTSIDE_ASSIGNED_ZONE is deliberately NOT a hard gate any more. Hard gates
  // bypass the arithmetic entirely — "CRITICAL / REJECT regardless" — so a
  // project that set its pass threshold to 30 still saw every out-of-zone
  // submission rejected, with no setting anywhere that could change it.
  //
  // The server now decides this by distance (FLAG near, REJECT far, boundary
  // configurable per project via zone_reject_km) and sends a real verdict. A
  // second, cruder veto in the browser can only contradict it.
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
  /** Distance to the zone's core geometry: the pin, the road centreline, or
   *  the area (zero inside it). Describes where enumeration happened. */
  distanceM: number;
  /** How far past the zone's own tolerance — zero whenever inside. This is the
   *  number the penalty is built on; see zoneGeometry.ts for why the two
   *  stopped being interchangeable once a zone could be a road or an area. */
  overshootM: number;
  /** radiusM for a circle, half-width for a corridor, buffer for a polygon. */
  radiusM: number;
  shape: ZoneShape;
  withinZone: boolean;
  /** Whether being this far out is actually a rejection, i.e. the overshoot
   *  passed `zoneRejectKm`. Decided here rather than in the UI: the detail page
   *  used to call every breach "a critical violation" while the engine scored a
   *  297 m overshoot at 98/100, so the screen contradicted itself in adjacent
   *  lines. Distance decides the penalty; distance decides the wording too. */
  isCriticalBreach: boolean;
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
  // When the client tells us where the enumerator should be, we verify against
  // it. A zone may be a pin and a radius, a road corridor, or an area
  // boundary — zoneGeometry resolves all three to the same two numbers, using
  // the identical formulas the server runs, so the screen and the record
  // cannot disagree about the same submission. When no zone is set, the
  // platform simply reports where enumeration happened.
  //
  // If zoneList is non-empty, we pick the CLOSEST zone and verify against it.
  // This lets one config serve many field sites (e.g. 40 PHCs in a state).
  let zoneCheck: ZoneCheck | null = null;
  const effectiveZones: AssignedZone[] =
    (config.zoneList && config.zoneList.length > 0)
      ? config.zoneList
      : (config.assignedZone ? [config.assignedZone] : []);

  if (effectiveZones.length > 0 && lat != null && lon != null) {
    // Closest by distance to the zone itself, not to a centre — a corridor and
    // a polygon do not have one, and for a large circle the centre is the
    // wrong thing to rank by anyway.
    let best: { index: number; evaluation: ZoneEvaluation } | null = null;
    effectiveZones.forEach((z, i) => {
      const ev = evaluateZone(lat, lon, z);
      if (!ev) return;   // unusable zone config: verify nothing, accuse nobody
      if (!best || ev.distanceM < best.evaluation.distanceM) {
        best = { index: i, evaluation: ev };
      }
    });

    if (best) {
      // TypeScript narrows `best` to null inside the closure above, so the
      // assignment is invisible to it; the guard on this line is the proof.
      const { index: closestIdx, evaluation: ev } = best as { index: number; evaluation: ZoneEvaluation };
      const zone = effectiveZones[closestIdx];
      const named = ev.label ? ` "${ev.label}"` : ` the assigned ${describeZone(ev.shape)}`;
      zoneCheck = {
        distanceM: Math.round(ev.distanceM),
        overshootM: Math.round(ev.overshootM),
        radiusM: ev.toleranceM,
        shape: ev.shape,
        withinZone: ev.inZone,
        isCriticalBreach: !ev.inZone
          && (ev.overshootM / 1000) > (config.zoneRejectKm ?? 2),
        label: zone.label,
        matchedZoneIndex: config.zoneList && config.zoneList.length > 0 ? closestIdx : undefined,
      };
      if (ev.inZone) {
        // "0 m from the boundary" reads as though the enumerator were standing
        // on the line, which is the opposite of what being inside an area means.
        audit.push(ev.shape === "polygon"
          ? `Assigned zone: enumeration was inside${named}. Presence corroborated.`
          : `Assigned zone: enumeration was ${Math.round(ev.distanceM)} m from${named} — within the ${ev.toleranceM} m tolerance. Presence corroborated.`);
      } else {
        audit.push(`Assigned zone: enumeration was ${readableDistance(ev.overshootM)} OUTSIDE${named} (${Math.round(ev.distanceM)} m away, tolerance ${ev.toleranceM} m).`);
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

  // OUTSIDE_ASSIGNED_ZONE has no fixed entry in the table above because its
  // penalty depends on how far outside the submission was — Bible §6.7. The same
  // formula the server uses (max(0, 100 - km*10)) is applied here so the two
  // agree; a flat 15 made 673 m and 50 km identical, which is what this
  // replaces.
  //
  // The distance is the OVERSHOOT — how far past the zone's own tolerance —
  // not the distance to its centre. Those are the same thing for a small
  // circle and nothing like it for a 5 km project area, where measuring from
  // the pin rejects a submission 100 m outside the boundary as though it were
  // 5 km adrift. Overshoot is also the only one of the two that a polygon has.
  if (zoneCheck && !zoneCheck.withinZone) {
    // Mirrors scorer.py's zone_severity exactly — same constants, same shape.
    // Accuracy decides whether we can *tell* the submission was outside, not
    // how much grace it gets for being outside: a 10 m fix 297 m past the
    // boundary is not ambiguous, while a 300 m fix at the same distance cannot
    // be separated from standing on the line.
    const acc = accuracy != null && accuracy > 0 ? accuracy : 0;
    const confidentM = zoneCheck.overshootM - acc;
    let zoneScore: number;
    if (confidentM <= 0) {
      // Neither exonerated nor condemned — the reading cannot place it.
      zoneScore = ZONE_UNCERTAIN_SCORE;
      audit.push(
        `Assigned zone: ${Math.round(zoneCheck.overshootM)} m outside, but the GPS fix is ` +
        `±${Math.round(acc)} m — too coarse to place this submission either side of the boundary.`);
    } else {
      // The ceiling is the point. The previous curve began at 100 and lost ten
      // points per kilometre, so 297 m outside scored 98 and contributed full
      // marks beside a flag saying the enumerator was not where they were sent.
      const rejectM = Math.max(1, (config.zoneRejectKm ?? 2) * 1000);
      zoneScore = Math.max(0, Math.round(
        ZONE_BREACH_CEILING * Math.max(0, 1 - confidentM / rejectM)));
    }
    const existing = overrideByEngine.gps;
    if (existing === undefined || zoneScore < existing.score) {
      overrideByEngine.gps = { score: zoneScore, flag: "OUTSIDE_ASSIGNED_ZONE" };
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
  // A zone breach far enough out is still a veto — Bible §6.7. Near ones are not,
  // which is the whole point of the change: distance decides. Mirrors the
  // server's zone_reject_km so both halves reach the same verdict.
  const zoneRejectKm = config.zoneRejectKm ?? 2;
  // Read the flag set when zoneCheck was built rather than recomputing the
  // comparison — two copies of this rule is how the banner and the score came
  // to disagree in the first place.
  const zoneBreachRejects = !!zoneCheck && zoneCheck.isCriticalBreach;

  const hasHardGate = flags.some(f => HARD_GATE_FLAGS.has(f)) || zoneBreachRejects;
  const pt = config.passScoreThreshold ?? 60;
  let risk: RiskLevel; let recommendation: Recommendation; let verdict: Verdict;
  if (hasHardGate) {
    risk = "CRITICAL"; recommendation = "REJECT"; verdict = "REJECT";
    const gateNames = flags.filter(f => HARD_GATE_FLAGS.has(f));
    if (zoneBreachRejects) {
      gateNames.push(
        `OUTSIDE_ASSIGNED_ZONE (${(zoneCheck!.overshootM / 1000).toFixed(2)} km beyond the ${describeZone(zoneCheck!.shape)}, past the ${zoneRejectKm} km reject boundary)`,
      );
    }
    audit.push(`Hard gate: ${gateNames.join(", ")} → CRITICAL / REJECT regardless of arithmetic.`);
  } else if (trustIndex >= pt && flags.length > 0) {
    // Bible §9: "T ≥ passThreshold, flags present → MEDIUM / REVIEW / FLAG".
    //
    // This branch did not exist. A submission that cleared the threshold was
    // APPROVED even carrying fraud flags, so a flagged submission could pass
    // unseen — the false-approval direction, on a platform whose product is
    // verification. It became urgent with §7's distance-aware zones: without
    // it, a submission 673 m outside its assigned area scores highly on
    // everything else and disappears silently instead of reaching a supervisor.
    risk = "MEDIUM"; recommendation = "REVIEW"; verdict = "FLAG";
    audit.push(`Trust ${trustIndex} ≥ pass threshold ${pt}, but ${flags.length} flag(s) present (${flags.join(", ")}) → FLAG for review, not automatic approval.`);
  } else if (trustIndex >= pt) {
    risk = trustIndex >= 85 && completeness >= 0.9 ? "VERY_LOW" : "LOW";
    recommendation = "APPROVE"; verdict = "PASS";
    audit.push(`Trust ${trustIndex} ≥ pass threshold ${pt}, no flags → PASS.`);
  } else if (trustIndex >= 50) {
    // Bible §9: the 50–69 band is HIGH risk and REVIEW — never auto-REJECT.
    // The engine had been computing HIGH only below 60% of the threshold, so
    // most of this band reported MEDIUM and understated the risk.
    risk = "HIGH"; recommendation = "REVIEW"; verdict = "FLAG";
    audit.push(`Trust ${trustIndex} is below the pass threshold (${pt}) → HIGH risk, FLAG for review.`);
  } else {
    risk = "CRITICAL"; recommendation = "REJECT"; verdict = "REJECT";
    audit.push(`Trust ${trustIndex} is below 50 → REJECT (Bible §9).`);
  }

  return {
    trustIndex, status: "SCORED", verdict, recommendation, risk,
    completeness, confidence,
    breakdown: records, consistency, ineligibleReasons: [], audit, zoneCheck,
    backendScore, backendVerdict,
    delta: backendScore != null ? trustIndex - backendScore : null,
  };
}
