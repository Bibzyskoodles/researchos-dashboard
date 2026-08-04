/**
 * Assigned zones as shapes, not only circles — the dashboard half.
 *
 * This is a deliberate, line-for-line mirror of `fieldscore-backend`'s
 * `zone_geometry.py`. Same Earth radius, same projection, same clamping, same
 * ray-casting rule, same order of operations. Read them side by side; they are
 * meant to look the same.
 *
 * Duplication is normally the thing to avoid, and CLAUDE.md says so. It is the
 * right call here for one reason: the server issues the verdict and the
 * dashboard has to explain it, and the two running different arithmetic over
 * the same coordinates is a defect this platform has already shipped — the
 * dashboard once scored a submission out-of-zone as a flat 15 while the server
 * scored it proportionally, so the screen and the record disagreed about the
 * same submission. Sharing code across a Python service and a React bundle is
 * not available; sharing the *formula*, with tests asserting identical numbers
 * on both sides, is.
 *
 * A zone is a buffered geometry:
 *
 *   circle    a pin              tolerance = radiusM
 *   corridor  a road centreline  tolerance = widthM / 2 — half either side
 *   polygon   an area boundary   tolerance = bufferM — GPS drift allowance
 *
 * and produces two numbers that must not be confused:
 *
 *   distanceM   how far from the zone's core geometry — zero inside a
 *               polygon, distance to the pin for a circle. Describes where
 *               someone was.
 *   overshootM  how far past the tolerance — zero whenever inside. The only
 *               number a verdict may be built on, because it is the only one
 *               that means the same thing for every shape and every size.
 *
 * Corridor and polygon maths runs on a local flat projection centred on the
 * point being judged, not on spherical trigonometry. Within tens of kilometres
 * the difference is under two metres — far below GPS's own accuracy — and the
 * arithmetic is simple enough that both engines provably agree. See
 * zone_geometry.py's docstring for the full reasoning.
 */

// Identical to zone_geometry.EARTH_RADIUS_M and geocoder.haversine_distance_m.
export const EARTH_RADIUS_M = 6371000;

export type ZoneShape = "circle" | "corridor" | "polygon";

export interface ZonePoint {
  lat: number;
  lon: number;
}

/** What a configured zone looks like, in any of its three shapes. */
export interface ZoneSpec {
  shape?: ZoneShape;
  /** Circle only — the pin. */
  lat?: number | null;
  lon?: number | null;
  radiusM?: number;
  /** Corridor and polygon — an ordered list of coordinates. */
  points?: ZonePoint[];
  /** Corridor — total width across the road, halved to get the tolerance. */
  widthM?: number;
  /** Polygon — GPS drift allowance outside the boundary. May be 0. */
  bufferM?: number;
  label?: string;
}

export interface NormalizedZone {
  shape: ZoneShape;
  points: ZonePoint[];
  toleranceM: number;
  label: string;
}

export interface ZoneEvaluation {
  shape: ZoneShape;
  label: string;
  pointCount: number;
  distanceM: number;
  toleranceM: number;
  overshootM: number;
  inZone: boolean;
}

// A boundary traced off a GIS export can carry thousands of vertices. Over the
// cap the zone is refused rather than truncated: silently dropping vertices
// enforces a boundary nobody drew.
export const MAX_POINTS = 1000;

// 60 m covers 30 m either side of the centreline — a wide urban road plus its
// pavements and frontages, which is where enumeration on a street happens.
export const DEFAULT_CORRIDOR_WIDTH_M = 60;

const round1 = (n: number) => Math.round(n * 10) / 10;

function validCoord(lat: number | null | undefined, lon: number | null | undefined): boolean {
  return (
    lat != null && lon != null &&
    Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180
  );
}

/**
 * Coordinates as a person actually supplies them: one "lat, lon" per line,
 * pasted out of Google Maps. The settings page is a textarea because that is
 * what a client can produce without GIS software.
 *
 * Anything unreadable is dropped rather than guessed at. Note especially that
 * a blank or half-parsed line must never become 0,0 — that point is in the
 * Gulf of Guinea and would put every African submission thousands of
 * kilometres "outside" its zone.
 */
export function parsePointsText(text: string): ZonePoint[] {
  const out: ZonePoint[] = [];
  for (const rawLine of (text || "").replace(/;/g, "\n").split("\n")) {
    const parts = rawLine.replace(/\t/g, ",").split(",").map(p => p.trim()).filter(Boolean);
    if (parts.length < 2) continue;
    const lat = Number(parts[0]);
    const lon = Number(parts[1]);
    if (validCoord(lat, lon)) out.push({ lat, lon });
  }
  return out;
}

/** The inverse, for showing a stored zone back in the editor. */
export function formatPointsText(points: ZonePoint[]): string {
  return (points || []).map(p => `${p.lat}, ${p.lon}`).join("\n");
}

/**
 * Canonicalise any configured zone, or return null when it cannot be verified
 * against.
 *
 * Null means "this submission has no zone to be judged by" — never "reject
 * it". A configuration error belongs to whoever set the project up, and an
 * enumerator must not be marked as fraudulent for it.
 */
export function normalizeZone(zone: ZoneSpec | null | undefined): NormalizedZone | null {
  if (!zone) return null;
  const shape: ZoneShape =
    zone.shape === "corridor" || zone.shape === "polygon" ? zone.shape : "circle";
  const label = (zone.label || "").trim();

  if (shape === "circle") {
    if (!validCoord(zone.lat, zone.lon)) return null;
    const radius = Number(zone.radiusM);
    if (!Number.isFinite(radius) || radius < 0) return null;
    return {
      shape: "circle",
      points: [{ lat: zone.lat as number, lon: zone.lon as number }],
      toleranceM: radius,
      label,
    };
  }

  let points = (zone.points || []).filter(p => p && validCoord(p.lat, p.lon));
  if (points.length > MAX_POINTS) return null;

  if (shape === "corridor") {
    if (points.length === 0) return null;
    const width = Number(zone.widthM);
    const effective = Number.isFinite(width) && width > 0 ? width : DEFAULT_CORRIDOR_WIDTH_M;
    // The client thinks in total corridor width; the geometry needs the
    // distance either side of the centreline. Halved once, here, so no call
    // site has to remember which of the two it is holding.
    return { shape: "corridor", points, toleranceM: effective / 2, label };
  }

  // A ring given closed (last point repeating the first) and one given open
  // describe the same area. GIS exports close theirs; a hand-typed list does
  // not. Normalise to open so the edge loop below has no zero-length segment.
  if (
    points.length >= 2 &&
    points[0].lat === points[points.length - 1].lat &&
    points[0].lon === points[points.length - 1].lon
  ) {
    points = points.slice(0, -1);
  }
  if (points.length < 3) return null;
  const buffer = Number(zone.bufferM);
  return {
    shape: "polygon",
    points,
    toleranceM: Number.isFinite(buffer) && buffer >= 0 ? buffer : 0,
    label,
  };
}

/** Great-circle distance in metres. Identical to the backend's copy. */
export function haversineM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const phi1 = toRad(lat1);
  const phi2 = toRad(lat2);
  const dPhi = toRad(lat2 - lat1);
  const dLambda = toRad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Local flat coordinates in metres, relative to (lat0, lon0). East is +x,
 * north is +y. Longitude is scaled by cos(lat0) so a degree of longitude is
 * worth what it is worth at this latitude.
 */
function project(lat: number, lon: number, lat0: number, lon0: number): [number, number] {
  let dLon = lon - lon0;
  // A zone straddling the antimeridian would otherwise appear to wrap most of
  // the way round the planet.
  if (dLon > 180) dLon -= 360;
  else if (dLon < -180) dLon += 360;
  const toRad = (d: number) => (d * Math.PI) / 180;
  return [
    toRad(dLon) * Math.cos(toRad(lat0)) * EARTH_RADIUS_M,
    toRad(lat - lat0) * EARTH_RADIUS_M,
  ];
}

/** Shortest distance from a point to a line *segment*, not an infinite line. */
function pointSegmentDistance(
  px: number, py: number, ax: number, ay: number, bx: number, by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  if (dx === 0 && dy === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
  // Clamping is what makes this a segment: past either end the nearest point
  // is that endpoint. Without it a road would run to the horizon both ways.
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Ray casting, with the query point already projected to the origin. */
function originInRing(ring: Array<[number, number]>): boolean {
  let inside = false;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = ring[i];
    const [bx, by] = ring[(i + 1) % n];
    // The asymmetric comparison is what stops a vertex sitting exactly on the
    // ray from being counted twice.
    if ((ay > 0) !== (by > 0)) {
      const xCross = ax + ((0 - ay) * (bx - ax)) / (by - ay);
      if (xCross > 0) inside = !inside;
    }
  }
  return inside;
}

/**
 * Distance in metres from a coordinate to a normalised zone's core geometry.
 * Zero inside a polygon. For a circle this is the distance to the pin — the
 * tolerance is not subtracted here; `evaluateZone` does that.
 */
export function distanceToZoneM(lat: number, lon: number, zone: NormalizedZone): number {
  const { shape, points } = zone;
  if (shape === "circle" || points.length === 1) {
    return haversineM(lat, lon, points[0].lat, points[0].lon);
  }

  const projected = points.map(p => project(p.lat, p.lon, lat, lon));
  if (shape === "polygon" && originInRing(projected)) return 0;

  // Corridor: the open polyline's segments. Polygon: the same, plus the
  // closing edge, because the boundary is a loop.
  const closed = shape === "polygon";
  const count = projected.length;
  const last = closed ? count : count - 1;
  let best = Infinity;
  for (let i = 0; i < last; i++) {
    const [ax, ay] = projected[i];
    const [bx, by] = projected[(i + 1) % count];
    const d = pointSegmentDistance(0, 0, ax, ay, bx, by);
    if (d < best) best = d;
  }
  return best;
}

/**
 * The single question every caller asks: was this submission where it was
 * supposed to be, and if not, by how much?
 *
 * Returns null when the zone is unusable, so the caller can say it could not
 * verify rather than inventing a verdict.
 */
export function evaluateZone(
  lat: number, lon: number, zone: ZoneSpec | null | undefined,
): ZoneEvaluation | null {
  const norm = normalizeZone(zone);
  if (!norm) return null;
  if (!validCoord(lat, lon)) return null;

  const distanceM = distanceToZoneM(lat, lon, norm);
  const toleranceM = norm.toleranceM;
  const inZone = distanceM <= toleranceM;

  return {
    shape: norm.shape,
    label: norm.label,
    pointCount: norm.points.length,
    distanceM: round1(distanceM),
    toleranceM: round1(toleranceM),
    overshootM: inZone ? 0 : round1(distanceM - toleranceM),
    inZone,
  };
}

/**
 * How the zone is named in a finding, in the vocabulary of its shape.
 * "250 m from the pin" and "outside the boundary" are different claims, and a
 * supervisor justifying a rejection is entitled to the one that matches the
 * zone their client actually drew.
 */
export function describeZone(shape: ZoneShape): string {
  if (shape === "corridor") return "route";
  if (shape === "polygon") return "area";
  return "assigned point";
}

/** "412 m" rather than "0.41 km" — sub-kilometre overshoots are the common case. */
export function readableDistance(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(2)} km`;
}
