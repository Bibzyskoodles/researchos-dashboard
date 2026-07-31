import React, { useState } from 'react';
import { MailWarning, X } from 'lucide-react';
import { useAuth } from '../../store/AuthContext';
import { authApi } from '../../services/api';

/**
 * A calm, persistent reminder shown only while the signed-in user's email is
 * unverified. This matters because verification is enforced server-side: an
 * unverified workspace's uploads are rejected (403 email_verification_required
 * — see fieldscore-backend api.py submissions_upload), so without this banner a
 * founder would hit a wall with no in-app explanation of why. Offers a one-click
 * resend rather than making them hunt for the original email.
 *
 * Guarded on `email_verified === false` (strict) on purpose: the field is
 * optional, and accounts created before verification was enabled — or any paid
 * account — come back already-verified/undefined and must never see this.
 */
export default function VerifyEmailBanner() {
  const { user } = useAuth();
  const [dismissed, setDismissed] = useState(false);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (!user || user.email_verified !== false || dismissed) return null;

  const resend = async () => {
    setState('sending');
    try {
      await authApi.resendVerification();
      setState('sent');
    } catch {
      setState('error');
    }
  };

  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 20px',
        background: '#FFF7ED', borderBottom: '1px solid #FED7AA',
        color: '#9A3412', fontFamily: 'Inter, sans-serif', fontSize: 13.5,
      }}
    >
      <MailWarning size={18} style={{ flexShrink: 0 }} aria-hidden />
      <div style={{ flex: 1, lineHeight: 1.45 }}>
        <strong style={{ fontWeight: 700 }}>Confirm your email to start verifying submissions.</strong>{' '}
        <span style={{ color: '#B45309' }}>
          We sent a link to <strong>{user.email}</strong>. Uploads stay locked until it's confirmed.
        </span>
      </div>

      {state === 'sent' ? (
        <span style={{ color: '#15803D', fontWeight: 600, whiteSpace: 'nowrap' }}>
          Sent — check your inbox
        </span>
      ) : (
        <button
          onClick={resend}
          disabled={state === 'sending'}
          style={{
            padding: '6px 14px', borderRadius: 8, border: 'none',
            background: '#EA580C', color: 'white', fontSize: 12.5, fontWeight: 600,
            fontFamily: 'Inter, sans-serif', cursor: state === 'sending' ? 'default' : 'pointer',
            opacity: state === 'sending' ? 0.6 : 1, whiteSpace: 'nowrap',
          }}
        >
          {state === 'sending' ? 'Sending…' : state === 'error' ? 'Try again' : 'Resend email'}
        </button>
      )}

      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        title="Hide until next sign-in"
        style={{
          background: 'none', border: 'none', color: '#C2410C', cursor: 'pointer',
          display: 'flex', alignItems: 'center', padding: 4, flexShrink: 0,
        }}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}
