import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { projectsApi } from '../../services/api';
import { formatPointsText, type ZonePoint, type ZoneShape } from '../../services/zoneGeometry';

/**
 * Find a road, an area or a place on OpenStreetMap and turn it into a zone.
 *
 * Zones could already be roads and areas — but someone had to find the
 * coordinates by hand and paste them a line at a time. OSM already holds the
 * geometry: a road search comes back with the road's own centreline, a ward
 * search with its boundary.
 *
 * Two rules this component exists to keep:
 *
 *  1. **It never picks.** Every match is listed with the full address OSM has
 *     for it, and a person chooses. "Kusenla Road" matches more than one road
 *     on earth, and a wrong zone rejects honest enumerators and withholds their
 *     pay while wearing the authority of something the platform chose. There is
 *     deliberately no "best match" and nothing is pre-selected.
 *
 *  2. **Choosing fills the form; it does not save.** The zone fields are
 *     populated and the user reviews and saves as normal. A second write path
 *     would mean a zone chosen here could be silently overwritten by a Settings
 *     save still holding the old value.
 */

const BLUE = '#2463EB';

export interface ZoneCandidate {
  label: string;
  shape: ZoneShape;
  lat: number;
  lon: number;
  points: ZonePoint[];
  radius_m?: number;
  width_m?: number;
  buffer_m?: number;
  simplified: boolean;
  original_point_count: number | null;
  category: string;
}

export interface ChosenZone {
  shape: ZoneShape;
  label: string;
  lat: string;
  lon: string;
  radiusM: number;
  pointsText: string;
  widthM: number;
  bufferM: number;
}

interface Props {
  projectId?: string;
  onChoose: (zone: ChosenZone) => void;
}

const SHAPE_WORD: Record<ZoneShape, string> = {
  circle: 'Place',
  corridor: 'Road / route',
  polygon: 'Area',
};

export function candidateToZone(c: ZoneCandidate): ChosenZone {
  return {
    shape: c.shape,
    // The full OSM address is long; the first part is the recognisable name.
    label: c.label.split(',')[0].trim() || c.label,
    lat: String(c.lat),
    lon: String(c.lon),
    radiusM: Math.round(c.radius_m ?? 250),
    pointsText: formatPointsText(c.points || []),
    widthM: Math.round(c.width_m ?? 60),
    bufferM: Math.round(c.buffer_m ?? 25),
  };
}

export default function ZonePlaceSearch({ projectId, onChoose }: Props) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'idle' | 'searching'>('idle');
  const [results, setResults] = useState<ZoneCandidate[] | null>(null);
  const [message, setMessage] = useState('');

  const run = async () => {
    if (!projectId || query.trim().length < 3) return;
    setState('searching');
    setMessage('');
    setResults(null);
    try {
      const res = await projectsApi.zoneSearch(projectId, query.trim());
      const found: ZoneCandidate[] = res.data?.candidates || [];
      // The server sends a plain sentence for its own refusals (rate limit,
      // map service down). Repeat it rather than replacing it with a guess.
      if (res.data?.error) setMessage(res.data.error);
      else if (found.length === 0) setMessage(`Nothing found for "${query.trim()}". Try adding the town or state.`);
      setResults(found);
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      setMessage(
        err?.response?.data?.error
          || (!err?.response
            ? "Couldn't reach the server — nothing has changed."
            : `Place search failed (error ${err.response.status}).`),
      );
    } finally {
      setState('idle');
    }
  };

  return (
    <div style={{ marginBottom: 16, padding: '13px 15px', borderRadius: 10, background: '#FFF', border: '1px solid #E2E8F0' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#374151', marginBottom: 3 }}>
        Find it on the map
      </div>
      <div style={{ fontSize: 10.5, color: '#6B7280', marginBottom: 9, lineHeight: 1.55 }}>
        Search for a road, a ward or a place and I'll fill in the shape for you.
        A road comes back as its actual route, an area as its actual boundary.
        {' '}<strong>Check the address before you pick</strong> — the same name
        exists in more than one place, so I list every match rather than choosing.
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); run(); } }}
          placeholder="e.g. Kusenla Road, Lekki, Lagos"
          style={{
            flex: 1, padding: '8px 11px', borderRadius: 8, border: '1px solid #E2E8F0',
            fontSize: 12.5, boxSizing: 'border-box', fontFamily: 'Inter, sans-serif',
          }}
        />
        <button
          onClick={run}
          disabled={!projectId || state === 'searching' || query.trim().length < 3}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 8, border: 'none',
            background: !projectId || query.trim().length < 3 ? '#DBEAFE' : BLUE,
            color: 'white', fontSize: 12.5, fontWeight: 700,
            cursor: state === 'searching' ? 'wait' : 'pointer',
            fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
          }}
        >
          <Search size={13} /> {state === 'searching' ? 'Searching…' : 'Search'}
        </button>
      </div>

      {!projectId && (
        <div style={{ fontSize: 10.5, color: '#D97706', marginTop: 6 }}>
          Select a project first — search runs against the project's workspace.
        </div>
      )}

      {message && (
        <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 8, lineHeight: 1.5 }}>
          {message}
        </div>
      )}

      {results && results.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {results.map((c, i) => (
            <button
              key={i}
              onClick={() => onChoose(candidateToZone(c))}
              style={{
                textAlign: 'left', padding: '9px 12px', borderRadius: 8,
                border: '1px solid #E2E8F0', background: '#FAFBFF', cursor: 'pointer',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: BLUE, background: '#EEF2FF',
                  padding: '1px 7px', borderRadius: 20,
                }}>
                  {SHAPE_WORD[c.shape]}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: '#111827' }}>
                  {c.label.split(',')[0]}
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.45 }}>
                {c.label}
              </div>
              <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 3 }}>
                {c.shape === 'corridor' && `${c.points.length} points along the route`}
                {c.shape === 'polygon' && `${c.points.length} corner points`}
                {c.shape === 'circle' && `Point zone, suggested radius ${Math.round(c.radius_m ?? 250)} m`}
                {/* Said out loud: a boundary the platform redrew, however
                    reasonably, is not the boundary the client drew. */}
                {c.simplified && c.original_point_count
                  ? ` — simplified from ${c.original_point_count.toLocaleString()}`
                  : c.simplified ? ' — simplified' : ''}
              </div>
            </button>
          ))}
          <div style={{ fontSize: 10.5, color: '#9CA3AF', marginTop: 2, lineHeight: 1.5 }}>
            Picking one fills the fields below. Nothing is saved until you press Save.
          </div>
        </div>
      )}
    </div>
  );
}
