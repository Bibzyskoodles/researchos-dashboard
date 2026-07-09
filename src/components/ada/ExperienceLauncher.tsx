import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { useGuidedExperience } from '../../ada/GuidedExperienceContext';
import { TOURS } from '../../ada/tours';

const BLUE = '#2463EB';
const DARK = '#0C1128';

export default function ExperienceLauncher() {
  const { store, startTour, hideLauncher } = useGuidedExperience();

  if (!store.showLauncher) return null;

  return (
    <AnimatePresence>
      {store.showLauncher && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={hideLauncher}
            style={{ position: 'fixed', inset: 0, background: 'rgba(8,13,26,0.55)', zIndex: 1800 }}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            style={{
              position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              zIndex: 1900, width: 520, maxWidth: 'calc(100vw - 32px)',
              maxHeight: 'calc(100vh - 48px)', overflowY: 'auto',
              background: 'white', borderRadius: 20,
              boxShadow: '0 24px 80px rgba(8,13,26,0.28), 0 4px 16px rgba(8,13,26,0.1)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {/* Header */}
            <div style={{ background: `linear-gradient(135deg, ${DARK}, #1A1F3E)`, padding: '28px 28px 24px', position: 'relative' }}>
              <button
                onClick={hideLauncher}
                style={{
                  position: 'absolute', top: 16, right: 16, width: 32, height: 32,
                  borderRadius: 8, background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
                  display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.5)',
                }}
              >
                <X size={15} />
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: '2.5px solid rgba(37,99,235,0.5)', boxShadow: '0 0 20px rgba(37,99,235,0.3)', flexShrink: 0 }}>
                  <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
                </div>
                <div>
                  <div style={{ fontSize: 19, fontWeight: 700, color: 'white', letterSpacing: -0.4 }}>Learn with Ada</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.5)', marginTop: 3 }}>
                    Interactive guided experiences — inside the real platform
                  </div>
                </div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: '24px 28px 28px' }}>
              <p style={{ margin: '0 0 20px', fontSize: 13.5, color: '#374151', lineHeight: 1.65 }}>
                Ada will walk you through the platform live — no videos, no documentation. Choose how deep you'd like to go.
              </p>

              {/* Tour options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {TOURS.map(tour => {
                  const completed = store.completedTours.includes(tour.id);
                  return (
                    <motion.button
                      key={tour.id}
                      whileHover={{ background: '#F0F5FF', borderColor: `${BLUE}55` }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => startTour(tour.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '14px 16px', borderRadius: 12, cursor: 'pointer',
                        background: '#F8FAFF', border: '1.5px solid #E8EDF5',
                        textAlign: 'left', transition: 'all .15s', width: '100%',
                        fontFamily: 'Inter, sans-serif',
                      }}
                    >
                      <div style={{
                        width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                        background: completed ? '#ECFDF5' : '#EFF4FF',
                        display: 'grid', placeItems: 'center',
                      }}>
                        {completed
                          ? <CheckCircle size={16} color="#059669" />
                          : <div style={{ width: 8, height: 8, borderRadius: '50%', background: BLUE }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>{tour.name}</div>
                        <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>
                          <Clock size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                          {tour.durationLabel} · {tour.description}
                        </div>
                      </div>
                      <ArrowRight size={14} color={BLUE} />
                    </motion.button>
                  );
                })}

                {/* Explore independently */}
                <button
                  onClick={hideLauncher}
                  style={{
                    padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
                    background: 'none', border: '1.5px dashed #E2E8F0', color: '#9CA3AF',
                    fontSize: 12.5, fontFamily: 'Inter, sans-serif', fontWeight: 500,
                    transition: 'all .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6B7280'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E1'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0'; }}
                >
                  Explore independently
                </button>
              </div>

              <p style={{ margin: '16px 0 0', fontSize: 11, color: '#CBD5E1', textAlign: 'center' }}>
                You can launch a guided experience at any time from the sidebar
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
