/**
 * "Kusenla Road" → a corridor with the road's actual route in it.
 *
 * Zones could already be roads and areas, but the coordinates had to be found
 * by hand and pasted a line at a time. OpenStreetMap holds the geometry, and
 * the conversion from an OSM result to a filled-in form is the part that can go
 * quietly wrong — so it lives in one pure function and is tested here.
 *
 * The rule this whole feature is built around: it offers candidates and picks
 * none. A wrong zone rejects honest enumerators and withholds their pay, and it
 * does so wearing the authority of something the platform chose.
 */

import { candidateToZone, type ZoneCandidate } from './ZonePlaceSearch';
import { evaluateZone } from '../../services/zoneGeometry';
import { parsePointsText } from '../../services/zoneGeometry';

const ROAD: ZoneCandidate = {
  label: 'Kusenla Road, Ikate Elegushi, Lekki, Lagos, Nigeria',
  shape: 'corridor',
  lat: 6.445,
  lon: 3.478,
  points: [
    { lat: 6.44, lon: 3.47 },
    { lat: 6.445, lon: 3.478 },
    { lat: 6.448, lon: 3.486 },
  ],
  width_m: 60,
  simplified: false,
  original_point_count: null,
  category: 'highway/residential',
};

const WARD: ZoneCandidate = {
  label: 'Eti-Osa, Lagos, Nigeria',
  shape: 'polygon',
  lat: 6.445,
  lon: 3.475,
  points: [
    { lat: 6.44, lon: 3.47 },
    { lat: 6.44, lon: 3.48 },
    { lat: 6.45, lon: 3.48 },
    { lat: 6.45, lon: 3.47 },
  ],
  buffer_m: 25,
  simplified: true,
  original_point_count: 4812,
  category: 'boundary/administrative',
};

const CLINIC: ZoneCandidate = {
  label: 'Akoka Primary Health Centre, Yaba, Lagos, Nigeria',
  shape: 'circle',
  lat: 6.5158,
  lon: 3.3898,
  points: [],
  radius_m: 180,
  simplified: false,
  original_point_count: null,
  category: 'amenity/clinic',
};

describe('a chosen match becomes a filled-in zone', () => {
  it('turns a road into a corridor the form can hold', () => {
    const z = candidateToZone(ROAD);
    expect(z.shape).toBe('corridor');
    expect(z.widthM).toBe(60);
    // The textarea is the form's storage for points, so the conversion has to
    // land in exactly the format parsePointsText reads back.
    expect(parsePointsText(z.pointsText)).toEqual(ROAD.points);
  });

  it('turns a boundary into an area', () => {
    const z = candidateToZone(WARD);
    expect(z.shape).toBe('polygon');
    expect(z.bufferM).toBe(25);
    expect(parsePointsText(z.pointsText)).toHaveLength(4);
  });

  it('turns a place into a point zone with its own suggested radius', () => {
    const z = candidateToZone(CLINIC);
    expect(z.shape).toBe('circle');
    expect(z.lat).toBe('6.5158');
    expect(z.radiusM).toBe(180);
  });

  it('names it something recognisable, not the whole OSM address', () => {
    // "Kusenla Road", not "Kusenla Road, Ikate Elegushi, Lekki, Lagos, Nigeria" —
    // this label ends up on every submission's finding text.
    expect(candidateToZone(ROAD).label).toBe('Kusenla Road');
    expect(candidateToZone(WARD).label).toBe('Eti-Osa');
  });

  it('never produces a zone the engine would refuse', () => {
    // A chosen candidate that the scoring engine rejects would save happily and
    // verify nothing — the silent-failure shape this codebase keeps meeting.
    for (const c of [ROAD, WARD, CLINIC]) {
      const z = candidateToZone(c);
      const ev = evaluateZone(c.lat, c.lon, {
        shape: z.shape,
        label: z.label,
        lat: Number(z.lat),
        lon: Number(z.lon),
        radiusM: z.radiusM,
        points: parsePointsText(z.pointsText),
        widthM: z.widthM,
        bufferM: z.bufferM,
      });
      expect(ev).not.toBeNull();
    }
  });

  it('produces a zone that actually contains the place it came from', () => {
    // The end-to-end claim, checked rather than assumed: search a road, take
    // the result, stand on the road, be inside the zone.
    const z = candidateToZone(ROAD);
    const ev = evaluateZone(6.445, 3.478, {
      shape: 'corridor',
      points: parsePointsText(z.pointsText),
      widthM: z.widthM,
      label: z.label,
    })!;
    expect(ev.inZone).toBe(true);

    const offRoad = evaluateZone(6.4486, 3.478, {
      shape: 'corridor',
      points: parsePointsText(z.pointsText),
      widthM: z.widthM,
      label: z.label,
    })!;
    expect(offRoad.inZone).toBe(false);
  });

  it('falls back to sane defaults when a field is missing', () => {
    const bare = { ...ROAD, width_m: undefined } as ZoneCandidate;
    expect(candidateToZone(bare).widthM).toBe(60);
    const bareArea = { ...WARD, buffer_m: undefined } as ZoneCandidate;
    expect(candidateToZone(bareArea).bufferM).toBe(25);
  });
});

describe('it offers, it does not choose', () => {
  const fs = require('fs');
  const path = require('path');
  const raw: string = fs.readFileSync(path.join(__dirname, 'ZonePlaceSearch.tsx'), 'utf8');
  const src: string = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line: string) => !line.trim().startsWith('//'))
    .join('\n');

  it('renders every match rather than a best one', () => {
    expect(src).toContain('results.map');
    expect(src).not.toMatch(/results\[0\]/);
    expect(src).not.toMatch(/onChoose\(candidateToZone\(results/);
  });

  it('shows the full address on each match', () => {
    // Two roads with the same name are told apart by the rest of the address
    // and nothing else. The label is the entire basis for the human's choice.
    expect(src).toContain('{c.label}');
  });

  it('tells the user to check the address before picking', () => {
    expect(raw).toContain('Check the address before you pick');
  });

  it('says when a boundary was simplified', () => {
    // A boundary the platform quietly redrew is not the boundary the client
    // drew, however reasonable the simplification.
    expect(src).toContain('c.simplified');
    expect(src).toContain('original_point_count');
  });

  it('saves nothing itself', () => {
    // The single write path is the Settings save handler. A second writer means
    // a zone chosen here can be silently overwritten by stale form state.
    expect(src).not.toContain('updateScoringConfig');
    expect(src).not.toContain('api.post');
    expect(src).not.toContain('api.put');
  });

  it('says so on screen, so nobody thinks the zone is already live', () => {
    expect(raw).toContain('Nothing is saved until you press Save');
  });

  it('repeats the server"s own refusal instead of inventing one', () => {
    expect(src).toContain('res.data?.error');
    expect(src).toContain("err?.response?.data?.error");
  });
});
