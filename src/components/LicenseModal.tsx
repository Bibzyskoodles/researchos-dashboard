import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export function LicenseModal() {
  const [isVisible, setIsVisible] = useState(false);
  const [reason, setReason] = useState<string>('');

  useEffect(() => {
    const handleLicenseRequired = (e: CustomEventInit) => {
      const message = (e.detail as { reason?: string })?.reason ||
        'Your subscription has expired. Please renew to continue.';
      setReason(message);
      setIsVisible(true);
    };

    window.addEventListener('license-required', handleLicenseRequired as EventListener);
    return () => {
      window.removeEventListener('license-required', handleLicenseRequired as EventListener);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        maxWidth: '500px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        position: 'relative',
        animation: 'slideUp 0.3s ease-out',
      }}>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <X size={20} color="#6b7280" />
        </button>

        <div style={{ display: 'flex', gap: '16px', marginBottom: '16px' }}>
          <AlertTriangle size={32} color="#dc2626" style={{ flexShrink: 0 }} />
          <div>
            <h2 style={{
              fontSize: '18px',
              fontWeight: '600',
              marginBottom: '8px',
              color: '#1f2937',
            }}>
              Subscription Required
            </h2>
            <p style={{
              fontSize: '14px',
              color: '#6b7280',
              lineHeight: '1.5',
              marginBottom: '12px',
            }}>
              {reason}
            </p>
            <p style={{
              fontSize: '13px',
              color: '#9ca3af',
              marginBottom: '16px',
            }}>
              Please upgrade or renew your subscription to restore access to all features.
            </p>
          </div>
        </div>

        <div style={{
          display: 'flex',
          gap: '8px',
          justifyContent: 'flex-end',
        }}>
          <button
            onClick={() => setIsVisible(false)}
            style={{
              padding: '8px 16px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#f9fafb',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: '#374151',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#f3f4f6';
            }}
            onMouseOut={(e) => {
              (e.target as HTMLButtonElement).style.backgroundColor = '#f9fafb';
            }}
          >
            Dismiss
          </button>
          <a
            href="/account/billing"
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: '#dc2626',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              color: 'white',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={(e) => {
              (e.target as HTMLAnchorElement).style.backgroundColor = '#b91c1c';
            }}
            onMouseOut={(e) => {
              (e.target as HTMLAnchorElement).style.backgroundColor = '#dc2626';
            }}
          >
            Manage Subscription
          </a>
        </div>
      </div>

      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
