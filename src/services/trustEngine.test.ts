// Canonical scenario suite for the Trust Intelligence Engine.
// One-to-one with docs/15_TRUST_INTELLIGENCE_BIBLE.md §13 and the edge-case
// ledger in §12. A change to either side without the other is a build-breaking event.

import { computeTrustIndex, gpsScoreFromAccuracy, haversineMeters } from "./trustEngine";
import { DEFAULT_ENGINE_CONFIG } from "./engineConfig";
import type { EngineConfig } from "./engineConfig";

const cfg = (over: Partial<EngineConfig> = {}): EngineConfig => ({
  ...DEFAULT_ENGINE_CONFIG,
  ...over,
  weights: { ...DEFAULT_ENGINE_CONFIG.weights, ...(over.weights || {}) },
  requirements: { ...DEFAULT_ENGINE_CONFIG.requirements, ...(over.requirements || {}) },
  gating: { ...DEFAULT_ENGINE_CONFIG.gating, ...(over.gating || {}) },
});

const fullChecks = (s: Record<string, number>) =>
  Object.fromEntries(Object.entries(s).map(([k, v]) => [k, { score: v, status: "PASS" }]));

const FULL_HOUSE = {
  overall_score: 89,
  checks: fullChecks({ gps: 90, duration: 85, image: 88, audio: 92, duplicate: 95, text_ai: 90 }),
  gps: { lat: 6.5, lon: 3.3, accuracy_m: 8 },
  duration_mins: 25,
  image_url: "https://x/img.jpg",
  audio_url: "https://x/aud.mp3",
  flags: [] as string[],
};

describe("S1 Full house — continuity with the weighted average", () => {
  it("scores the weighted mean plus the R5 corroboration bonus, PASS, complete evidence", () => {
    const r = computeTrustIndex(FULL_HOUSE, cfg());
    // Q = .25·90+.22·85+.20·88+.13·92+.10·95+.10·90 = 89.26; R5 +3 → 92
    expect(r.trustIndex).toBe(92);
    expect(r.status).toBe("SCORED");
    expect(r.verdict).toBe("PASS");
    expect(r.risk).toBe("VERY_LOW");
    expect(r.completeness).toBeCloseTo(1.0, 5);
    expect(r.confidence).toBeCloseTo(1.0, 5);
    expect(r.consistency.map(c => c.rule)).toContain("R5");
  });

  it("E23: only weight ratios matter — doubling all weights changes nothing", () => {
    const doubled = cfg({ weights: { gps: 0.5, duration: 0.44, image: 0.4, audio: 0.26, duplicate: 0.2, text_ai: 0.2 } });
    expect(computeTrustIndex(FULL_HOUSE, doubled).trustIndex).toBe(92);
  });
});

describe("S2 The missing photo — required absence is a zero, never redistributed", () => {
  const sub = {
    checks: fullChecks({ gps: 90, duration: 85, audio: 92 }),
    gps: { lat: 6.5, lon: 3.3 },
    duration_mins: 25,
    audio_url: "https://x/aud.mp3",
    flags: [],
  };
  it("caps the attainable score by the image weight share", () => {
    // Pin the threshold: this scenario tests gray-zone semantics at 70,
    // independent of the shipped default (60).
    const r = computeTrustIndex(sub, cfg({ passScoreThreshold: 70 }));
    // inclusion {gps .3125, dur .275, img .25 @ 0, aud .1625}: Q = 66.45 → 66
    expect(r.trustIndex).toBe(66);
    expect(r.verdict).toBe("FLAG");
    expect(r.risk).toBe("HIGH");
    const img = r.breakdown.find(b => b.key === "image")!;
    expect(img.included).toBe(true);
    expect(img.effectiveScore).toBe(0);
    expect(img.presence).toBe("ABSENT");
    expect(img.notes.join(" ")).toMatch(/Required evidence missing/);
  });
});

describe("S3 The hard wall — HARD_REQUIRED absence is ineligibility, not a low score", () => {
  it("returns INELIGIBLE with Trust 0 and an explicit reason", () => {
    const r = computeTrustIndex(
      { checks: fullChecks({ gps: 90, duration: 85, audio: 92 }), gps: { lat: 6.5, lon: 3.3 }, duration_mins: 25, flags: [] },
      cfg({ requirements: { image: "HARD_REQUIRED" } as any })
    );
    expect(r.status).toBe("INELIGIBLE");
    expect(r.trustIndex).toBe(0);
    expect(r.verdict).toBe("REJECT");
    expect(r.risk).toBe("CRITICAL");
    expect(r.ineligibleReasons[0]).toMatch(/Image Evidence/);
  });
});

describe("S4 Platform's fault — submitted-but-unmeasured evidence never penalizes", () => {
  it("excludes the image, credits 50% completeness, no penalty", () => {
    const r = computeTrustIndex(
      {
        checks: fullChecks({ gps: 90, duration: 85, audio: 92 }),
        gps: { lat: 6.5, lon: 3.3 }, duration_mins: 25,
        image_url: "https://x/img.jpg", audio_url: "https://x/aud.mp3", flags: [],
      },
      cfg()
    );
    // inclusion {gps,dur,aud}/.60: Q = 88.6; R5 +3 → 92
    expect(r.trustIndex).toBe(92);
    expect(r.verdict).toBe("PASS");
    expect(r.risk).toBe("LOW"); // completeness < 90% blocks VERY_LOW
    const img = r.breakdown.find(b => b.key === "image")!;
    expect(img.included).toBe(false);
    expect(img.presence).toBe("PRESENT_UNMEASURED");
    expect(r.completeness).toBeCloseTo(0.70, 5);
  });
});

describe("S5 The duplicate — hard gates beat arithmetic", () => {
  it("rejects at CRITICAL risk no matter how good the other engines look", () => {
    const r = computeTrustIndex({ ...FULL_HOUSE, flags: ["DUPLICATE_SUBMISSION"] }, cfg());
    expect(r.verdict).toBe("REJECT");
    expect(r.risk).toBe("CRITICAL");
    expect(r.recommendation).toBe("REJECT");
    const dup = r.breakdown.find(b => b.key === "duplicate")!;
    expect(dup.effectiveScore).toBe(0);
    expect(dup.flagOverride).toBe("DUPLICATE_SUBMISSION");
  });
});

describe("S5b The ChatGPT photo — AI-generated image is a hard gate, not a nudge", () => {
  it("rejects at CRITICAL risk even when every other engine scores perfectly", () => {
    const r = computeTrustIndex({ ...FULL_HOUSE, flags: ["AI_GENERATED_IMAGE"] }, cfg());
    expect(r.verdict).toBe("REJECT");
    expect(r.risk).toBe("CRITICAL");
    expect(r.recommendation).toBe("REJECT");
    const image = r.breakdown.find(b => b.key === "image")!;
    expect(image.effectiveScore).toBe(5);
    expect(image.flagOverride).toBe("AI_GENERATED_IMAGE");
  });
});

describe("S6 Rushed & silent — the consistency engine sees the pattern", () => {
  it("fires R1 and lands on REJECT via the AUDIO_EMPTY hard gate", () => {
    const r = computeTrustIndex(
      {
        checks: fullChecks({ gps: 90, duration: 50, image: 88 }),
        gps: { lat: 6.5, lon: 3.3 }, duration_mins: 2,
        image_url: "https://x/img.jpg",
        flags: ["DURATION_TOO_SHORT", "AUDIO_EMPTY"],
      },
      cfg()
    );
    expect(r.consistency.map(c => c.rule)).toContain("R1");
    expect(r.verdict).toBe("REJECT");
    expect(r.risk).toBe("CRITICAL");
    const dur = r.breakdown.find(b => b.key === "duration")!;
    expect(dur.effectiveScore).toBe(10); // min(50, override 10) — E7
  });
});

describe("S7 Legacy row — UNVERIFIED passthrough, never mass-zeroed", () => {
  it("passes the backend score through at low confidence", () => {
    const r = computeTrustIndex({ overall_score: 77 }, cfg());
    expect(r.status).toBe("UNVERIFIED");
    expect(r.trustIndex).toBe(77);
    expect(r.confidence).toBeCloseTo(0.3, 5);
  });
  it("E11: nothing at all evaluates to 0", () => {
    const r = computeTrustIndex({}, cfg());
    expect(r.status).toBe("UNVERIFIED");
    expect(r.trustIndex).toBe(0);
  });
});

describe("S8 The gray zone — sub-threshold is REVIEW, never auto-REJECT", () => {
  it("classifies 50–69 as HIGH risk / FLAG", () => {
    const r = computeTrustIndex(
      { ...FULL_HOUSE, checks: fullChecks({ gps: 60, duration: 60, image: 60, audio: 60, duplicate: 60, text_ai: 60 }) },
      cfg({ passScoreThreshold: 70 }) // pin: gray zone is relative to the threshold
    );
    expect(r.trustIndex).toBe(60);
    expect(r.verdict).toBe("FLAG");
    expect(r.risk).toBe("HIGH");
    expect(r.recommendation).toBe("REVIEW");
  });
});

describe("E6 GPS derived from accuracy — confidence shrinkage", () => {
  it("shrinks the derived score toward the neutral prior", () => {
    expect(gpsScoreFromAccuracy(10)).toBe(60);
    const r = computeTrustIndex(
      { checks: {}, gps: { lat: 6.5, lon: 3.3, accuracy_m: 10 }, flags: [] },
      cfg({ requirements: { duration: "OPTIONAL", image: "OPTIONAL" } as any })
    );
    const gps = r.breakdown.find(b => b.key === "gps")!;
    expect(gps.rawScore).toBe(60);
    expect(gps.confidence).toBeCloseTo(0.7, 5);
    expect(gps.shrunkScore).toBeCloseTo(0.7 * 60 + 0.3 * 50, 5); // 57
    expect(r.trustIndex).toBe(57);
  });
});

describe("E7/E8 Flag override semantics", () => {
  it("min(raw, override): flags never raise a score", () => {
    const r = computeTrustIndex(
      { ...FULL_HOUSE, checks: fullChecks({ ...Object.fromEntries(Object.entries({ gps: 90, duration: 85, image: 15, audio: 92, duplicate: 95, text_ai: 90 })) }), flags: ["IMAGE_QUALITY_ISSUE"] },
      cfg()
    );
    const img = r.breakdown.find(b => b.key === "image")!;
    expect(img.effectiveScore).toBe(15); // min(15, 25) — the raw was already worse
  });
  it("worst flag wins per engine", () => {
    const r = computeTrustIndex({ ...FULL_HOUSE, flags: ["LOW_GPS_ACCURACY", "NO_GPS"] }, cfg());
    const gps = r.breakdown.find(b => b.key === "gps")!;
    expect(gps.flagOverride).toBe("NO_GPS");
    expect(gps.effectiveScore).toBe(0);
  });
});

describe("E14 Single-engine project", () => {
  it("one enabled engine carries the whole index", () => {
    const r = computeTrustIndex(
      { checks: fullChecks({ gps: 90 }), gps: { lat: 6.5, lon: 3.3 }, flags: [] },
      cfg({ requirements: { duration: "DISABLED", image: "DISABLED", audio: "DISABLED", duplicate: "DISABLED", text_ai: "DISABLED" } as any })
    );
    expect(r.trustIndex).toBe(93); // 90 + R5
    expect(r.verdict).toBe("PASS");
  });
});

describe("E15 Gating", () => {
  it("skips downstream engines on upstream reject and marks them gated", () => {
    const r = computeTrustIndex(
      { ...FULL_HOUSE, flags: ["GPS_PARSE_ERROR"] },
      cfg({ gating: { gps_reject_skips: ["image", "audio"], duration_reject_skips: [], duplicate_reject_skips: [] } })
    );
    const img = r.breakdown.find(b => b.key === "image")!;
    const aud = r.breakdown.find(b => b.key === "audio")!;
    expect(img.gated).toBe(true);
    expect(aud.gated).toBe(true);
    expect(img.included).toBe(false);
  });
});

describe("E17 Derived analyses never zero an enumerator", () => {
  it("a REQUIRED duplicate check that didn't run is excluded, not zeroed", () => {
    const r = computeTrustIndex(
      { ...FULL_HOUSE, checks: fullChecks({ gps: 90, duration: 85, image: 88, audio: 92 }) },
      cfg({ requirements: { duplicate: "REQUIRED" } as any })
    );
    const dup = r.breakdown.find(b => b.key === "duplicate")!;
    expect(dup.included).toBe(false);
    expect(dup.effectiveScore).toBeNull();
    expect(dup.notes.join(" ")).toMatch(/platform responsibility/);
  });
});

describe("E18 AUDIO_EMPTY under HARD_REQUIRED audio", () => {
  it("empty audio counts as absent → INELIGIBLE", () => {
    const r = computeTrustIndex(
      { ...FULL_HOUSE, flags: ["AUDIO_EMPTY"] },
      cfg({ requirements: { audio: "HARD_REQUIRED" } as any })
    );
    expect(r.status).toBe("INELIGIBLE");
    expect(r.trustIndex).toBe(0);
  });
});

describe("E24 Consistency clamp", () => {
  it("total consistency delta never exceeds [−10, +3]", () => {
    // R1 (short+empty audio) + R2 (duplicate+short) + R4 (AI-suspect, no audio) = −15 → clamped −10
    const r = computeTrustIndex(
      {
        checks: fullChecks({ gps: 90, duration: 50, image: 88, text_ai: 30 }),
        gps: { lat: 6.5, lon: 3.3 }, duration_mins: 2,
        image_url: "https://x/img.jpg",
        flags: ["DURATION_TOO_SHORT", "AUDIO_EMPTY", "DUPLICATE_IMAGE"],
      },
      cfg()
    );
    const total = r.consistency.reduce((s, c) => s + c.delta, 0);
    expect(total).toBeLessThanOrEqual(-10);
    expect(r.audit.join(" ")).toMatch(/clamped/);
  });
});

describe("§6.7 Assigned-zone verification (haversine)", () => {
  it("haversine is accurate: Lagos→Ibadan ≈ 128 km", () => {
    const d = haversineMeters(6.5244, 3.3792, 7.3775, 3.947);
    expect(d).toBeGreaterThan(110000);
    expect(d).toBeLessThan(130000);
  });

  it("within the radius: presence corroborated, no penalty", () => {
    const r = computeTrustIndex(FULL_HOUSE,
      cfg({ assignedZone: { lat: 6.5001, lon: 3.3001, radiusM: 250, label: "Akoka PHC" } }));
    expect(r.zoneCheck).not.toBeNull();
    expect(r.zoneCheck!.withinZone).toBe(true);
    expect(r.zoneCheck!.distanceM).toBeLessThan(250);
    expect(r.verdict).toBe("PASS");
    expect(r.audit.join(" ")).toMatch(/Presence corroborated/);
  });

  it("outside the radius: OUTSIDE_ASSIGNED_ZONE hard gate → REJECT", () => {
    const r = computeTrustIndex(FULL_HOUSE,
      cfg({ assignedZone: { lat: 6.6, lon: 3.3, radiusM: 250, label: "Akoka PHC" } }));
    expect(r.zoneCheck!.withinZone).toBe(false);
    expect(r.zoneCheck!.distanceM).toBeGreaterThan(10000);
    expect(r.verdict).toBe("REJECT");
    expect(r.risk).toBe("CRITICAL");
    const gps = r.breakdown.find(b => b.key === "gps")!;
    expect(gps.flagOverride).toBe("OUTSIDE_ASSIGNED_ZONE");
    expect(gps.effectiveScore).toBe(15);
  });

  it("no zone configured: verification skipped, coordinates simply reported", () => {
    const r = computeTrustIndex(FULL_HOUSE, cfg());
    expect(r.zoneCheck).toBeNull();
    expect(r.trustIndex).toBe(92); // unchanged from S1
  });
});

describe("Explainability contract (§10)", () => {
  it("every scored submission carries a reconstructable audit trail", () => {
    const r = computeTrustIndex(FULL_HOUSE, cfg());
    expect(r.audit.length).toBeGreaterThanOrEqual(7); // 6 engines + synthesis line
    expect(r.audit.join("\n")).toMatch(/Trust Index = /);
    expect(r.delta).toBe(r.trustIndex - 89);
  });

  it("determinism: same input, same output", () => {
    const a = computeTrustIndex(FULL_HOUSE, cfg());
    const b = computeTrustIndex(FULL_HOUSE, cfg());
    expect(a).toEqual(b);
  });
});
