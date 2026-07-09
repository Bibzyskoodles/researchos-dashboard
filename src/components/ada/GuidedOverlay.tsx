import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGuidedExperience, HighlightRect } from '../../ada/GuidedExperienceContext';

const BLUE = '#2463EB';
const DARK = '#0C1128';

const XI_KEY = process.env.REACT_APP_ELEVENLABS_KEY || '';
const XI_VOICE_ID = process.env.REACT_APP_ELEVENLABS_VOICE_ID || 'jBpfuIE2acCO8z3wKNLl'; // Nigerian English female

async function speakStep(
  text: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onStart?: () => void,
  onEnd?: () => void
): Promise<void> {
  const OAI_KEY = process.env.REACT_APP_OPENAI_KEY || '';
  const clean = text.replace(/\n/g, ' ').trim();
  if (!clean) { onEnd?.(); return; }

  onStart?.();

  const stopPrev = () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };

  const playBlob = async (blob: Blob): Promise<boolean> => {
    try {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;
      return new Promise(resolve => {
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd?.(); resolve(true); };
        audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(false); };
        audio.play().catch(() => resolve(false));
      });
    } catch { return false; }
  };

  // 1. ElevenLabs — Nigerian English voice
  if (XI_KEY) {
    try {
      stopPrev();
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${XI_VOICE_ID}`, {
        method: 'POST',
        headers: { 'xi-api-key': XI_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: clean,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.45, similarity_boost: 0.82, style: 0.3, use_speaker_boost: true },
        }),
      });
      if (res.ok) { if (await playBlob(await res.blob())) return; }
    } catch { /* fall through */ }
  }

  // 2. OpenAI TTS fallback
  if (OAI_KEY) {
    try {
      stopPrev();
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tts-1-hd', input: clean, voice: 'shimmer', speed: 1.0 }),
      });
      if (res.ok) { if (await playBlob(await res.blob())) return; }
    } catch { /* fall through */ }
  }

  // 3. Web Speech fallback
  const synth = window.speechSynthesis;
  if (!synth) { onEnd?.(); return; }
  synth.cancel();
  const utt = new SpeechSynthesisUtterance(clean);
  utt.rate = 1.0;
  const voices = synth.getVoices();
  const preferred = voices.find(v => /google.*female/i.test(v.name) && /en/i.test(v.lang))
    || voices.find(v => /en/i.test(v.lang));
  if (preferred) utt.voice = preferred;
  utt.onend = () => onEnd?.();
  utt.onerror = () => onEnd?.();
  if (synth.getVoices().length === 0) {
    synth.onvoiceschanged = () => { synth.onvoiceschanged = null; synth.speak(utt); };
  } else {
    synth.speak(utt);
  }
}

function stopAudio(audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  window.speechSynthesis?.cancel();
}

// Smooth spotlight: single div that animates between positions
function Spotlight({ rect, label }: { rect: HighlightRect; label?: string }) {
  const pad = { x: 10, y: 8 };
  const left = Math.max(228, rect.x - pad.x);
  const top = Math.max(60, rect.y - pad.y);
  const width = Math.min(window.innerWidth - left - 8, rect.width + pad.x * 2);
  const height = Math.min(window.innerHeight - top - 160, rect.height + pad.y * 2);
  const centerX = left + width / 2;

  return (
    <>
      {/* Clickable backdrop that blocks the overlay from receiving events outside the spotlight */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'all' }} onClick={e => e.stopPropagation()} />

      {/* Spotlight window — transparent with outward box-shadow creating the dark curtain */}
      <motion.div
        animate={{ left, top, width, height }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        style={{
          position: 'absolute',
          borderRadius: 10,
          boxShadow: '0 0 0 9999px rgba(8,13,26,0.78)',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        {/* Animated border */}
        <motion.div
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            position: 'absolute', inset: 0, borderRadius: 10,
            border: `2px solid ${BLUE}`,
            outline: '4px solid rgba(37,99,235,0.12)',
          }}
        />
        {/* Corner accents */}
        {[
          { top: -2, left: -2, borderTop: `3px solid ${BLUE}`, borderLeft: `3px solid ${BLUE}`, borderTopLeftRadius: 10 },
          { top: -2, right: -2, borderTop: `3px solid ${BLUE}`, borderRight: `3px solid ${BLUE}`, borderTopRightRadius: 10 },
          { bottom: -2, left: -2, borderBottom: `3px solid ${BLUE}`, borderLeft: `3px solid ${BLUE}`, borderBottomLeftRadius: 10 },
          { bottom: -2, right: -2, borderBottom: `3px solid ${BLUE}`, borderRight: `3px solid ${BLUE}`, borderBottomRightRadius: 10 },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: 14, height: 14, ...s }} />
        ))}
      </motion.div>

      {/* Label above spotlight */}
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.25 }}
          style={{
            position: 'absolute',
            left: centerX,
            top: Math.max(8, top - 34),
            transform: 'translateX(-50%)',
            zIndex: 10,
            background: BLUE,
            color: 'white',
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.3,
            padding: '4px 12px',
            borderRadius: 20,
            fontFamily: 'Inter, sans-serif',
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            boxShadow: '0 2px 8px rgba(37,99,235,0.4)',
          }}
        >
          ↑ {label}
        </motion.div>
      )}
    </>
  );
}

export default function GuidedOverlay() {
  const { store, currentStep, nextStep, prevStep, exitTour, setHighlight } = useGuidedExperience();
  const navigate = useNavigate();
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasSpokenRef = useRef<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Navigate + find target on step change
  useEffect(() => {
    if (!store.active || !currentStep) return;

    if (currentStep.route && location.pathname !== currentStep.route) {
      navigate(currentStep.route);
    }

    if (!currentStep.target) { setHighlight(null); return; }

    setHighlight(null);
    const tryFind = (delay: number) => setTimeout(() => {
      const el = document.querySelector(`[data-ada-target="${currentStep.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        if (r.width > 20 && r.height > 10) {
          setHighlight({ x: r.left, y: r.top, width: r.width, height: r.height });
        }
      }
    }, delay);

    const t1 = tryFind(250);
    const t2 = tryFind(900);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.active, store.stepIndex, currentStep?.id]);

  // TTS on step change
  useEffect(() => {
    if (!store.active || !currentStep) return;
    if (hasSpokenRef.current === currentStep.id) return;
    hasSpokenRef.current = currentStep.id;
    stopAudio(audioRef);
    setIsSpeaking(false);
    speakStep(
      currentStep.speech,
      audioRef,
      () => setIsSpeaking(true),
      () => setIsSpeaking(false)
    );
    return () => stopAudio(audioRef);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.active, currentStep?.id]);

  // Cleanup on exit
  useEffect(() => {
    if (!store.active) { stopAudio(audioRef); hasSpokenRef.current = null; setIsSpeaking(false); }
  }, [store.active]);

  // Keyboard navigation
  useEffect(() => {
    if (!store.active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') { stopAudio(audioRef); hasSpokenRef.current = null; nextStep(); }
      if (e.key === 'ArrowLeft') { stopAudio(audioRef); hasSpokenRef.current = null; prevStep(); }
      if (e.key === 'Escape') { stopAudio(audioRef); exitTour(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store.active, nextStep, prevStep, exitTour]);

  const handleExit = useCallback(() => { stopAudio(audioRef); setIsSpeaking(false); exitTour(); }, [exitTour]);
  const handleNext = useCallback(() => { stopAudio(audioRef); setIsSpeaking(false); hasSpokenRef.current = null; nextStep(); }, [nextStep]);
  const handlePrev = useCallback(() => { stopAudio(audioRef); setIsSpeaking(false); hasSpokenRef.current = null; prevStep(); }, [prevStep]);

  if (!store.active || !currentStep || !store.tour) return null;

  const totalSteps = store.tour.steps.length;
  const { highlightRect } = store;
  const isFirst = store.stepIndex === 0;
  const isLast = store.stepIndex === totalSteps - 1;

  return (
    <AnimatePresence>
      {store.active && (
        <motion.div
          key="guided-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'none' }}
        >
          {/* When no target: full dark overlay */}
          {!highlightRect && (
            <div
              style={{ position: 'absolute', inset: 0, background: 'rgba(8,13,26,0.78)', pointerEvents: 'all' }}
              onClick={e => e.stopPropagation()}
            />
          )}

          {/* Spotlight (only when target exists) */}
          {highlightRect && (
            <Spotlight rect={highlightRect} label={currentStep.targetLabel} />
          )}

          {/* Progress bar — thin line at very top */}
          <motion.div
            animate={{ width: `${((store.stepIndex + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ position: 'absolute', top: 0, left: 0, height: 2, background: BLUE, zIndex: 20, pointerEvents: 'none' }}
          />

          {/* Top bar */}
          <div style={{
            position: 'absolute', top: 12, left: 0, right: 0, zIndex: 20,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10,
            pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(8,13,26,0.7)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '5px 14px', borderRadius: 20,
              fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
              fontFamily: 'Inter, sans-serif', letterSpacing: 0.3,
            }}>
              {store.tour.name}
            </div>
            <button
              onClick={handleExit}
              style={{
                width: 30, height: 30, borderRadius: 8, pointerEvents: 'all',
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.5)',
              }}
            >
              <X size={13} />
            </button>
          </div>

          {/* Ada + speech bubble — always bottom-center */}
          <motion.div
            key={`bubble-${currentStep.id}`}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            style={{
              position: 'absolute',
              bottom: 28,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 500,
              maxWidth: 'calc(100vw - 48px)',
              background: 'white',
              borderRadius: 20,
              boxShadow: '0 24px 64px rgba(8,13,26,0.45), 0 4px 16px rgba(8,13,26,0.2)',
              border: '1px solid rgba(255,255,255,0.9)',
              zIndex: 15,
              pointerEvents: 'all',
              fontFamily: 'Inter, sans-serif',
              overflow: 'hidden',
            }}
          >
            {/* Subtle top accent */}
            <div style={{ height: 3, background: `linear-gradient(to right, ${BLUE}, #7C3AED)` }} />

            <div style={{ padding: '18px 20px 16px' }}>
              {/* Step pills */}
              <div style={{ display: 'flex', gap: 4, justifyContent: 'center', marginBottom: 16, alignItems: 'center' }}>
                {Array.from({ length: totalSteps }, (_, i) => (
                  <motion.div
                    key={i}
                    animate={{
                      width: i === store.stepIndex ? 22 : 6,
                      background: i < store.stepIndex ? BLUE : i === store.stepIndex ? BLUE : '#E2E8F0',
                      opacity: i > store.stepIndex ? 0.45 : 1,
                    }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                    style={{ height: 6, borderRadius: 3, flexShrink: 0 }}
                  />
                ))}
              </div>

              {/* Ada avatar + speech */}
              <div style={{ display: 'flex', gap: 13, alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: '50%', overflow: 'hidden',
                    border: `2px solid ${isSpeaking ? BLUE : '#E2E8F0'}`,
                    boxShadow: isSpeaking ? `0 0 0 3px rgba(37,99,235,0.15)` : 'none',
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
                  </div>
                  {/* Speaking wave dots */}
                  {isSpeaking && (
                    <div style={{
                      position: 'absolute', bottom: -2, right: -2,
                      background: BLUE, borderRadius: 10, padding: '2px 5px',
                      display: 'flex', gap: 2, alignItems: 'center',
                      border: '2px solid white',
                    }}>
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ scaleY: [0.4, 1, 0.4] }}
                          transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                          style={{ width: 2, height: 6, background: 'white', borderRadius: 1 }}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <p style={{ margin: 0, fontSize: 13.5, color: '#1F2937', lineHeight: 1.7, flex: 1, fontWeight: 400 }}>
                  {currentStep.speech}
                </p>
              </div>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: 14 }}>
                <button
                  onClick={handlePrev}
                  disabled={isFirst}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    padding: '7px 14px', borderRadius: 8, border: '1px solid #E2E8F0',
                    background: 'white', color: isFirst ? '#D1D5DB' : '#6B7280',
                    cursor: isFirst ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
                    fontFamily: 'Inter, sans-serif',
                  }}
                >
                  <ChevronLeft size={13} /> Back
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10.5, color: '#CBD5E1', fontFamily: 'Inter, sans-serif' }}>
                    ← → to navigate · Esc to exit
                  </span>
                </div>

                <button
                  onClick={handleNext}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '7px 18px', borderRadius: 8, border: 'none',
                    background: isLast ? DARK : BLUE,
                    color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                    fontFamily: 'Inter, sans-serif',
                    boxShadow: isLast ? '0 2px 8px rgba(8,13,26,0.35)' : '0 2px 10px rgba(37,99,235,0.4)',
                  }}
                >
                  {isLast ? 'Finish tour' : 'Next'} {!isLast && <ChevronRight size={13} />}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
