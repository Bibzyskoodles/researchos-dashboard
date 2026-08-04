/**
 * The dashboard and the server must agree about where someone stood.
 *
 * `zoneGeometry.ts` is a deliberate duplicate of `fieldscore-backend`'s
 * `zone_geometry.py`, and a duplicate is only safe while it is provably
 * identical. Every number under "AGREEMENT FIXTURES" is copied verbatim from
 * `fieldscore-backend/test_zone_shapes.py`. If a change makes one side move,
 * this suite fails on that side and the two are never quietly out of step.
 *
 * That is not a hypothetical. The dashboard used to score an out-of-zone
 * submission as a flat 15 while the server scored it proportionally, so the
 * screen and the record disagreed about the same submission — and the number
 * the founder was looking at was the wrong one.
 *
 * The rest of the suite covers what the geometry is *for*: a road is a line
 * and a ward is an area, and neither is a circle.
 */

import {
  distanceToZoneM,
  evaluateZone,
  formatPointsText,
  haversineM,
  MAX_POINTS,
  normalizeZone,
  parsePointsText,
  readableDistance,
  type ZoneSpec,
} from "./zoneGeometry";
import { computeTrustIndex } from "./trustEngine";
import { DEFAULT_ENGINE_CONFIG } from "./engineConfig";

// ─── AGREEMENT FIXTURES ──────────────────────────────────────────────────────
// Mirrored verbatim in fieldscore-backend/test_zone_shapes.py.
// Change one, change both.

const ROAD: ZoneSpec = {
  shape: "corridor",
  label: "Kusenla Road",
  widthM: 60,
  points: [
    { lat: 6.4400, lon: 3.4700 },
    { lat: 6.4450, lon: 3.4780 },
    { lat: 6.4480, lon: 3.4860 },
  ],
};

const WARD: ZoneSpec = {
  shape: "polygon",
  label: "Ward 7",
  bufferM: 25,
  points: [
    { lat: 6.4400, lon: 3.4700 },
    { lat: 6.4400, lon: 3.4800 },
    { lat: 6.4500, lon: 3.4800 },
    { lat: 6.4500, lon: 3.4700 },
  ],
};

const PHC: ZoneSpec = { label: "Akoka PHC", lat: 6.4400, lon: 3.4700, radiusM: 250 };

const FIXTURES: Array<[string, ZoneSpec, number, number, number, number, boolean]> = [
  ["corridor · on the road",            ROAD, 6.44250, 3.47400,     0.0,     0.0, true],
  ["corridor · far end of the road",    ROAD, 6.44800, 3.48600,     0.0,     0.0, true],
  ["corridor · 21 m off centreline",    ROAD, 6.44272, 3.47400,    20.7,     0.0, true],
  ["corridor · a street over",          ROAD, 6.44400, 3.47400,   141.2,   111.2, false],
  ["corridor · the next town",          ROAD, 6.60000, 3.35000, 22186.0, 22156.0, false],
  ["polygon · inside the ward",         WARD, 6.44500, 3.47500,     0.0,     0.0, true],
  ["polygon · just inside an edge",     WARD, 6.44010, 3.47500,     0.0,     0.0, true],
  ["polygon · 24 m out, inside buffer", WARD, 6.44982, 3.48022,    24.3,     0.0, true],
  ["polygon · 334 m outside",           WARD, 6.45300, 3.47500,   333.6,   308.6, false],
  ["polygon · 4.4 km outside",          WARD, 6.49000, 3.47500,  4447.8,  4422.8, false],
  ["circle · inside the radius",        PHC,  6.44050, 3.47020,    59.8,     0.0, true],
  ["circle · the live 673 m case",      PHC,  6.44605, 3.47000,   672.7,   422.7, false],
];

describe("agreement with the backend, to the metre", () => {
  it.each(FIXTURES)(
    "%s",
    (_label, zone, lat, lon, expectedDistance, expectedOvershoot, expectedInZone) => {
      const ev = evaluateZone(lat, lon, zone);
      expect(ev).not.toBeNull();
      // 0.15 m of slack absorbs the last decimal place: Python's round() is
      // banker's rounding and JavaScript's is half-up, and they can differ by
      // 0.1 m on an exact boundary. Anything larger than that is a real
      // divergence in the geometry, not a rounding artefact.
      expect(ev!.distanceM).toBeCloseTo(expectedDistance, 0);
      expect(Math.abs(ev!.distanceM - expectedDistance)).toBeLessThanOrEqual(0.15);
      expect(Math.abs(ev!.overshootM - expectedOvershoot)).toBeLessThanOrEqual(0.15);
      expect(ev!.inZone).toBe(expectedInZone);
    },
  );
});

describe("a road is a line, not a circle", () => {
  it("covers both ends of a 1.2 km road", () => {
    expect(evaluateZone(6.4400, 3.4700, ROAD)!.inZone).toBe(true);
    expect(evaluateZone(6.4480, 3.4860, ROAD)!.inZone).toBe(true);
  });

  it("rejects a submission 400 m off the road that a covering circle would accept", () => {
    // The circle a project would have had to draw to reach both ends: centred
    // on the midpoint, radius = half the road's length.
    const midLat = 6.4440, midLon = 3.4780;
    const halfLength = haversineM(midLat, midLon, 6.4400, 3.4700);
    const coveringCircle: ZoneSpec = { lat: midLat, lon: midLon, radiusM: halfLength };

    const offRoadLat = 6.4476, offRoadLon = 3.4780;
    // If this premise ever stops holding, the feature's justification is gone —
    // so assert it rather than assume it.
    expect(evaluateZone(offRoadLat, offRoadLon, coveringCircle)!.inZone).toBe(true);

    const corridor = evaluateZone(offRoadLat, offRoadLon, ROAD)!;
    expect(corridor.inZone).toBe(false);
    expect(corridor.overshootM).toBeGreaterThan(200);
  });

  it("does not treat the road as running to the horizon past its last point", () => {
    // A point 1 km beyond the road's end is 1 km away, not on an infinite line
    // through it. Missing the segment clamp is the classic version of this bug.
    const beyond = evaluateZone(6.4520, 3.4960, ROAD)!;
    expect(beyond.inZone).toBe(false);
    expect(beyond.distanceM).toBeGreaterThan(1000);
  });
});

describe("an area is an area", () => {
  it("is inside anywhere within the boundary, not just near its centre", () => {
    for (const [lat, lon] of [[6.4405, 3.4705], [6.4495, 3.4795], [6.4450, 3.4750]]) {
      expect(evaluateZone(lat, lon, WARD)!.inZone).toBe(true);
      expect(evaluateZone(lat, lon, WARD)!.distanceM).toBe(0);
    }
  });

  it("treats a closed ring and an open one as the same area", () => {
    const closed: ZoneSpec = { ...WARD, points: [...WARD.points!, WARD.points![0]] };
    expect(distanceToZoneM(6.4530, 3.4750, normalizeZone(closed)!))
      .toBe(distanceToZoneM(6.4530, 3.4750, normalizeZone(WARD)!));
  });

  it("allows a buffer for GPS drift just outside the line", () => {
    const noBuffer: ZoneSpec = { ...WARD, bufferM: 0 };
    const point: [number, number] = [6.44982, 3.48022];   // ~24 m outside
    expect(evaluateZone(point[0], point[1], WARD)!.inZone).toBe(true);
    expect(evaluateZone(point[0], point[1], noBuffer)!.inZone).toBe(false);
  });
});

describe("overshoot is the one comparable number", () => {
  it("is zero inside every shape and positive outside every shape", () => {
    for (const [, zone, lat, lon, , , inZone] of FIXTURES) {
      const ev = evaluateZone(lat, lon, zone)!;
      if (inZone) expect(ev.overshootM).toBe(0);
      else expect(ev.overshootM).toBeGreaterThan(0);
    }
  });

  it("measures a large zone from its edge, not from its pin", () => {
    // "This study operates within 5 km of Ikeja", with a submission 100 m past
    // the boundary. Measured from the pin that is 5.0 km; measured from the
    // edge it is what it is. The submission has not moved — only the question.
    const wide: ZoneSpec = { label: "Ikeja study area", lat: 6.6018, lon: 3.3515, radiusM: 5000 };
    const ev = evaluateZone(6.6467, 3.3515, wide)!;
    expect(ev.distanceM).toBeGreaterThan(4900);
    expect(ev.overshootM).toBeLessThan(250);
  });
});

describe("a zone that cannot be read accuses nobody", () => {
  const unusable: Array<[string, ZoneSpec | null]> = [
    ["a corridor with no points", { shape: "corridor", points: [] }],
    ["a polygon with two corners", { shape: "polygon", points: [{ lat: 6.44, lon: 3.47 }, { lat: 6.45, lon: 3.48 }] }],
    ["a circle with no radius", { lat: 6.44, lon: 3.47 }],
    ["a circle with no coordinates", { radiusM: 250 }],
    ["an empty zone", {}],
    ["nothing at all", null],
  ];

  it.each(unusable)("%s produces no verification", (_label, zone) => {
    expect(normalizeZone(zone)).toBeNull();
    expect(evaluateZone(6.44, 3.47, zone)).toBeNull();
  });

  it("refuses an oversized boundary rather than silently truncating it", () => {
    const tooMany = Array.from({ length: MAX_POINTS + 1 }, (_, i) => ({
      lat: 6 + i * 1e-5, lon: 3 + i * 1e-5,
    }));
    expect(normalizeZone({ shape: "polygon", points: tooMany })).toBeNull();
  });

  it("leaves the submission unflagged rather than rejecting it", () => {
    // The behaviour that matters: a configuration mistake belongs to whoever
    // set the project up, and an enumerator must not be marked as fraudulent
    // for it. This asserts the engine, not just the geometry.
    const result = computeTrustIndex(
      { overall_score: 82, verdict: "PASS", gps: { lat: 6.44, lon: 3.47, accuracy_m: 8 }, duration_mins: 25 },
      { ...DEFAULT_ENGINE_CONFIG, assignedZone: { lat: null, lon: null, radiusM: 250 }, zoneList: [{ shape: "polygon", points: [], radiusM: 0, lat: null, lon: null }] },
    );
    expect(result.zoneCheck).toBeNull();
    expect(result.audit.join(" ")).not.toContain("OUTSIDE");
  });
});

describe("coordinates as a person actually supplies them", () => {
  it("parses lines pasted out of Google Maps", () => {
    expect(parsePointsText("6.4400, 3.4700\n6.4450, 3.4780\n6.4480, 3.4860")).toEqual([
      { lat: 6.44, lon: 3.47 },
      { lat: 6.445, lon: 3.478 },
      { lat: 6.448, lon: 3.486 },
    ]);
  });

  it("ignores blank lines instead of reading them as 0, 0", () => {
    // 0,0 is in the Gulf of Guinea. A stray blank line becoming a vertex there
    // would drag a Lagos boundary several hundred kilometres out to sea.
    expect(parsePointsText("  6.44 , 3.47  \n\n\n  6.445,3.478  \n")).toEqual([
      { lat: 6.44, lon: 3.47 },
      { lat: 6.445, lon: 3.478 },
    ]);
    expect(parsePointsText("\n\n   \n")).toEqual([]);
  });

  it("drops a half-typed line rather than guessing the missing half", () => {
    expect(parsePointsText("6.44\n6.445, 3.478")).toEqual([{ lat: 6.445, lon: 3.478 }]);
  });

  it("rejects coordinates outside the possible range", () => {
    expect(parsePointsText("91, 3.47\n6.445, 3.478")).toEqual([{ lat: 6.445, lon: 3.478 }]);
  });

  it("round-trips through the editor unchanged", () => {
    const text = "6.44, 3.47\n6.445, 3.478";
    expect(formatPointsText(parsePointsText(text))).toBe(text);
  });
});

describe("the trust engine uses the shapes", () => {
  // A complete submission: every engine measured and healthy, so the zone is
  // the only thing that can move the verdict. Without the other checks the
  // submission fails on missing image and audio evidence whatever the zone
  // says, and a test asserting on the verdict would be asserting on that
  // instead — passing or failing for a reason that has nothing to do with
  // geometry.
  const healthy = {
    overall_score: 88,
    verdict: "PASS",
    duration_mins: 25,
    image_url: "https://example.test/photo.jpg",
    audio_url: "https://example.test/interview.m4a",
    checks: {
      duration: { score: 92, status: "PASS" },
      image: { score: 90, status: "PASS" },
      audio: { score: 87, status: "PASS" },
      duplicate: { score: 100, status: "PASS" },
      text_ai: { score: 95, status: "PASS" },
    },
  };
  const inRoad = { ...healthy, gps: { lat: 6.4425, lon: 3.4740, accuracy_m: 6 } };
  const offRoad = { ...healthy, gps: { lat: 6.4440, lon: 3.4740, accuracy_m: 6 } };
  const config = { ...DEFAULT_ENGINE_CONFIG, assignedZone: { lat: null, lon: null, radiusM: 250, ...ROAD } };

  it("passes an identical submission that is on the road", () => {
    // The control. If this failed, every assertion below would be measuring
    // something other than the zone.
    const r = computeTrustIndex(inRoad, config);
    expect(r.verdict).toBe("PASS");
  });

  it("corroborates presence along a corridor", () => {
    const r = computeTrustIndex(inRoad, config);
    expect(r.zoneCheck?.withinZone).toBe(true);
    expect(r.zoneCheck?.shape).toBe("corridor");
    expect(r.audit.join(" ")).toContain("Presence corroborated");
    expect(r.audit.join(" ")).not.toContain("OUTSIDE");
  });

  it("flags a submission off the corridor, and says how far off", () => {
    const r = computeTrustIndex(offRoad, config);
    expect(r.zoneCheck?.withinZone).toBe(false);
    expect(r.zoneCheck?.overshootM).toBeGreaterThan(100);
    expect(r.audit.join(" ")).toContain("OUTSIDE");
  });

  it("reviews a near miss rather than rejecting it", () => {
    // 111 m off the road is well inside the 2 km reject boundary, so a
    // supervisor judges it — the engine does not.
    const r = computeTrustIndex(offRoad, config);
    expect(r.verdict).not.toBe("REJECT");
    expect(r.recommendation).toBe("REVIEW");
  });

  it("rejects one far outside", () => {
    const r = computeTrustIndex(
      { ...offRoad, gps: { lat: 6.6, lon: 3.35, accuracy_m: 6 } },
      config,
    );
    expect(r.verdict).toBe("REJECT");
    expect(r.audit.join(" ")).toContain("reject boundary");
  });

  it("picks the nearest of many sites, whatever shape each one is", () => {
    const r = computeTrustIndex(inRoad, {
      ...DEFAULT_ENGINE_CONFIG,
      zoneList: [
        { lat: 9.0765, lon: 7.3986, radiusM: 250, label: "Abuja PHC" },
        { lat: null, lon: null, radiusM: 0, ...ROAD },
        { lat: -1.2921, lon: 36.8219, radiusM: 250, label: "Nairobi office" },
      ],
    });
    expect(r.zoneCheck?.matchedZoneIndex).toBe(1);
    expect(r.zoneCheck?.withinZone).toBe(true);
  });
});

describe("distances read the way a supervisor would say them", () => {
  it("uses metres below a kilometre", () => {
    // Sub-kilometre overshoots are now the common case — that is the point of
    // measuring from the boundary — and "0.41 km" throws away the precision
    // needed to tell GPS drift from a different street.
    expect(readableDistance(412)).toBe("412 m");
    expect(readableDistance(999)).toBe("999 m");
  });

  it("uses kilometres above one", () => {
    expect(readableDistance(4422.8)).toBe("4.42 km");
  });
});
