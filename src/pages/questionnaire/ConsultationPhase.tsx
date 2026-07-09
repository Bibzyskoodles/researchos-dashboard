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
  try { return JSON.parse(match[1]); } catch { return null; }
}

function cleanText(text: string): string {
  return text
    .replace(/\[STATE_UPDATE:.*?\]/gs, '')
    .replace(/\[READY_TO_GENERATE\]/g, '')
    .trim();
}

const CONSULTATION_FIELDS = ['decision', 'audience', 'context', 'language', 'platform'];

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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const progress = CONSULTATION_FIELDS.filter(f => consultation[f as keyof ConsultationState]).length;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#F8FAFF', fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px 16px', borderBottom: '1px solid #E8EDF5',
        background: 'white', display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
        }}>
          <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>Ada — Research Consultant</div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>
            Helping you design a rigorous questionnaire
          </div>
        </div>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          {CONSULTATION_FIELDS.map((_, i) => (
            <div key={i} style={{
              width: 7, height: 7, borderRadius: '50%',
              background: i < progress ? BLUE : '#E5E7EB',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 10, alignItems: 'flex-start',
              }}
            >
              {msg.role === 'ada' && (
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                  overflow: 'hidden', background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
                }}>
                  <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              )}
              <div style={{
                maxWidth: '72%',
                padding: '11px 15px',
                borderRadius: msg.role === 'ada' ? '4px 14px 14px 14px' : '14px 4px 14px 14px',
                background: msg.role === 'ada' ? 'white' : BLUE,
                color: msg.role === 'ada' ? '#111827' : 'white',
                fontSize: 13.5, lineHeight: 1.6, whiteSpace: 'pre-wrap',
                boxShadow: msg.role === 'ada' ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                border: msg.role === 'ada' ? '1px solid #E8EDF5' : 'none',
              }}>
                {msg.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {sending && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
              background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
            }}>
              <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
            <div style={{
              padding: '11px 15px', borderRadius: '4px 14px 14px 14px',
              background: 'white', border: '1px solid #E8EDF5',
              display: 'flex', gap: 5, alignItems: 'center',
            }}>
              {[0, 1, 2].map(i => (
                <motion.div key={i}
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                  style={{ width: 5, height: 5, borderRadius: '50%', background: '#9CA3AF' }}
                />
              ))}
            </div>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{
        padding: '14px 24px', borderTop: '1px solid #E8EDF5',
        background: 'white', display: 'flex', gap: 10, alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tell Ada about your research..."
          rows={1}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 12,
            border: '1px solid #E2E8F0', background: '#F8FAFF',
            color: '#111827', fontSize: 13.5, fontFamily: 'Inter, sans-serif',
            resize: 'none', outline: 'none', lineHeight: 1.5, maxHeight: 100,
          }}
        />
        <motion.button
          onClick={send}
          disabled={!input.trim() || sending}
          whileTap={{ scale: 0.95 }}
          style={{
            width: 42, height: 42, borderRadius: 11, border: 'none',
            background: !input.trim() || sending ? '#E5E7EB' : BLUE,
            color: 'white', cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}
        >
          <Send size={16} />
        </motion.button>
      </div>
    </div>
  );
}
