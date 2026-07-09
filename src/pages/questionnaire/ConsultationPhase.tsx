import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { adaApi } from '../../services/api';
import { ConsultationState } from './types';

interface Message {
  role: 'ada' | 'user';
  text: string;
  timestamp: Date;
}

interface Props {
  onReady: (consultation: ConsultationState, brief: string) => void;
}

const BLUE = '#2463EB';
const DARK = '#080D1A';

const OPENING = "Before we design your questionnaire, I need to understand your research. Tell me — what decision will this data help you make?";

const CONSULTATION_SYSTEM = `You are Ada, a world-class research methodologist at ResearchOS. You are conducting a structured research consultation to gather everything needed to design an excellent questionnaire.

You must collect the following information through natural conversation (NOT as a list or form):
1. The decision the research will inform
2. The target audience / respondents
3. The interview context (where, how)
4. Duration constraint (how long per interview)
5. Language for the questionnaire
6. Data collection platform (KoboToolbox, SurveyCTO, ODK, Paper, etc.)
7. Respondent literacy level
8. Interview mode (face-to-face, phone, self-complete)
9. Sensitivity of topics

Ask one or two questions at a time. Follow up intelligently based on answers. For example, if the researcher says "rural household survey in Nigeria", ask about literacy levels and language. If they mention sensitive topics like income or health, acknowledge that and note you'll structure those carefully.

Once you have gathered enough information, end your response with the exact text: [READY_TO_GENERATE]

Also, after each of your responses, include a JSON block like this (hidden from display):
[STATE_UPDATE:{"decision":"...","audience":"...","context":"...","duration_mins":null,"language":"...","platform":"...","literacy_level":"high|medium|low|null","interview_mode":"face_to_face|phone|self_complete|null","sensitivity":"low|medium|high|null","ready_to_generate":false}]

Keep your tone warm, expert, and concise. You're a senior consultant, not a chatbot. Never ask more than 2 questions at once.`;

function parseStateUpdate(text: string): Partial<ConsultationState> | null {
  const match = text.match(/\[STATE_UPDATE:({.*?})\]/s);
  if (!match) return null;
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function cleanText(text: string): string {
  return text
    .replace(/\[STATE_UPDATE:.*?\]/gs, '')
    .replace(/\[READY_TO_GENERATE\]/g, '')
    .trim();
}

export default function ConsultationPhase({ onReady }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ada', text: OPENING, timestamp: new Date() }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [consultation, setConsultation] = useState<ConsultationState>({
    decision: null, audience: null, context: null, duration_mins: null,
    language: null, platform: null, literacy_level: null,
    interview_mode: null, sensitivity: null, ready_to_generate: false,
  });
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const buildBrief = useCallback((state: ConsultationState, msgs: Message[]): string => {
    const userMsgs = msgs.filter(m => m.role === 'user').map(m => m.text).join('\n');
    return `Research Brief:
Decision: ${state.decision || 'Not specified'}
Audience: ${state.audience || 'Not specified'}
Context: ${state.context || 'Not specified'}
Duration: ${state.duration_mins ? `${state.duration_mins} minutes` : 'Not specified'}
Language: ${state.language || 'Not specified'}
Platform: ${state.platform || 'Not specified'}
Literacy Level: ${state.literacy_level || 'Not specified'}
Interview Mode: ${state.interview_mode || 'Not specified'}
Sensitivity: ${state.sensitivity || 'Not specified'}

Researcher's own words:
${userMsgs}`;
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { role: 'user', text, timestamp: new Date() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setSending(true);

    try {
      const history = newMessages.map(m => ({
        role: m.role === 'ada' ? 'assistant' : 'user',
        content: m.text,
      }));

      const res = await adaApi.chat(text, 'questionnaire_consultation', {
        system_override: CONSULTATION_SYSTEM,
        history: history.slice(-10),
        consultation_state: consultation,
      });

      const rawResponse = res.data?.message || res.data?.response || '';
      const stateUpdate = parseStateUpdate(rawResponse);
      const cleaned = cleanText(rawResponse);
      const isReady = rawResponse.includes('[READY_TO_GENERATE]');

      const adaMsg: Message = { role: 'ada', text: cleaned, timestamp: new Date() };
      const finalMessages = [...newMessages, adaMsg];
      setMessages(finalMessages);

      let updatedConsultation = consultation;
      if (stateUpdate) {
        updatedConsultation = { ...consultation, ...stateUpdate } as ConsultationState;
        setConsultation(updatedConsultation);
      }

      if (isReady || updatedConsultation.ready_to_generate) {
        const brief = buildBrief(updatedConsultation, finalMessages);
        setTimeout(() => onReady(updatedConsultation, brief), 1200);
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'ada',
        text: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      }]);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, messages, consultation, buildBrief, onReady]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const progress = [
    consultation.decision, consultation.audience, consultation.context,
    consultation.language, consultation.platform,
  ].filter(Boolean).length;

  return (
    <div style={{
      minHeight: '100vh', background: DARK,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'flex-start', fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        width: '100%', maxWidth: 720, padding: '48px 24px 0',
      }}>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: 40 }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px', fontSize: 28,
          }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <h1 style={{ color: 'white', fontSize: 24, fontWeight: 700, margin: '0 0 8px' }}>
            Research Consultation
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14, margin: 0 }}>
            Ada will guide you through designing a rigorous questionnaire
          </p>
        </motion.div>

        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{
              flex: 1, height: 3, borderRadius: 2,
              background: i <= progress ? BLUE : 'rgba(255,255,255,0.1)',
              transition: 'background 0.4s',
            }} />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        width: '100%', maxWidth: 720, flex: 1,
        padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 16,
        overflowY: 'auto', paddingBottom: 160,
      }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 12, alignItems: 'flex-start',
              }}
            >
              {msg.role === 'ada' && (
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                  background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, overflow: 'hidden',
                }}>
                  <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <div style={{
                maxWidth: '75%',
                padding: '12px 16px',
                borderRadius: msg.role === 'ada' ? '4px 16px 16px 16px' : '16px 4px 16px 16px',
                background: msg.role === 'ada' ? 'rgba(255,255,255,0.07)' : BLUE,
                color: 'white',
                fontSize: 14,
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
              }}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{ display: 'flex', gap: 12, alignItems: 'center' }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
              overflow: 'hidden',
            }}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <div style={{
              padding: '12px 16px', borderRadius: '4px 16px 16px 16px',
              background: 'rgba(255,255,255,0.07)',
              display: 'flex', gap: 6, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                  style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }}
                />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, #080D1A 80%, transparent)',
        padding: '24px',
        display: 'flex', justifyContent: 'center',
      }}>
        <div style={{
          width: '100%', maxWidth: 720,
          display: 'flex', gap: 12, alignItems: 'flex-end',
        }}>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tell Ada about your research..."
            rows={1}
            style={{
              flex: 1, padding: '14px 16px',
              borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)',
              background: 'rgba(255,255,255,0.07)', color: 'white',
              fontSize: 14, fontFamily: 'Inter, sans-serif', resize: 'none',
              outline: 'none', lineHeight: 1.5, maxHeight: 120,
            }}
          />
          <motion.button
            onClick={send}
            disabled={!input.trim() || sending}
            whileTap={{ scale: 0.95 }}
            style={{
              width: 48, height: 48, borderRadius: 12, border: 'none',
              background: !input.trim() || sending ? 'rgba(255,255,255,0.1)' : BLUE,
              color: 'white', cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Send size={18} />
          </motion.button>
        </div>
      </div>
    </div>
  );
}
