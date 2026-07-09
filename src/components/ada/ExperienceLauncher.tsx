import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, CheckCircle, ArrowRight, Radio } from 'lucide-react';
import { useGuidedExperience } from '../../ada/GuidedExperienceContext';
import { TOURS } from '../../ada/tours';

const BLUE = '#2463EB';
const DARK = '#0C1128';
const RED = '#DC2626';

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
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', overflow: 'hidden',
                  border: '2.5px solid rgba(37,99,235,0.5)',
                  boxShadow: '0 0 20px rgba(37,99,235,0.3)', flexShrink: 0,
                }}>
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

              {/* === PRESENT TO ROOM — featured card === */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
                  Demo Mode
                </div>
                <motion.button
                  whileHover={{ background: 'rgba(220,38,38,0.06)', borderColor: 'rgba(220,38,38,0.35)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => { startTour('executive', 'demo'); hideLauncher(); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 18px', borderRadius: 14, cursor: 'pointer', width: '100%',
                    background: 'rgba(220,38,38,0.04)', border: '1.5px solid rgba(220,38,38,0.2)',
                    textAlign: 'left', fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                    background: 'rgba(220,38,38,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Radio size={18} color={RED} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', marginBottom: 3 }}>
                      Present to Room
                    </div>
                    <div style={{ fontSize: 11.5, color: '#6B7280', lineHeight: 1.5 }}>
                      Ada introduces herself to your audience and presents live — anyone can ask questions at any point
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                    <motion.div
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                      style={{ width: 6, height: 6, borderRadius: '50%', background: RED }}
                    />
                    <span style={{ fontSize: 10, fontWeight: 700, color: RED, letterSpacing: 0.5 }}>LIVE</span>
                  </div>
                </motion.button>
              </div>

              {/* Divider */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
                <span style={{ fontSize: 10, color: '#CBD5E1', fontWeight: 600, letterSpacing: 0.5 }}>Personal Tours</span>
                <div style={{ flex: 1, height: 1, background: '#F1F5F9' }} />
              </div>

              <p style={{ margin: '0 0 14px', fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>
                Ada walks you through the platform live — no videos, no documentation. Choose how deep you'd like to go.
              </p>

              {/* Tour options */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {TOURS.map(tour => {
                  const completed = store.completedTours.includes(tour.id);
                  return (
                    <motion.button
                      key={tour.id}
                      whileHover={{ background: '#F0F5FF', borderColor: `${BLUE}55` }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => { startTour(tour.id, 'tour'); hideLauncher(); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 14,
                        padding: '13px 16px', borderRadius: 12, cursor: 'pointer',
                        background: '#F8FAFF', border: '1.5px solid #E8EDF5',
                        textAlign: 'left', fontFamily: 'Inter, sans-serif', width: '100%',
                      }}
                    >
                      <div style={{
                        width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                        background: completed ? '#ECFDF5' : '#EFF4FF',
                        display: 'grid', placeItems: 'center',
                      }}>
                        {completed
                          ? <CheckCircle size={15} color="#059669" />
                          : <div style={{ width: 7, height: 7, borderRadius: '50%', background: BLUE }} />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{tour.name}</div>
                        <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 1 }}>
                          <Clock size={9} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                          {tour.durationLabel} · {tour.description}
                        </div>
                      </div>
                      <ArrowRight size={13} color={BLUE} />
                    </motion.button>
                  );
                })}

                {/* Explore independently */}
                <button
                  onClick={hideLauncher}
                  style={{
                    padding: '11px 16px', borderRadius: 12, cursor: 'pointer', width: '100%',
                    background: 'none', border: '1.5px dashed #E2E8F0', color: '#9CA3AF',
                    fontSize: 12.5, fontFamily: 'Inter, sans-serif', fontWeight: 500,
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = '#6B7280'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#CBD5E1'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = '#9CA3AF'; (e.currentTarget as HTMLButtonElement).style.borderColor = '#E2E8F0'; }}
                >
                  Explore independently
                </button>
              </div>

              <p style={{ margin: '14px 0 0', fontSize: 11, color: '#CBD5E1', textAlign: 'center' }}>
                Launch guided experiences at any time from the sidebar
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
