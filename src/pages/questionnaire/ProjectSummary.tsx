import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Check, FileText, Image, Mic, MapPin, Clock } from 'lucide-react';
import { projectsApi } from '../../services/api';

/**
 * What this project collects, and what will actually check it.
 *
 * Phase 3 of docs/ada_project_configuration_spec.md.
 *
 * The questionnaire lives on one screen and the settings on another, and
 * whether a check will *run* depends on both. This is the one place that says
 * so — and it is built to be as willing to report "will not run, and here is
 * why" as it is to report "will run". The 3rd of August went into a setting
 * that had silently failed to save, and no screen in the platform would have
 * told anyone.
 *
 * Every judgement here is made on the server (project_summary.py). This
 * component renders; it does not decide. A second opinion about whether a check
 * will run is exactly how the dashboard came to show a flat 15 for a submission
 * the engine had scored 94.
 */

const GREEN = '#059669';
const AMBER = '#D97706';

interface SummaryCheck {
  key: string;
  label: string;
  will_run: boolean;
  detail: string;
  fix: string | null;
}

interface ProjectSummaryData {
  title: string;
  has_questionnaire: boolean;
  ready: boolean;
  gap_count: number;
  collection: {
    sections: number;
    questions: number;
    photos: number;
    audio_clips: number;
    captures_location: boolean;
    estimated_minutes: number | null;
    by_type: Record<string, number>;
  };
  checks: SummaryCheck[];
  zone:
    | { configured: false }
    | {
        configured: true;
        shape: string;
        label: string;
        tolerance_m: number;
        point_count: number;
        reject_km: number | null;
      };
}

const SHAPE_WORD: Record<string, string> = {
  circle: 'a point',
  corridor: 'a route',
  polygon: 'an area',
};

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div style={{ flex: 1, minWidth: 108 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#9CA3AF', marginBottom: 3 }}>
        {icon}
        <span style={{ fontSize: 10.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {label}
        </span>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  );
}

export default function ProjectSummary({ projectId }: { projectId?: string }) {
  const [data, setData] = useState<ProjectSummaryData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    projectsApi.summary(projectId)
      .then(res => { if (!cancelled) setData(res.data); })
      .catch((e: unknown) => {
        if (cancelled) return;
        const err = e as { response?: { status?: number; data?: { error?: string } } };
        setError(err?.response?.data?.error
          || (!err?.response ? "Couldn't reach the server." : `Couldn't load the summary (error ${err.response.status}).`));
      });
    return () => { cancelled = true; };
  }, [projectId]);

  if (!projectId || (!data && !error)) return null;

  if (error) {
    return (
      <div style={{
        marginBottom: 20, padding: '11px 14px', borderRadius: 10,
        background: '#FEF2F2', border: '1px solid #FECACA',
        fontSize: 12, color: '#DC2626', fontFamily: 'Inter, sans-serif',
      }}>
        ⚠ {error}
      </div>
    );
  }

  const s = data!;
  if (!s.has_questionnaire) return null;

  const gaps = s.checks.filter(c => !c.will_run && c.fix);
  const running = s.checks.filter(c => c.will_run);

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        marginBottom: 20, borderRadius: 14, overflow: 'hidden',
        border: '1px solid #E8EEFB', background: '#FFF',
        fontFamily: 'Inter, sans-serif',
      }}
    >
      <div style={{ padding: '15px 18px 12px', background: '#F8FAFF', borderBottom: '1px solid #E8EEFB' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.7 }}>
          What this project collects and verifies
        </div>
        <div style={{ display: 'flex', gap: 18, marginTop: 12, flexWrap: 'wrap' }}>
          <Stat icon={<FileText size={12} />} label="Questions"
            value={`${s.collection.questions}`} />
          {s.collection.estimated_minutes != null && (
            <Stat icon={<Clock size={12} />} label="Per interview"
              value={`~${s.collection.estimated_minutes} min`} />
          )}
          {s.collection.photos > 0 && (
            <Stat icon={<Image size={12} />} label="Photos"
              value={`${s.collection.photos}`} />
          )}
          {s.collection.audio_clips > 0 && (
            <Stat icon={<Mic size={12} />} label="Recordings"
              value={`${s.collection.audio_clips}`} />
          )}
          {s.collection.captures_location && (
            <Stat icon={<MapPin size={12} />} label="Location"
              value={s.zone.configured ? SHAPE_WORD[s.zone.shape] || 'set' : 'captured'} />
          )}
        </div>
      </div>

      {/* Gaps first. A summary that leads with what is working, while something
          is quietly not, is the screen that would not have caught 3 August. */}
      {gaps.length > 0 && (
        <div style={{ padding: '13px 18px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
            <AlertTriangle size={14} color={AMBER} />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#92400E' }}>
              {gaps.length === 1
                ? 'One check will not run yet'
                : `${gaps.length} checks will not run yet`}
            </span>
          </div>
          {gaps.map(c => (
            <div key={c.key} style={{ marginBottom: 7 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#78350F' }}>{c.label}</div>
              <div style={{ fontSize: 11.5, color: '#92400E', lineHeight: 1.5 }}>{c.detail}</div>
              {c.fix && (
                <div style={{ fontSize: 11, color: '#B45309', marginTop: 2, lineHeight: 1.5 }}>
                  → {c.fix}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ padding: '13px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 9 }}>
          <Check size={14} color={GREEN} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: '#065F46' }}>
            {running.length} check{running.length === 1 ? '' : 's'} will run on every submission
          </span>
        </div>
        {running.map(c => (
          <div key={c.key} style={{ marginBottom: 7 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#111827' }}>{c.label}</div>
            {/* The real configured text, not a paraphrase — seeing it is what
                lets someone notice it describes the wrong thing. */}
            <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.5 }}>{c.detail}</div>
          </div>
        ))}
        {s.checks.some(c => !c.will_run && !c.fix) && (
          <div style={{ marginTop: 10, paddingTop: 9, borderTop: '1px solid #F1F5F9' }}>
            <div style={{ fontSize: 10.5, color: '#9CA3AF', lineHeight: 1.55 }}>
              Not applicable to this questionnaire:{' '}
              {s.checks.filter(c => !c.will_run && !c.fix).map(c => c.label).join(', ')}.
            </div>
          </div>
        )}
      </div>

      {s.ready && (
        <div style={{
          padding: '10px 18px', background: '#ECFDF5', borderTop: '1px solid #D1FAE5',
          fontSize: 11.5, color: '#065F46', fontWeight: 600,
        }}>
          ✓ Everything this questionnaire collects is being verified. Ready to collect.
        </div>
      )}
      <div style={{ padding: '9px 18px', borderTop: '1px solid #F1F5F9', fontSize: 10.5, color: '#9CA3AF' }}>
        Change any of this in Settings. Colour and wording here come from the
        server, so this is what the scoring engine will actually do — not a
        separate opinion about it.
      </div>
    </motion.div>
  );
}
