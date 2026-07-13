import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Radio, Video } from 'lucide-react';
import { adaApi } from '../services/api';

const BLUE = '#2463EB';
const DARK = '#0C1128';

const XI_KEY = process.env.REACT_APP_ELEVENLABS_KEY || '';
const XI_VOICE_ID = process.env.REACT_APP_ELEVENLABS_VOICE_ID || 'jBpfuIE2acCO8z3wKNLl';

async function speakText(
  text: string,
  audioRef: React.MutableRefObject<HTMLAudioElement | null>,
  onStart?: () => void,
  onEnd?: () => void,
): Promise<void> {
  const clean = text.replace(/\n/g, ' ').trim();
  if (!clean) { onEnd?.(); return; }
  onStart?.();

  const stopPrev = () => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; } };

  const playBlob = (blob: Blob): Promise<boolean> =>
    new Promise(resolve => {
      try {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); audioRef.current = null; onEnd?.(); resolve(true); };
        audio.onerror = () => { URL.revokeObjectURL(url); audioRef.current = null; resolve(false); };
        audio.play().catch(() => resolve(false));
      } catch { resolve(false); }
    });

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
      if (res.ok && await playBlob(await res.blob())) return;
    } catch { /* fall through */ }
  }

  // Web Speech API fallback (uses Google TTS in Chrome)
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

interface Message {
  id: string;
  role: 'user' | 'ada';
  text: string;
  timestamp: Date;
}

const INTRO_MESSAGE = "Good afternoon. I'm Ada — the AI Research Partner inside ResearchOS. FieldScore is what brought you here today, and rightly so — it's the verification and trust scoring engine at the core of everything. What I'd love to do is show you the full picture around it: live field monitoring, enumerator performance, AI-driven analysis, and reporting — all connected. But first, what's the specific challenge on your mind? I'd rather start with what matters to you than walk through slides.";

export default function MeetingAdaPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const addMessage = useCallback((role: 'user' | 'ada', text: string) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role, text,
      timestamp: new Date(),
    }]);
  }, []);

  const handleStart = useCallback(() => {
    setHasStarted(true);
    addMessage('ada', INTRO_MESSAGE);
    speakText(INTRO_MESSAGE, audioRef, () => setIsSpeaking(true), () => setIsSpeaking(false));
  }, [addMessage]);

  const handleSend = useCallback(async () => {
    const q = input.trim();
    if (!q || isLoading) return;
    setInput('');
    addMessage('user', q);
    setIsLoading(true);

    try {
      const res = await adaApi.chat(q, 'overview', {
        context: 'Ada is in a live meeting with Tayo Salami (Country Manager, Nigeria) and Alexan Carrilo (Regional Ops Director, Sub-Saharan Africa) from Ipsos. Ada is the AI Research Partner for ResearchOS. She should speak to senior research operations leaders — confident, specific, no fluff. She understands the pressures of managing field quality across Sub-Saharan Africa: enumerator consistency, GPS verification, interview fabrication, client confidence. Keep answers to 2-3 sentences unless a longer answer is clearly warranted. Warm but direct.',
      });
      const answer: string = res.data?.reply || res.data?.message || "That's a great question. Let me come back to that — I want to make sure I give you the most accurate answer.";
      addMessage('ada', answer);
      speakText(answer, audioRef, () => setIsSpeaking(true), () => setIsSpeaking(false));
    } catch {
      const fallback = "I wasn't able to reach my knowledge base right now — please bear with me. Let's continue and I'll circle back to your question.";
      addMessage('ada', fallback);
      speakText(fallback, audioRef, () => setIsSpeaking(true), () => setIsSpeaking(false));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, addMessage]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div style={{
      minHeight: '100vh', background: DARK,
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: 'white', letterSpacing: -0.4 }}>researchOS</div>
          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.12)' }} />
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>Meeting Mode</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: '#EF4444' }}
          />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#FCA5A5', letterSpacing: 1 }}>LIVE</span>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Ada Panel — left column */}
        <div style={{
          width: 380, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '40px 32px', gap: 24,
        }}>
          {/* Avatar */}
          <div style={{ position: 'relative' }}>
            <AnimatePresence>
              {isSpeaking && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.15, 1] }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                  style={{
                    position: 'absolute', inset: -18, borderRadius: '50%',
                    background: `radial-gradient(circle, rgba(37,99,235,0.4) 0%, transparent 70%)`,
                  }}
                />
              )}
            </AnimatePresence>
            <motion.div
              animate={isSpeaking ? { scale: [1, 1.03, 1] } : { scale: 1 }}
              transition={{ duration: 1.2, repeat: isSpeaking ? Infinity : 0, ease: 'easeInOut' }}
              style={{
                width: 160, height: 160, borderRadius: '50%', overflow: 'hidden',
                border: `3px solid ${isSpeaking ? BLUE : 'rgba(255,255,255,0.15)'}`,
                boxShadow: isSpeaking
                  ? `0 0 0 6px rgba(37,99,235,0.2), 0 24px 60px rgba(8,13,26,0.6)`
                  : '0 12px 40px rgba(8,13,26,0.5)',
                transition: 'border-color 0.3s',
              }}
            >
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
            </motion.div>

            {/* Speaking indicator */}
            <AnimatePresence>
              {isSpeaking && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  style={{
                    position: 'absolute', bottom: 4, right: 4,
                    background: BLUE, borderRadius: 16, padding: '5px 10px',
                    display: 'flex', gap: 3, alignItems: 'center',
                    border: '2px solid rgba(8,13,26,0.8)',
                  }}
                >
                  {[0, 1, 2, 3].map(i => (
                    <motion.div
                      key={i}
                      animate={{ scaleY: [0.3, 1, 0.3] }}
                      transition={{ duration: 0.55, repeat: Infinity, delay: i * 0.1, ease: 'easeInOut' }}
                      style={{ width: 3, height: 10, background: 'white', borderRadius: 2 }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: 'white', letterSpacing: -0.5, marginBottom: 6 }}>Ada</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>AI Research Partner · ResearchOS</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>Sub-Saharan Africa Field Intelligence</div>
          </div>

          {!hasStarted && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '12px 28px', borderRadius: 12, border: 'none',
                background: `linear-gradient(135deg, ${BLUE}, #1D4ED8)`,
                color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 20px rgba(37,99,235,0.45)',
              }}
            >
              <Radio size={16} />
              Begin Presentation
            </motion.button>
          )}

          {hasStarted && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(37,99,235,0.12)', border: '1px solid rgba(37,99,235,0.25)',
              borderRadius: 10, padding: '8px 16px',
            }}>
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: BLUE }}
              />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>
                {isSpeaking ? 'Ada is speaking...' : isLoading ? 'Ada is thinking...' : 'Ready for questions'}
              </span>
            </div>
          )}

          {/* Capability chips */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 8 }}>
            {[
              'Field quality monitoring, live',
              'Enumerator performance analysis',
              'Cross-country benchmarking',
              'Client-ready data confidence scoring',
            ].map(cap => (
              <div key={cap} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: '8px 12px',
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: BLUE, flexShrink: 0 }} />
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 500 }}>{cap}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Chat Panel — right column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Chat header */}
          <div style={{
            padding: '16px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Video size={14} color={BLUE} />
            <span style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', letterSpacing: 0.2 }}>
              Live Session
            </span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginLeft: 4 }}>
              · Anyone in the room can ask Ada a question
            </span>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {!hasStarted && (
              <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 14 }}>
                  Press "Begin Presentation" to start
                </div>
              </div>
            )}

            {messages.map(msg => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                style={{
                  display: 'flex',
                  flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                  gap: 10, alignItems: 'flex-start',
                }}
              >
                {msg.role === 'ada' && (
                  <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2px solid ${BLUE}` }}>
                    <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
                  </div>
                )}
                {msg.role === 'user' && (
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(255,255,255,0.1)', display: 'grid', placeItems: 'center',
                    fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.5)',
                  }}>Q</div>
                )}
                <div style={{
                  maxWidth: '75%',
                  background: msg.role === 'ada'
                    ? 'rgba(255,255,255,0.06)'
                    : `rgba(37,99,235,0.2)`,
                  border: `1px solid ${msg.role === 'ada' ? 'rgba(255,255,255,0.08)' : 'rgba(37,99,235,0.35)'}`,
                  borderRadius: msg.role === 'ada' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                  padding: '10px 14px',
                }}>
                  {msg.role === 'ada' && (
                    <div style={{ fontSize: 9.5, fontWeight: 700, color: BLUE, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 }}>Ada</div>
                  )}
                  <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.88)', lineHeight: 1.65 }}>{msg.text}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', marginTop: 5 }}>
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </motion.div>
            ))}

            {(isLoading) && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, border: `2px solid ${BLUE}` }}>
                  <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 15%' }} />
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '12px 14px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px 14px 14px 14px', border: '1px solid rgba(255,255,255,0.08)' }}>
                  {[0, 1, 2].map(i => (
                    <motion.div key={i}
                      animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1, 0.8] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
                      style={{ width: 8, height: 8, borderRadius: '50%', background: BLUE }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{
              display: 'flex', gap: 10, alignItems: 'center',
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 14, padding: '10px 12px',
            }}>
              <Radio size={14} color={BLUE} style={{ flexShrink: 0 }} />
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={hasStarted ? 'Ask Ada anything — visible to the whole room...' : 'Start the presentation first...'}
                disabled={!hasStarted}
                style={{
                  flex: 1, border: 'none', background: 'transparent', outline: 'none',
                  fontSize: 13.5, color: 'rgba(255,255,255,0.85)',
                  fontFamily: 'Inter, sans-serif',
                }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLoading || !hasStarted}
                style={{
                  width: 32, height: 32, borderRadius: 9, border: 'none',
                  background: input.trim() && hasStarted ? BLUE : 'rgba(255,255,255,0.08)',
                  cursor: input.trim() && hasStarted ? 'pointer' : 'default',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                  transition: 'background 0.15s',
                }}
              >
                <Send size={13} color="white" />
              </button>
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.2)', textAlign: 'center', marginTop: 8 }}>
              Share your screen · Tayo and Alexan can ask Ada anything directly
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
