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

import type { ZonePoint, ZoneShape } from "./zoneGeometry";

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
// verifies presence against it; when unset, the platform simply reports where
// enumeration happened (coordinates + reverse-geocoded address).
//
// A zone is a shape, not only a pin (Bible §6.7, zoneGeometry.ts). The shape
// field is optional and absent means "circle", so every zone configured before
// shapes existed is exactly what it was: lat/lon/radiusM, unchanged.
export interface AssignedZone {
  lat: number | null;
  lon: number | null;
  radiusM: number;
  label?: string;
  /** Absent = "circle". */
  shape?: ZoneShape;
  /** Corridor (a road centreline) and polygon (an area boundary). */
  points?: ZonePoint[];
  /** Corridor — total width across the road, in metres. */
  widthM?: number;
  /** Polygon — GPS drift allowance outside the boundary, in metres. May be 0. */
  bufferM?: number;
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

/** Speed bands, km/h. Strictly increasing: suspicious < veryHigh < impossible. */
export interface TravelThresholds {
  suspiciousKph: number;
  veryHighKph: number;
  impossibleKph: number;
}

/** The server's engines/travel_engine.py defaults. Kept identical on purpose. */
export const DEFAULT_TRAVEL_THRESHOLDS: TravelThresholds = {
  suspiciousKph: 120,   // above realistic sustained road speed
  veryHighKph: 350,     // faster than any land vehicle in normal use
  impossibleKph: 900,   // faster than a commercial airliner
};

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
  // How far outside the radius stops being "review this" and becomes "reject
  // this" — Bible §6.7. Mirrors the server's zone_reject_km so the dashboard and
  // the engine that issues the real verdict agree. 0 restores the old
  // reject-at-any-distance rule.
  zoneRejectKm: number;
  // How fast an enumerator may appear to move between two of their own
  // interviews before the verdict changes. Mirrors the server's
  // travel_suspicious_kph / travel_very_high_kph / travel_impossible_kph so the
  // cross-submission analysis on the Submissions page reaches the same reading
  // as the engine that actually scored them — a browser saying "impossible"
  // beside a server PASS is worse than not saying it.
  travelThresholds: TravelThresholds;
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
  zoneRejectKm: 2,
  travelThresholds: { ...DEFAULT_TRAVEL_THRESHOLDS },
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
      travelThresholds: { ...DEFAULT_TRAVEL_THRESHOLDS, ...(parsed.travelThresholds || {}) },
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

// computeAdjustedScore() was removed here. It was a third, independent copy of
// the hard-gate rule — flags, verdict thresholds and all — kept alongside
// trustEngine.ts's HARD_GATE_FLAGS and score_engine.py's. It had no callers:
// computeTrustIndex() had superseded it, and nothing noticed.
//
// It was not harmless. Its copy of the list still contained
// OUTSIDE_ASSIGNED_ZONE long after the other two dropped it, and it had no
// concept of HARD_GATE_CEILING, so anyone who reached for the conveniently
// named helper would have silently reinstated exactly the bug that made a
// project's pass threshold decorative. Verdict logic lives in trustEngine.ts
// alone; there is one copy in the browser and one on the server, and they are
// pinned to each other by test.
