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

  it("far outside the radius: still REJECT, and the score reflects the distance", () => {
    // >10 km out, which is beyond the 2 km reject boundary — Bible §6.7.
    const r = computeTrustIndex(FULL_HOUSE,
      cfg({ assignedZone: { lat: 6.6, lon: 3.3, radiusM: 250, label: "Akoka PHC" } }));
    expect(r.zoneCheck!.withinZone).toBe(false);
    expect(r.zoneCheck!.distanceM).toBeGreaterThan(10000);
    expect(r.verdict).toBe("REJECT");
    expect(r.risk).toBe("CRITICAL");
    const gps = r.breakdown.find(b => b.key === "gps")!;
    expect(gps.flagOverride).toBe("OUTSIDE_ASSIGNED_ZONE");
    // Was a flat 15 regardless of distance. Now max(0, 100 - km*10), which at
    // this range is 0 — the point being that it is no longer the same number a
    // submission 673 m out would get.
    expect(gps.effectiveScore).toBe(0);
  });

  it("just outside the radius: FLAG for review, not REJECT — Bible §6.7", () => {
    // The live case that prompted the change: 673 m from an assigned pin at the
    // other end of the same road. Previously an unconditional hard gate, which
    // made it indistinguishable from a submission in another state.
    const near = { ...FULL_HOUSE, gps: { lat: 6.5, lon: 3.3, accuracy_m: 8 } };
    const r = computeTrustIndex(near as any,
      cfg({ assignedZone: { lat: 6.5054, lon: 3.3, radiusM: 250, label: "Kusenla Road" } }));
    expect(r.zoneCheck!.withinZone).toBe(false);
    expect(r.zoneCheck!.distanceM).toBeGreaterThan(250);
    expect(r.zoneCheck!.distanceM).toBeLessThan(2000);
    expect(r.verdict).toBe("FLAG");
    const gps = r.breakdown.find(b => b.key === "gps")!;
    // This used to assert > 80. Proportional was right; starting the curve at
    // 100 was not — being outside your assigned area cost almost nothing, so
    // the panel showed a breach flag beside full GPS marks. A confirmed breach
    // is now capped, and the verdict staying FLAG is what this scenario is
    // actually about: 673 m is not 50 km.
    expect(gps.effectiveScore).toBeLessThanOrEqual(50);
    expect(gps.effectiveScore).toBeGreaterThan(0);
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

// ─── Near misses are not violations, and unmeasured is not wrong ─────────────
// Both of these came off a real submission screen: GPS showed "Outside
// Assigned Zone" and 6/6 points in the same panel, and duration showed 2/10
// for timestamps the form had never been built to collect.

describe("a breach is judged by how far outside it was", () => {
  const zoned = (lat: number, lon: number) => computeTrustIndex(
    { ...FULL_HOUSE, gps: { lat, lon, accuracy_m: 8 } },
    cfg({
      assignedZone: { lat: 6.441140, lon: 3.490772, radiusM: 250, label: "Kusenla Road" },
      zoneRejectKm: 2,
    }),
  );

  it("does not call a 300 m overshoot a critical violation", () => {
    // ~547 m from the pin, 250 m radius — the case on screen. The engine
    // scores it 98/100; the banner used to call it critical regardless, so the
    // page contradicted itself in adjacent lines.
    const r = zoned(6.44606, 3.490772);
    expect(r.zoneCheck).not.toBeNull();
    expect(r.zoneCheck!.withinZone).toBe(false);
    expect(r.zoneCheck!.isCriticalBreach).toBe(false);
    expect(r.verdict).not.toBe("REJECT");
  });

  it("still calls a breach past the reject boundary critical", () => {
    // ~5 km out, well past the 2 km reject boundary.
    const r = zoned(6.486, 3.490772);
    expect(r.zoneCheck!.isCriticalBreach).toBe(true);
    expect(r.verdict).toBe("REJECT");
  });

  it("never calls an in-zone submission a breach", () => {
    const r = zoned(6.441140, 3.490772);
    expect(r.zoneCheck!.withinZone).toBe(true);
    expect(r.zoneCheck!.isCriticalBreach).toBe(false);
  });

  it("scores the near miss far above the far one", () => {
    // Distance decides. If these came out equal the whole zone model would be
    // back to treating 300 m and 5 km the same.
    expect(zoned(6.44606, 3.490772).trustIndex)
      .toBeGreaterThan(zoned(6.486, 3.490772).trustIndex);
  });
});

describe("duration that could not be measured is not scored as a failure", () => {
  it("does not override the server's score for DURATION_NOT_CALCULABLE", () => {
    // The server scores this 50 — "not measurable" — and the dashboard used to
    // force it to 20. No generated form collected start/end until the XLSForm
    // builders started emitting the metadata, so this flag was on nearly every
    // submission and quietly cost each one 8 of its 10 duration points.
    const withFlag = computeTrustIndex(
      { ...FULL_HOUSE, duration_mins: null, flags: ["DURATION_NOT_CALCULABLE"] },
      cfg(),
    );
    const durationRow = withFlag.breakdown.find(e => e.key === "duration");
    expect(durationRow).toBeDefined();
    expect(durationRow!.effectiveScore).not.toBe(20);
  });

  it("still penalises durations that were measured and were wrong", () => {
    // The forgiving path must not become a way to escape the duration check.
    const tooShort = computeTrustIndex(
      { ...FULL_HOUSE, duration_mins: 1, flags: ["DURATION_TOO_SHORT"] }, cfg());
    const row = tooShort.breakdown.find(e => e.key === "duration");
    expect(row!.effectiveScore).toBeLessThanOrEqual(10);
  });
});

// ─── Outside is outside ──────────────────────────────────────────────────────
// The values below are produced by scorer.py's zone_severity for the same
// inputs. The two implementations score the same submission, so a divergence
// here is the dashboard disagreeing with the engine — the failure this whole
// file exists to prevent.

describe("a confirmed breach cannot score like a clean submission", () => {
  const atDistance = (overshootM: number, accuracyM: number) => {
    // 250 m radius; place the point overshootM beyond it, due north.
    const metresPerDegLat = 111_320;
    const lat = 6.441140 + (250 + overshootM) / metresPerDegLat;
    return computeTrustIndex(
      { ...FULL_HOUSE, gps: { lat, lon: 3.490772, accuracy_m: accuracyM } },
      cfg({
        assignedZone: { lat: 6.441140, lon: 3.490772, radiusM: 250, label: "Kusenla Road" },
        zoneRejectKm: 2,
      }),
    );
  };
  const gpsScore = (r: ReturnType<typeof computeTrustIndex>) =>
    r.breakdown.find(e => e.key === "gps")!.effectiveScore;

  it("caps a 297 m breach on a 10 m fix at half marks", () => {
    // The submission from the screenshot: it scored 98 and rendered 6/6.
    expect(gpsScore(atDistance(297, 10))).toBeLessThanOrEqual(50);
  });

  it("matches scorer.py exactly at 297 m on a 10 m fix", () => {
    // python: zone_severity(0.297, 2.0, 10) -> ("FLAG", 43)
    expect(gpsScore(atDistance(297, 10))).toBe(43);
  });

  it("matches scorer.py exactly at 1 km on an 8 m fix", () => {
    // python: zone_severity(1.0, 2.0, 8) -> ("FLAG", 25)
    expect(gpsScore(atDistance(1000, 8))).toBe(25);
  });

  it("still lets distance separate a near breach from a far one", () => {
    expect(gpsScore(atDistance(297, 10))!).toBeGreaterThan(gpsScore(atDistance(1500, 10))!);
  });

  it("does not call a submission outside when the fix cannot place it", () => {
    // python: zone_severity(0.297, 2.0, 300) -> ("FLAG", 70)
    expect(gpsScore(atDistance(297, 300))).toBe(70);
  });

  it("judges a precise fix more harshly than a vague one at the same distance", () => {
    expect(gpsScore(atDistance(297, 10))!).toBeLessThan(gpsScore(atDistance(297, 300))!);
  });
});
