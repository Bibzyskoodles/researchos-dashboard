import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, MapPin, Mic, X } from 'lucide-react';
import { projectsApi } from '../../services/api';

/**
 * What Ada proposes once the questionnaire is saved.
 *
 * A form containing a GPS question, a photograph and an audio recording is a
 * statement about how the fieldwork will be verified. Every setting that
 * statement implies already existed — none were ever proposed, so the user
 * configured by hand what their own questionnaire had already said.
 *
 * Two decisions shape this component (docs/ada_project_configuration_spec.md):
 *
 *  1. It appears automatically, so it must take "not now" for an answer. The
 *     server remembers a decline and stops offering.
 *
 *  2. One click applies all of it. That raises the bar on the card rather than
 *     lowering it: every line carries the evidence it came from, next to it,
 *     with the questionnaire on the same screen. A line the user cannot check
 *     at a glance does not belong on a card approved in one action.
 *
 * The Apply call sends no settings. The server re-derives them from the stored
 * questionnaire, because this card is a client-side object a caller could edit —
 * if the server wrote what the browser sent, the confirmation would protect
 * nothing.
 */

const BLUE = '#2463EB';
const GREEN = '#059669';
const AMBER = '#D97706';

export interface ProposedSetting {
  key: string;
  label: string;
  display: string;
  evidence: string;
  question_ids: string[];
  confidence: number;
}

export interface ProposalAsk {
  key: string;
  label: string;
  detail: string;
  question_ids: string[];
}

export interface ConfigProposal {
  settings: ProposedSetting[];
  asks: ProposalAsk[];
  notes: string[];
}

interface Props {
  projectId: string;
  proposal: ConfigProposal;
  onApplied: () => void;
  onDismissed: () => void;
}

export default function AdaConfigProposal({ projectId, proposal, onApplied, onDismissed }: Props) {
  const [state, setState] = useState<'idle' | 'applying' | 'applied' | 'error'>('idle');
  const [error, setError] = useState('');

  const apply = async () => {
    setState('applying');
    setError('');
    try {
      await projectsApi.applyConfigProposal(projectId);
      setState('applied');
      onApplied();
    } catch (e: unknown) {
      const err = e as { response?: { status?: number; data?: { error?: string } } };
      const serverMessage = err?.response?.data?.error;
      setError(
        typeof serverMessage === 'string' && serverMessage
          ? serverMessage
          : !err?.response
            ? "Couldn't reach the server. Nothing has been changed."
            : `Couldn't apply this (error ${err.response.status}). Nothing has been changed.`,
      );
      setState('error');
    }
  };

  const decline = () => {
    // Best-effort: if recording the dismissal fails, the card still closes.
    // Reopening it against the user's wishes is the worse outcome of the two.
    projectsApi.declineConfigProposal(projectId).catch(() => {});
    onDismissed();
  };

  if (state === 'applied') {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22 }}
        style={{
          marginBottom: 20, padding: '14px 18px', borderRadius: 12,
          background: '#ECFDF5', border: '1px solid #6EE7B7',
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        <Check size={18} color={GREEN} style={{ flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>
            Verification configured
          </div>
          <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
            {proposal.asks.length > 0
              ? `${proposal.asks.length} thing${proposal.asks.length > 1 ? 's' : ''} still need${proposal.asks.length > 1 ? '' : 's'} you — see Settings.`
              : 'Change any of it in Settings.'}
          </div>
        </div>
      </motion.div>
    );
  }

  const hasSettings = proposal.settings.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{
        marginBottom: 20, borderRadius: 14, overflow: 'hidden',
        border: `1px solid ${BLUE}33`, background: '#F8FAFF',
      }}
    >
      <div style={{ padding: '16px 18px 12px', display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <img src="/ada-avatar.jpg" alt="Ada"
          style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>
            {hasSettings
              ? 'Your questionnaire implies a verification setup'
              : 'A note on verifying this questionnaire'}
          </div>
          <div style={{ fontSize: 12.5, color: '#4B5563', marginTop: 3, lineHeight: 1.55 }}>
            {hasSettings
              ? 'These come from the questions you just designed. I can apply them to this project now.'
              : "There's nothing here I can configure from the questionnaire alone."}
          </div>
        </div>
        <button onClick={decline} aria-label="Dismiss"
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#9CA3AF', padding: 2 }}>
          <X size={16} />
        </button>
      </div>

      {hasSettings && (
        <div style={{ padding: '0 18px' }}>
          {proposal.settings.map(s => (
            <div key={s.key} style={{ padding: '11px 0', borderTop: '1px solid #E8EEFB' }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: '#6B7280', minWidth: 148 }}>
                  {s.label}
                </div>
                <div style={{ flex: 1, fontSize: 12.5, color: '#111827', fontWeight: 600, lineHeight: 1.5 }}>
                  {s.display}
                </div>
              </div>
              {/* The evidence sits under the value, not behind a tooltip. One
                  click accepts all of it, so the reason has to be readable
                  without another interaction. */}
              <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 4, marginLeft: 160, lineHeight: 1.55 }}>
                {s.evidence}
              </div>
            </div>
          ))}
        </div>
      )}

      {proposal.asks.length > 0 && (
        <div style={{ padding: '0 18px', marginTop: hasSettings ? 4 : 0 }}>
          {proposal.asks.map(a => (
            <div key={a.key} style={{
              padding: '11px 12px', margin: '8px 0', borderRadius: 9,
              background: '#FFFBEB', border: '1px solid #FDE68A',
            }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {a.key === 'zone'
                  ? <MapPin size={14} color={AMBER} style={{ flexShrink: 0, marginTop: 2 }} />
                  : <Mic size={14} color={AMBER} style={{ flexShrink: 0, marginTop: 2 }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: '#92400E' }}>{a.label}</div>
                  <div style={{ fontSize: 11.5, color: '#78350F', marginTop: 3, lineHeight: 1.55 }}>
                    {a.detail}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {proposal.notes.length > 0 && (
        <div style={{ padding: '8px 18px 0' }}>
          {proposal.notes.map((n, i) => (
            <div key={i} style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.55, marginBottom: 4 }}>
              {n}
            </div>
          ))}
        </div>
      )}

      {error && (
        <div style={{
          margin: '10px 18px 0', padding: '10px 12px', borderRadius: 8,
          background: '#FEF2F2', border: '1px solid #FECACA',
          fontSize: 12, color: '#DC2626', lineHeight: 1.5,
        }}>
          ⚠ {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, padding: '14px 18px', alignItems: 'center' }}>
        {hasSettings && (
          <motion.button
            onClick={apply}
            disabled={state === 'applying'}
            whileTap={{ scale: 0.98 }}
            style={{
              padding: '9px 18px', borderRadius: 9, border: 'none',
              background: BLUE, color: 'white', fontSize: 12.5, fontWeight: 700,
              cursor: state === 'applying' ? 'wait' : 'pointer',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {state === 'applying' ? 'Applying…' : 'Apply to this project'}
          </motion.button>
        )}
        <button
          onClick={decline}
          style={{
            padding: '9px 14px', borderRadius: 9, border: '1px solid #E2E8F0',
            background: 'white', color: '#6B7280', fontSize: 12.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'Inter, sans-serif',
          }}
        >
          {hasSettings ? 'Not now' : 'Got it'}
        </button>
        {hasSettings && (
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
            Everything here is changeable in Settings afterwards.
          </span>
        )}
      </div>
    </motion.div>
  );
}
