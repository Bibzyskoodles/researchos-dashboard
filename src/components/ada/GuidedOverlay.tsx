import React, { useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { useGuidedExperience } from '../../ada/GuidedExperienceContext';

const BLUE = '#2463EB';
const DARK = '#0C1128';

// Speak text via OpenAI TTS or Web Speech fallback
async function speakStep(
  text: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onEnd?: () => void
): Promise<void> {
  const OAI_KEY = process.env.REACT_APP_OPENAI_KEY || '';
  const clean = text.replace(/\n/g, ' ').trim();
  if (!clean) { onEnd?.(); return; }

  if (OAI_KEY) {
    try {
      if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${OAI_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tts-1-hd', input: clean, voice: 'nova', speed: 1.0 }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd?.(); };
        audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd?.(); };
        await audio.play();
        return;
      }
    } catch { /* fall through */ }
  }

  // Web Speech fallback
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

export default function GuidedOverlay() {
  const { store, currentStep, nextStep, prevStep, exitTour, setHighlight } = useGuidedExperience();
  const navigate = useNavigate();
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasSpokenRef = useRef<string | null>(null);

  // Navigate and highlight when step changes
  useEffect(() => {
    if (!store.active || !currentStep) return;

    // Navigate to route if needed
    if (currentStep.route && location.pathname !== currentStep.route) {
      navigate(currentStep.route);
    }

    // Find and highlight target element
    const findTarget = () => {
      if (!currentStep.target) { setHighlight(null); return; }
      const el = document.querySelector(`[data-ada-target="${currentStep.target}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        setHighlight({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
      } else {
        setHighlight(null);
        // Retry after page renders
        const t = setTimeout(() => {
          const el2 = document.querySelector(`[data-ada-target="${currentStep.target}"]`);
          if (el2) {
            const rect2 = el2.getBoundingClientRect();
            setHighlight({ x: rect2.left, y: rect2.top, width: rect2.width, height: rect2.height });
          }
        }, 600);
        return () => clearTimeout(t);
      }
    };

    const cleanup = findTarget();
    return cleanup;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.active, store.stepIndex, currentStep?.id]);

  // Speak when step changes
  useEffect(() => {
    if (!store.active || !currentStep) return;
    if (hasSpokenRef.current === currentStep.id) return;
    hasSpokenRef.current = currentStep.id;
    stopAudio(audioRef);
    speakStep(currentStep.speech, audioRef, () => {});
    return () => stopAudio(audioRef);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.active, currentStep?.id]);

  // Stop audio on exit
  useEffect(() => {
    if (!store.active) { stopAudio(audioRef); hasSpokenRef.current = null; }
  }, [store.active]);

  const handleExit = useCallback(() => {
    stopAudio(audioRef);
    exitTour();
  }, [exitTour]);

  const handleNext = useCallback(() => {
    stopAudio(audioRef);
    hasSpokenRef.current = null;
    nextStep();
  }, [nextStep]);

  const handlePrev = useCallback(() => {
    stopAudio(audioRef);
    hasSpokenRef.current = null;
    prevStep();
  }, [prevStep]);

  if (!store.active || !currentStep || !store.tour) return null;

  const totalSteps = store.tour.steps.length;
  const progress = ((store.stepIndex + 1) / totalSteps) * 100;
  const { highlightRect } = store;

  // Compute Ada mini position relative to highlight
  const adaMiniX = highlightRect ? Math.max(16, highlightRect.x - 60) : 32;
  const adaMiniY = highlightRect
    ? Math.min(window.innerHeight - 160, highlightRect.y + highlightRect.height / 2 - 40)
    : window.innerHeight / 2 - 100;

  // Speech bubble position
  const bubbleX = highlightRect ? Math.min(window.innerWidth - 360, highlightRect.x + highlightRect.width + 16) : adaMiniX + 80;
  const bubbleY = Math.max(16, adaMiniY - 20);

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
          {/* Dark overlay */}
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(8,13,26,0.72)', pointerEvents: 'all' }} onClick={e => e.stopPropagation()} />

          {/* Spotlight cutout — rendered as a positioned div over the target */}
          {highlightRect && (
            <motion.div
              key={`spotlight-${currentStep.id}`}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              style={{
                position: 'absolute',
                left: Math.max(0, highlightRect.x - 12),
                top: Math.max(0, highlightRect.y - 12),
                width: highlightRect.width + 24,
                height: highlightRect.height + 24,
                borderRadius: 12,
                boxShadow: '0 0 0 9999px rgba(8,13,26,0.72)',
                border: `2px solid ${BLUE}`,
                outline: `6px solid rgba(37,99,235,0.18)`,
                pointerEvents: 'none',
                zIndex: 1,
              }}
            />
          )}

          {/* Progress bar */}
          <motion.div
            style={{ position: 'absolute', top: 0, left: 0, height: 3, background: BLUE, zIndex: 5, pointerEvents: 'none' }}
            initial={{ width: `${((store.stepIndex) / totalSteps) * 100}%` }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          />

          {/* Exit button */}
          <button
            onClick={handleExit}
            style={{
              position: 'absolute', top: 16, right: 16, zIndex: 10,
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
              cursor: 'pointer', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.7)',
              pointerEvents: 'all',
            }}
          >
            <X size={16} />
          </button>

          {/* Step counter */}
          <div style={{
            position: 'absolute', top: 18, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
            fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)',
            background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: 20,
            letterSpacing: 0.5, fontFamily: 'Inter, sans-serif', pointerEvents: 'none',
          }}>
            {store.tour.name} · {store.stepIndex + 1} of {totalSteps}
          </div>

          {/* Ada mini avatar — animated position */}
          {!highlightRect && (
            <motion.div
              key={`ada-${currentStep.id}`}
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
              style={{ position: 'absolute', left: 40, top: '50%', transform: 'translateY(-50%)', zIndex: 6, pointerEvents: 'none' }}
            >
              <div style={{ width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: `3px solid ${BLUE}`, boxShadow: '0 0 24px rgba(37,99,235,0.5)' }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
              </div>
            </motion.div>
          )}

          {/* Ada mini avatar near highlight */}
          {highlightRect && (
            <motion.div
              key={`ada-hl-${currentStep.id}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
              style={{ position: 'absolute', left: adaMiniX, top: adaMiniY, zIndex: 10, pointerEvents: 'none' }}
            >
              <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: `2.5px solid ${BLUE}`, boxShadow: '0 0 20px rgba(37,99,235,0.6)' }}>
                <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
              </div>
              <motion.div
                animate={{ scale: [0.95, 1.3], opacity: [0.6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
                style={{ position: 'absolute', inset: -4, borderRadius: '50%', border: `2px solid ${BLUE}`, pointerEvents: 'none' }}
              />
            </motion.div>
          )}

          {/* Speech bubble */}
          <motion.div
            key={`bubble-${currentStep.id}`}
            initial={{ opacity: 0, y: 16, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
            style={{
              position: 'absolute',
              left: highlightRect ? bubbleX : 108,
              top: highlightRect ? bubbleY : window.innerHeight / 2 - 120,
              maxWidth: 360,
              background: 'white',
              borderRadius: '6px 18px 18px 18px',
              padding: '16px 18px 14px',
              boxShadow: '0 16px 48px rgba(8,13,26,0.35), 0 2px 8px rgba(8,13,26,0.15)',
              border: '1px solid rgba(37,99,235,0.12)',
              zIndex: 8,
              pointerEvents: 'all',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <p style={{ margin: 0, fontSize: 13.5, color: '#1F2937', lineHeight: 1.65, fontWeight: 450 }}>
              {currentStep.speech}
            </p>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, justifyContent: 'space-between' }}>
              <button
                onClick={handlePrev}
                disabled={isFirst}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 12px', borderRadius: 8, border: '1px solid #E2E8F0',
                  background: 'white', color: isFirst ? '#CBD5E1' : '#6B7280',
                  cursor: isFirst ? 'default' : 'pointer', fontSize: 12, fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                <ChevronLeft size={13} /> Back
              </button>

              <button
                onClick={handleExit}
                style={{
                  padding: '6px 12px', borderRadius: 8, border: 'none',
                  background: 'none', color: '#9CA3AF', cursor: 'pointer',
                  fontSize: 11.5, fontFamily: 'Inter, sans-serif',
                }}
              >
                Exit tour
              </button>

              <button
                onClick={handleNext}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '6px 16px', borderRadius: 8, border: 'none',
                  background: isLast ? DARK : BLUE,
                  color: 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                  fontFamily: 'Inter, sans-serif',
                  boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                }}
              >
                {isLast ? 'Finish' : 'Next'} {!isLast && <ChevronRight size={13} />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
