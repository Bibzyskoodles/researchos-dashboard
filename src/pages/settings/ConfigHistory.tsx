import React, { useCallback, useEffect, useState } from 'react';
import { History } from 'lucide-react';
import { projectsApi } from '../../services/api';

/**
 * Who changed how this project's submissions are judged, and when.
 *
 * `certificate.py` signs an attestation about submissions scored under a policy
 * that can be changed afterwards. Until the history existed there was no answer
 * to "the numbers were different last week", and no answer to "who changed
 * this?" either.
 *
 * The entries come from the server already reduced to what actually moved —
 * one changed slider is one line, not a reprint of the whole configuration.
 * A history where every row looks identical is one nobody reads, which fails
 * the same way as having no history, just more expensively.
 */

const BLUE = '#2463EB';

interface ConfigChange {
  key: string;
  from: unknown;
  to: unknown;
}

interface ConfigHistoryEntry {
  changed_by: string;
  changed_at: string;
  source: string;
  changes: ConfigChange[];
}

// Setting keys are stored in the shape the scoring engine reads them. Nobody
// configuring a project thinks in `zone_reject_km`.
const FIELD_LABELS: Record<string, string> = {
  image_context: 'What the photo should show',
  audio_context: 'What the audio should capture',
  research_purpose: 'Study purpose',
  min_duration: 'Shortest plausible interview',
  max_duration: 'Longest plausible interview',
  pass_threshold: 'Pass threshold',
  flag_threshold: 'Flag threshold',
  zone_shape: 'Zone shape',
  zone_label: 'Zone name',
  zone_lat: 'Zone latitude',
  zone_lon: 'Zone longitude',
  zone_radius_m: 'Zone radius',
  zone_points: 'Zone outline',
  zone_width_m: 'Route width',
  zone_buffer_m: 'Boundary allowance',
  zone_reject_km: 'Reject beyond',
  allowed_country: 'Allowed country',
  travel_suspicious_kph: 'Flag travel faster than',
  travel_very_high_kph: 'Treat travel as serious above',
  travel_impossible_kph: 'Reject travel faster than',
};

const SOURCE_LABELS: Record<string, string> = {
  settings: 'Changed in Settings',
  ada_proposal: "Ada's proposal, accepted",
  ada_proposal_declined: "Ada's proposal, declined",
};

export function fieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replace(/_/g, ' ');
}

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] || source.replace(/_/g, ' ');
}

/** A value as a person would read it. Never "[object Object]", never "null". */
export function readableValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return 'not set';
  if (typeof v === 'boolean') return v ? 'on' : 'off';
  if (Array.isArray(v)) return `${v.length} point${v.length === 1 ? '' : 's'}`;
  if (typeof v === 'object') return 'updated';
  const s = String(v);
  // Descriptions run to a paragraph. The history is a list of what changed,
  // not a place to read the paragraph — that is what Settings above is for.
  return s.length > 80 ? `${s.slice(0, 77)}…` : s;
}

export function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso || 'unknown time';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function ConfigHistory({ projectId }: { projectId?: string }) {
  const [entries, setEntries] = useState<ConfigHistoryEntry[] | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(() => {
    if (!projectId) return;
    projectsApi.configHistory(projectId)
      .then(res => { setEntries(res.data?.entries || []); setError(''); })
      .catch((e: unknown) => {
        const err = e as { response?: { status?: number; data?: { error?: string } } };
        setError(err?.response?.data?.error
          || (!err?.response
            ? "Couldn't reach the server."
            : `Couldn't load the change history (error ${err.response.status}).`));
      });
  }, [projectId]);

  useEffect(() => { load(); }, [load]);

  if (!projectId) return null;

  const shown = expanded ? entries || [] : (entries || []).slice(0, 5);

  return (
    <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #F1F5F9' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
        <History size={13} color="#9CA3AF" />
        <span style={{
          fontSize: 11, fontWeight: 700, color: '#9CA3AF',
          textTransform: 'uppercase', letterSpacing: 0.7,
        }}>
          Change history
        </span>
      </div>
      <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 10, lineHeight: 1.55 }}>
        Every change to how this project's submissions are judged. Your data
        integrity certificate attests to submissions scored under these
        settings, so it matters that the record of them is complete.
      </div>

      {error && (
        <div style={{ fontSize: 11.5, color: '#DC2626', lineHeight: 1.5 }}>⚠ {error}</div>
      )}

      {!error && entries !== null && entries.length === 0 && (
        <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>
          Nothing has changed yet — this project is running on the settings it
          was created with.
        </div>
      )}

      {shown.map((e, i) => (
        <div key={i} style={{
          padding: '9px 12px', marginBottom: 6, borderRadius: 8,
          background: '#FAFBFF', border: '1px solid #EEF2F8',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11.5, fontWeight: 600, color: '#111827' }}>
              {sourceLabel(e.source)}
            </span>
            <span style={{ fontSize: 10.5, color: '#9CA3AF' }}>
              {formatWhen(e.changed_at)}{e.changed_by ? ` · ${e.changed_by}` : ''}
            </span>
          </div>
          {e.changes.length === 0 ? (
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>
              No settings were changed.
            </div>
          ) : (
            e.changes.map(c => (
              <div key={c.key} style={{ fontSize: 11, color: '#6B7280', marginTop: 3, lineHeight: 1.5 }}>
                <span style={{ fontWeight: 600, color: '#374151' }}>{fieldLabel(c.key)}</span>
                {': '}
                <span style={{ textDecoration: 'line-through', opacity: 0.7 }}>
                  {readableValue(c.from)}
                </span>
                {' → '}
                <span style={{ color: '#111827', fontWeight: 600 }}>{readableValue(c.to)}</span>
              </div>
            ))
          )}
        </div>
      ))}

      {entries && entries.length > 5 && (
        <button
          onClick={() => setExpanded(v => !v)}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: BLUE, fontSize: 11.5, fontWeight: 600, padding: 0,
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {expanded ? 'Show fewer' : `Show all ${entries.length} changes`}
        </button>
      )}
    </div>
  );
}
