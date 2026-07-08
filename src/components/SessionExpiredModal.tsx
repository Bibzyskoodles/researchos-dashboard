import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';

export function SessionExpiredModal() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleSessionExpired = () => setShow(true);
    window.addEventListener('session-expired', handleSessionExpired as EventListener);
    return () => window.removeEventListener('session-expired', handleSessionExpired as EventListener);
  }, []);

  const handleRedirect = () => {
    localStorage.removeItem('fs_token');
    document.cookie = 'fs_token=;path=/;max-age=0';
    window.location.href = '/login?reason=session_expired';
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            style={{
              background: 'white',
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
              <AlertCircle size={24} color="#DC2626" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, color: '#080D1A', margin: 0, marginBottom: 8 }}>
                  Session Expired
                </h2>
                <p style={{ fontSize: 14, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>
                  Your session has ended for security. Please log in again to continue.
                </p>
              </div>
            </div>
            <button
              onClick={handleRedirect}
              style={{
                width: '100%',
                padding: '10px 16px',
                background: '#2463EB',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                marginTop: 16,
              }}
            >
              Go to Login
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
