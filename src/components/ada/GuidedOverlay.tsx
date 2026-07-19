import React, { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, ChevronLeft, ChevronRight, Send, Radio } from 'lucide-react';
import { useGuidedExperience, HighlightRect } from '../../ada/GuidedExperienceContext';
import { adaApi } from '../../services/api';
import { speakText } from '../../services/tts';

const BLUE = '#2463EB';
const DARK = '#0C1128';
const PURPLE = '#7C3AED';

function stopAudio(audioRef: React.MutableRefObject<HTMLAudioElement | null>) {
  if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
  window.speechSynthesis?.cancel();
}

// ─── Physical Ada Position ──────────────────────────────────────────────────
// Ada travels to stand beside the spotlight target. She avoids covering the
// element by sitting to its left (or right when near the left edge).

function getAdaPos(rect: HighlightRect | null, size: number = 56): { x: number; y: number } {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const SIDEBAR = 228;
  const BUBBLE_H = 240;

  if (!rect) {
    return {
      x: W / 2 - size / 2,
      y: H - BUBBLE_H - size - 32,
    };
  }

  const spCenterY = rect.y + rect.height / 2;
  const goLeft = (rect.x + rect.width / 2) > (W * 0.55);

  const x = goLeft
    ? Math.max(SIDEBAR + 8, rect.x - size - 20)
    : Math.min(W - size - 8, rect.x + rect.width + 20);

  const y = Math.max(60, Math.min(H - BUBBLE_H - size - 16, spCenterY - size / 2));

  return { x, y };
}

// ─── Spotlight ──────────────────────────────────────────────────────────────

function Spotlight({ rect, label }: { rect: HighlightRect; label?: string }) {
  const pad = { x: 10, y: 8 };
  const left = Math.max(228, rect.x - pad.x);
  const top = Math.max(56, rect.y - pad.y);
  const width = Math.min(window.innerWidth - left - 8, rect.width + pad.x * 2);
  const height = Math.min(window.innerHeight - top - 200, rect.height + pad.y * 2);
  const centerX = left + width / 2;

  return (
    <>
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'all' }} onClick={e => e.stopPropagation()} />
      <motion.div
        animate={{ left, top, width, height }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ position: 'absolute', borderRadius: 10, boxShadow: '0 0 0 9999px rgba(8,13,26,0.82)', zIndex: 2, pointerEvents: 'none' }}
      >
        <motion.div
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', inset: 0, borderRadius: 10, border: `2px solid ${BLUE}`, outline: '4px solid rgba(37,99,235,0.1)' }}
        />
        {[
          { top: -2, left: -2, borderTop: `3px solid ${BLUE}`, borderLeft: `3px solid ${BLUE}`, borderTopLeftRadius: 10 },
          { top: -2, right: -2, borderTop: `3px solid ${BLUE}`, borderRight: `3px solid ${BLUE}`, borderTopRightRadius: 10 },
          { bottom: -2, left: -2, borderBottom: `3px solid ${BLUE}`, borderLeft: `3px solid ${BLUE}`, borderBottomLeftRadius: 10 },
          { bottom: -2, right: -2, borderBottom: `3px solid ${BLUE}`, borderRight: `3px solid ${BLUE}`, borderBottomRightRadius: 10 },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: 14, height: 14, ...s }} />
        ))}
      </motion.div>

      {label && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.25 }}
          style={{
            position: 'absolute', left: centerX, top: Math.max(8, top - 36),
            transform: 'translateX(-50%)', zIndex: 10,
            background: BLUE, color: 'white', fontSize: 10.5, fontWeight: 700,
            letterSpacing: 0.4, padding: '4px 12px', borderRadius: 20,
            fontFamily: 'Inter, sans-serif', pointerEvents: 'none', whiteSpace: 'nowrap',
            boxShadow: '0 2px 10px rgba(37,99,235,0.45)',
          }}
        >
          ↑ {label}
        </motion.div>
      )}
    </>
  );
}

// ─── Physical Ada Avatar ────────────────────────────────────────────────────

const ADA_FULL = 56;
const ADA_PEA = 22;

function AdaAvatar({ rect, isSpeaking }: { rect: HighlightRect | null; isSpeaking: boolean }) {
  const isPea = !!rect;
  const size = isPea ? ADA_PEA : ADA_FULL;
  const pos = getAdaPos(rect, size);

  return (
    <motion.div
      animate={{ left: pos.x, top: pos.y, width: size, height: size }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{ position: 'absolute', zIndex: 12, pointerEvents: 'none' }}
    >
      {/* Ambient glow — only at full size */}
      <AnimatePresence>
        {isSpeaking && !isPea && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.18, 1] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: -10, borderRadius: '50%',
              background: `radial-gradient(circle, rgba(37,99,235,0.35) 0%, transparent 70%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* Avatar circle */}
      <motion.div
        animate={{ scale: isSpeaking && !isPea ? [1, 1.04, 1] : 1 }}
        transition={{ duration: 1.2, repeat: isSpeaking && !isPea ? Infinity : 0, ease: 'easeInOut' }}
        style={{
          width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
          border: `${isPea ? 1.5 : 2.5}px solid ${isSpeaking ? BLUE : 'rgba(255,255,255,0.3)'}`,
          boxShadow: isSpeaking && !isPea
            ? `0 0 0 3px rgba(37,99,235,0.2), 0 8px 24px rgba(8,13,26,0.5)`
            : '0 4px 16px rgba(8,13,26,0.4)',
          transition: 'border-color 0.3s',
        }}
      >
        <img
          src="/ada-avatar.jpg"
          alt="Ada"
          style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }}
        />
      </motion.div>

      {/* Speaking bars badge — only at full size */}
      <AnimatePresence>
        {isSpeaking && !isPea && (
          <motion.div
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            style={{
              position: 'absolute', bottom: -2, right: -2,
              background: BLUE, borderRadius: 10, padding: '3px 6px',
              display: 'flex', gap: 2, alignItems: 'center',
              border: '2px solid rgba(8,13,26,0.8)',
            }}
          >
            {[0, 1, 2].map(i => (
              <motion.div
                key={i}
                animate={{ scaleY: [0.3, 1, 0.3] }}
                transition={{ duration: 0.55, repeat: Infinity, delay: i * 0.12, ease: 'easeInOut' }}
                style={{ width: 2.5, height: 7, background: 'white', borderRadius: 1.5 }}
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function GuidedOverlay() {
  const { store, currentStep, nextStep, prevStep, exitTour, setHighlight, beginQA, resolveQA, dismissQA } = useGuidedExperience();
  const navigate = useNavigate();
  const location = useLocation();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasSpokenRef = useRef<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [question, setQuestion] = useState('');
  const [isLoadingAnswer, setIsLoadingAnswer] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDemo = store.mode === 'demo';
  const isDemoIntroStep = isDemo && currentStep?.id?.startsWith('demo-');

  // Measure a target element and update highlight rect
  const measureTarget = useCallback((target: string) => {
    const el = document.querySelector(`[data-ada-target="${target}"]`);
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.width > 20 && r.height > 10) {
        setHighlight({ x: r.left, y: r.top, width: r.width, height: r.height });
        return true;
      }
    }
    return false;
  }, [setHighlight]);

  // Navigate + find target on step change
  useEffect(() => {
    if (!store.active || !currentStep) return;
    if (currentStep.route && location.pathname !== currentStep.route) {
      navigate(currentStep.route);
    }
    if (!currentStep.target) { setHighlight(null); return; }

    setHighlight(null);
    const t1 = setTimeout(() => measureTarget(currentStep.target!), 280);
    const t2 = setTimeout(() => measureTarget(currentStep.target!), 1000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.active, store.stepIndex, currentStep?.id]);

  // Re-measure on scroll/resize so spotlight tracks the element
  useEffect(() => {
    if (!store.active || !currentStep?.target) return;
    const refresh = () => measureTarget(currentStep.target!);
    window.addEventListener('scroll', refresh, { passive: true, capture: true });
    window.addEventListener('resize', refresh, { passive: true });
    return () => {
      window.removeEventListener('scroll', refresh, true);
      window.removeEventListener('resize', refresh);
    };
  }, [store.active, currentStep?.target, measureTarget]);

  // TTS on step change (skip if answering a question)
  useEffect(() => {
    if (!store.active || !currentStep || store.isAnswering) return;
    if (store.currentAnswer) return; // bubble showing Q&A answer
    if (hasSpokenRef.current === currentStep.id) return;
    hasSpokenRef.current = currentStep.id;
    stopAudio(audioRef);
    setIsSpeaking(false);
    speakText(currentStep.speech, audioRef, () => setIsSpeaking(true), () => setIsSpeaking(false));
    return () => stopAudio(audioRef);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.active, currentStep?.id, store.isAnswering, store.currentAnswer]);

  // Cleanup on exit
  useEffect(() => {
    if (!store.active) { stopAudio(audioRef); hasSpokenRef.current = null; setIsSpeaking(false); setQuestion(''); }
  }, [store.active]);

  // Keyboard navigation (disabled when typing in Q&A input)
  useEffect(() => {
    if (!store.active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target === inputRef.current) return; // let input handle its own keys
      if (e.key === 'ArrowRight' || (e.key === 'Enter' && !store.currentAnswer && !store.isAnswering)) {
        stopAudio(audioRef); hasSpokenRef.current = null; nextStep();
      }
      if (e.key === 'ArrowLeft') { stopAudio(audioRef); hasSpokenRef.current = null; prevStep(); }
      if (e.key === 'Escape') { stopAudio(audioRef); exitTour(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [store.active, store.currentAnswer, store.isAnswering, nextStep, prevStep, exitTour]);

  const handleExit = useCallback(() => { stopAudio(audioRef); setIsSpeaking(false); exitTour(); }, [exitTour]);
  const handleNext = useCallback(() => {
    stopAudio(audioRef); setIsSpeaking(false); hasSpokenRef.current = null;
    dismissQA(); setQuestion(''); nextStep();
  }, [nextStep, dismissQA]);
  const handlePrev = useCallback(() => {
    stopAudio(audioRef); setIsSpeaking(false); hasSpokenRef.current = null;
    dismissQA(); setQuestion(''); prevStep();
  }, [prevStep, dismissQA]);
  const handleResume = useCallback(() => {
    stopAudio(audioRef); setIsSpeaking(false);
    // Re-speak the current step after dismissing Q&A
    hasSpokenRef.current = null;
    dismissQA(); setQuestion('');
  }, [dismissQA]);

  const handleAskQuestion = useCallback(async () => {
    const q = question.trim();
    if (!q || isLoadingAnswer || !currentStep) return;
    setQuestion('');
    stopAudio(audioRef); setIsSpeaking(false);
    beginQA(q);
    setIsLoadingAnswer(true);
    try {
      const res = await adaApi.chat(q, currentStep.route ?? 'overview', {
        context: `The user is in a guided ${store.mode} tour: "${store.tour?.name}". Currently on step: "${currentStep.id}". The step is about: "${currentStep.speech.slice(0, 120)}..."`,
      });
      const answer: string = res.data?.reply || res.data?.message || "I'm not able to answer that right now, but let's continue and I can help you explore it further.";
      resolveQA(answer);
      speakText(answer, audioRef, () => setIsSpeaking(true), () => setIsSpeaking(false));
    } catch {
      const fallback = "I wasn't able to reach my knowledge base right now. Let's continue — you can ask me again from the chat panel.";
      resolveQA(fallback);
      speakText(fallback, audioRef, () => setIsSpeaking(true), () => setIsSpeaking(false));
    } finally {
      setIsLoadingAnswer(false);
    }
  }, [question, isLoadingAnswer, currentStep, store.mode, store.tour, beginQA, resolveQA]);

  if (!store.active || !currentStep || !store.tour) return null;

  const totalSteps = store.steps.length;
  const { highlightRect } = store;
  const isFirst = store.stepIndex === 0;
  const isLast = store.stepIndex === totalSteps - 1;
  const showQAAnswer = !!store.currentAnswer;
  const showQALoading = store.isAnswering && !store.currentAnswer;

  return (
    <AnimatePresence>
      {store.active && (
        <motion.div
          key="guided-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.32 }}
          style={{ position: 'fixed', inset: 0, zIndex: 2000, pointerEvents: 'none' }}
        >
          {/* Dark curtain (no spotlight) */}
          {!highlightRect && (
            <div
              style={{ position: 'absolute', inset: 0, background: 'rgba(8,13,26,0.82)', pointerEvents: 'all' }}
              onClick={e => e.stopPropagation()}
            />
          )}

          {/* Spotlight */}
          {highlightRect && <Spotlight rect={highlightRect} label={currentStep.targetLabel} />}

          {/* Progress bar */}
          <motion.div
            animate={{ width: `${((store.stepIndex + 1) / totalSteps) * 100}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ position: 'absolute', top: 0, left: 0, height: 2, background: `linear-gradient(to right, ${BLUE}, ${PURPLE})`, zIndex: 20, pointerEvents: 'none' }}
          />

          {/* Top bar */}
          <div style={{
            position: 'absolute', top: 12, left: 0, right: 0, zIndex: 20,
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8,
            pointerEvents: 'none',
          }}>
            {isDemo && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 20, padding: '5px 12px',
              }}>
                <motion.div
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.4, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }}
                />
                <span style={{ fontSize: 10, fontWeight: 700, color: '#FCA5A5', letterSpacing: 1, fontFamily: 'Inter, sans-serif', textTransform: 'uppercase' }}>
                  Live Demonstration
                </span>
              </div>
            )}
            <div style={{
              background: 'rgba(8,13,26,0.72)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.08)', padding: '5px 14px', borderRadius: 20,
              fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.5)',
              fontFamily: 'Inter, sans-serif', letterSpacing: 0.3,
            }}>
              {isDemoIntroStep ? store.tour.name : `${store.tour.name} · ${store.stepIndex + 1} of ${totalSteps}`}
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

          {/* Physical Ada avatar — travels independently to stand beside elements */}
          <AdaAvatar rect={highlightRect} isSpeaking={isSpeaking} />

          {/* Speech bubble — bottom-left, clear of main content */}
          <motion.div
            key={`bubble-${currentStep.id}-${showQAAnswer ? 'qa' : 'step'}`}
            initial={{ opacity: 0, y: 20, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
            style={{
              position: 'absolute', bottom: 20, left: 240,
              width: 420, maxWidth: 'calc(100vw - 260px)',
              background: 'white', borderRadius: 20,
              boxShadow: '0 28px 72px rgba(8,13,26,0.5), 0 4px 16px rgba(8,13,26,0.2)',
              border: '1px solid rgba(255,255,255,0.92)',
              zIndex: 15, pointerEvents: 'all', fontFamily: 'Inter, sans-serif', overflow: 'hidden',
            }}
          >
            {/* Gradient accent */}
            <div style={{ height: 3, background: `linear-gradient(to right, ${BLUE}, ${PURPLE})` }} />

            <div style={{ padding: '16px 20px 14px' }}>
              {/* Step progress pills */}
              {!isDemoIntroStep && (
                <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginBottom: 14, alignItems: 'center' }}>
                  {Array.from({ length: totalSteps }, (_, i) => (
                    <motion.div
                      key={i}
                      animate={{
                        width: i === store.stepIndex ? 20 : 5,
                        background: i <= store.stepIndex ? BLUE : '#E2E8F0',
                        opacity: i > store.stepIndex ? 0.4 : 1,
                      }}
                      transition={{ duration: 0.26, ease: 'easeOut' }}
                      style={{ height: 5, borderRadius: 3, flexShrink: 0 }}
                    />
                  ))}
                </div>
              )}

              {/* === Q&A Answer state === */}
              {showQAAnswer && (
                <div>
                  {/* User question */}
                  <div style={{
                    background: '#F0F4FF', border: '1px solid #DBEAFE',
                    borderRadius: '12px 12px 4px 12px', padding: '8px 12px',
                    marginBottom: 8, marginLeft: 32,
                  }}>
                    <div style={{ fontSize: 12, color: '#1E40AF', fontWeight: 600, marginBottom: 2 }}>You asked</div>
                    <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.5 }}>{store.currentQuestion}</div>
                  </div>

                  {/* Ada answer */}
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 14 }}>
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                      border: `2px solid ${isSpeaking ? BLUE : '#E2E8F0'}`,
                      boxShadow: isSpeaking ? `0 0 0 3px rgba(37,99,235,0.12)` : 'none',
                      transition: 'all 0.2s',
                    }}>
                      <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
                    </div>
                    <div style={{
                      flex: 1, background: '#F8FAFF', border: '1px solid #E8EDF5',
                      borderRadius: '4px 12px 12px 12px', padding: '10px 12px',
                      fontSize: 13, color: '#1F2937', lineHeight: 1.65,
                    }}>
                      {store.currentAnswer}
                    </div>
                  </div>

                  <button
                    onClick={handleResume}
                    style={{
                      width: '100%', padding: '9px', borderRadius: 10, border: 'none',
                      background: `linear-gradient(135deg, ${BLUE}, #1D4ED8)`,
                      color: 'white', fontSize: 12.5, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'Inter, sans-serif',
                      boxShadow: '0 2px 10px rgba(37,99,235,0.35)',
                    }}
                  >
                    Continue tour ›
                  </button>
                </div>
              )}

              {/* === Loading Q&A state === */}
              {showQALoading && (
                <div style={{ padding: '8px 0 16px' }}>
                  <div style={{
                    background: '#F0F4FF', border: '1px solid #DBEAFE',
                    borderRadius: '12px 12px 4px 12px', padding: '8px 12px',
                    marginBottom: 10, marginLeft: 32,
                  }}>
                    <div style={{ fontSize: 12.5, color: '#374151' }}>{store.currentQuestion}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 26, height: 26, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2px solid ${BLUE}` }}>
                      <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      {[0, 1, 2].map(i => (
                        <motion.div
                          key={i}
                          animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                          transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18 }}
                          style={{ width: 7, height: 7, borderRadius: '50%', background: BLUE }}
                        />
                      ))}
                      <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 6 }}>Thinking...</span>
                    </div>
                  </div>
                </div>
              )}

              {/* === Normal step speech === */}
              {!showQAAnswer && !showQALoading && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 14 }}>
                  <div style={{ fontSize: 13.5, color: '#1F2937', lineHeight: 1.72, flex: 1, fontWeight: 400 }}>
                    {currentStep.speech}
                  </div>
                </div>
              )}

              {/* === Q&A input (always shown unless actively answering) === */}
              {!showQALoading && (
                <div style={{
                  display: 'flex', gap: 6, alignItems: 'center',
                  background: '#F8FAFF', border: '1px solid #E2E8F0',
                  borderRadius: 10, padding: '6px 8px', marginBottom: 12,
                }}>
                  {isDemo && <Radio size={12} color={BLUE} style={{ flexShrink: 0 }} />}
                  <input
                    ref={inputRef}
                    value={question}
                    onChange={e => setQuestion(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAskQuestion(); } }}
                    placeholder={isDemo ? 'Anyone can ask Ada a question…' : 'Ask Ada a question…'}
                    style={{
                      flex: 1, border: 'none', background: 'transparent', outline: 'none',
                      fontSize: 12, color: '#374151', fontFamily: 'Inter, sans-serif',
                    }}
                  />
                  <button
                    onClick={handleAskQuestion}
                    disabled={!question.trim() || isLoadingAnswer}
                    style={{
                      width: 26, height: 26, borderRadius: 7, border: 'none',
                      background: question.trim() ? BLUE : '#E2E8F0',
                      cursor: question.trim() ? 'pointer' : 'default',
                      display: 'grid', placeItems: 'center', flexShrink: 0,
                      transition: 'background 0.15s',
                    }}
                  >
                    <Send size={11} color="white" />
                  </button>
                </div>
              )}

              {/* Navigation controls */}
              {!showQAAnswer && !showQALoading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid #F1F5F9', paddingTop: 12 }}>
                  <button
                    onClick={handlePrev}
                    disabled={isFirst}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 4, padding: '7px 14px',
                      borderRadius: 8, border: '1px solid #E2E8F0', background: 'white',
                      color: isFirst ? '#D1D5DB' : '#6B7280', cursor: isFirst ? 'default' : 'pointer',
                      fontSize: 12, fontWeight: 600, fontFamily: 'Inter, sans-serif',
                    }}
                  >
                    <ChevronLeft size={13} /> Back
                  </button>

                  <span style={{ fontSize: 10, color: '#D1D5DB', fontFamily: 'Inter, sans-serif' }}>
                    ← → navigate · Esc exit
                  </span>

                  <button
                    onClick={handleNext}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '7px 18px', borderRadius: 8, border: 'none',
                      background: isLast ? DARK : BLUE, color: 'white',
                      cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      fontFamily: 'Inter, sans-serif',
                      boxShadow: isLast ? '0 2px 8px rgba(8,13,26,0.3)' : '0 2px 10px rgba(37,99,235,0.38)',
                    }}
                  >
                    {isLast ? 'Finish' : 'Next'} {!isLast && <ChevronRight size={13} />}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
