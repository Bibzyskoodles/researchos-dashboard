import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { adaApi } from '../../services/api';
import { ConsultationState } from './types';

interface Message {
  role: 'ada' | 'user';
  text: string;
}

interface Props {
  onReady: (consultation: ConsultationState, brief: string) => void;
}

const BLUE = '#2463EB';

// Questions Ada asks in sequence
const CONSULTATION_STEPS: Array<{
  field: keyof ConsultationState;
  question: string;
  followUp?: (answer: string) => string | null;
}> = [
  {
    field: 'decision',
    question: "Before we design your questionnaire, I need to understand your research. Tell me — what decision will this data help you make?",
  },
  {
    field: 'audience',
    question: "Who are your respondents? Describe them to me — their background, location, and familiarity with surveys.",
  },
  {
    field: 'context',
    question: "Where and how will the interviews be conducted? For example: in respondents' homes, in stores, over the phone?",
  },
  {
    field: 'duration_mins',
    question: "How long can each interview realistically take? And what language will the questionnaire be conducted in?",
  },
  {
    field: 'platform',
    question: "Which data collection platform does your team use — KoboToolbox, SurveyCTO, ODK, or paper-based?",
  },
  {
    field: 'sensitivity',
    question: "Are there any sensitive topics in this research — income, health, political views, or anything respondents may be reluctant to discuss?",
  },
];

function extractDurationAndLanguage(text: string): { duration_mins: number | null; language: string | null } {
  const durationMatch = text.match(/(\d+)\s*(?:min|minute|hour)/i);
  const duration_mins = durationMatch ? (text.toLowerCase().includes('hour') ? parseInt(durationMatch[1]) * 60 : parseInt(durationMatch[1])) : null;

  const languages = ['english', 'french', 'arabic', 'hausa', 'yoruba', 'igbo', 'swahili', 'portuguese', 'spanish', 'amharic', 'wolof', 'zulu'];
  const lower = text.toLowerCase();
  const found = languages.find(l => lower.includes(l));
  const language = found ? found.charAt(0).toUpperCase() + found.slice(1) : (text.length < 30 ? text.trim() : 'English');

  return { duration_mins, language };
}

function extractSensitivity(text: string): 'low' | 'medium' | 'high' {
  const lower = text.toLowerCase();
  if (/income|salary|wealth|hiv|health|politic|religion|death|violence|abuse/.test(lower)) return 'high';
  if (/sensitive|careful|reluctant|private/.test(lower)) return 'medium';
  if (/no|none|not really|not sensitive|straightforward/.test(lower)) return 'low';
  return 'medium';
}

function extractPlatform(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes('kobo')) return 'KoboToolbox';
  if (lower.includes('surveycto') || lower.includes('survey cto')) return 'SurveyCTO';
  if (lower.includes('odk')) return 'ODK';
  if (lower.includes('paper')) return 'Paper';
  if (lower.includes('commcare')) return 'CommCare';
  return 'KoboToolbox';
}

function extractInterviewMode(text: string): 'face_to_face' | 'phone' | 'self_complete' {
  const lower = text.toLowerCase();
  if (/phone|call|telephone|remote/.test(lower)) return 'phone';
  if (/self|online|digital|web|themselves/.test(lower)) return 'self_complete';
  return 'face_to_face';
}

function extractLiteracy(audience: string, context: string): 'high' | 'medium' | 'low' {
  const combined = (audience + ' ' + context).toLowerCase();
  if (/rural|village|informal|low.literate|illiterate|no education|primary/.test(combined)) return 'low';
  if (/university|professional|educated|graduate|manager|executive/.test(combined)) return 'high';
  return 'medium';
}

export default function ConsultationPhase({ onReady }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ada', text: CONSULTATION_STEPS[0].question }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
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

  const finishConsultation = useCallback((finalConsultation: ConsultationState, finalAnswers: string[]) => {
    const brief = `Research Brief:
Decision: ${finalConsultation.decision || finalAnswers[0] || 'Not specified'}
Audience: ${finalConsultation.audience || finalAnswers[1] || 'Not specified'}
Context: ${finalConsultation.context || finalAnswers[2] || 'Not specified'}
Duration: ${finalConsultation.duration_mins ? `${finalConsultation.duration_mins} minutes` : 'Not specified'}
Language: ${finalConsultation.language || 'English'}
Platform: ${finalConsultation.platform || 'KoboToolbox'}
Literacy Level: ${finalConsultation.literacy_level || 'medium'}
Interview Mode: ${finalConsultation.interview_mode || 'face_to_face'}
Sensitivity: ${finalConsultation.sensitivity || 'medium'}

Researcher's notes:
${finalAnswers.join('\n')}`;

    setTimeout(() => onReady(finalConsultation, brief), 1000);
  }, [onReady]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: Message = { role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    const newAnswers = [...answers, text];
    setAnswers(newAnswers);

    // Update consultation state from this answer
    const currentStep = CONSULTATION_STEPS[stepIndex];
    let updatedConsultation = { ...consultation };

    if (currentStep.field === 'decision') {
      updatedConsultation.decision = text;
    } else if (currentStep.field === 'audience') {
      updatedConsultation.audience = text;
    } else if (currentStep.field === 'context') {
      updatedConsultation.context = text;
      updatedConsultation.interview_mode = extractInterviewMode(text);
    } else if (currentStep.field === 'duration_mins') {
      const { duration_mins, language } = extractDurationAndLanguage(text);
      updatedConsultation.duration_mins = duration_mins;
      updatedConsultation.language = language;
    } else if (currentStep.field === 'platform') {
      updatedConsultation.platform = extractPlatform(text);
    } else if (currentStep.field === 'sensitivity') {
      updatedConsultation.sensitivity = extractSensitivity(text);
    }

    // Derive literacy from audience + context
    if (updatedConsultation.audience && updatedConsultation.context) {
      updatedConsultation.literacy_level = extractLiteracy(
        updatedConsultation.audience,
        updatedConsultation.context
      );
    }

    setConsultation(updatedConsultation);

    const nextStepIndex = stepIndex + 1;
    const isLastStep = nextStepIndex >= CONSULTATION_STEPS.length;

    try {
      // Ask Ada to acknowledge the answer conversationally and transition
      const acknowledgementPrompt = isLastStep
        ? `The researcher just answered our final consultation question about sensitivity/sensitive topics. Their answer: "${text}".
           Here is the full brief we've collected:
           - Decision: ${updatedConsultation.decision}
           - Audience: ${updatedConsultation.audience}
           - Context: ${updatedConsultation.context}
           - Platform: ${updatedConsultation.platform}
           - Language: ${updatedConsultation.language || 'English'}

           Give a brief 2-sentence acknowledgement of their answer, then say something like "I have everything I need. I'm ready to design your questionnaire now." Be warm and expert.`
        : `The researcher is in a questionnaire design consultation. They just answered: "${text}" (about: ${currentStep.field.replace(/_/g, ' ')}).
           Give a 1-sentence acknowledgement of their answer that shows you understood it and may add a brief expert insight if relevant. Keep it under 20 words. Do not ask the next question yet.`;

      const res = await adaApi.chat(acknowledgementPrompt, 'questionnaire_consultation', {});
      const ack = res.data?.reply || res.data?.message || res.data?.response || '';

      const responseMessages: Message[] = [];
      if (ack && ack.length > 0) {
        responseMessages.push({ role: 'ada', text: ack });
      }

      if (isLastStep) {
        updatedConsultation.ready_to_generate = true;
        if (!ack) {
          responseMessages.push({
            role: 'ada',
            text: "I have everything I need. I'm ready to design your questionnaire now.",
          });
        }
        setMessages(prev => [...prev, ...responseMessages]);
        finishConsultation(updatedConsultation, newAnswers);
      } else {
        const nextQuestion = CONSULTATION_STEPS[nextStepIndex].question;
        responseMessages.push({ role: 'ada', text: nextQuestion });
        setMessages(prev => [...prev, ...responseMessages]);
        setStepIndex(nextStepIndex);
      }
    } catch {
      // If API fails, just move to next question silently
      if (isLastStep) {
        updatedConsultation.ready_to_generate = true;
        setMessages(prev => [...prev, {
          role: 'ada',
          text: "I have everything I need. I'm ready to design your questionnaire now.",
        }]);
        finishConsultation(updatedConsultation, newAnswers);
      } else {
        setMessages(prev => [...prev, {
          role: 'ada',
          text: CONSULTATION_STEPS[nextStepIndex].question,
        }]);
        setStepIndex(nextStepIndex);
      }
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [input, sending, stepIndex, answers, consultation, finishConsultation]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const progress = stepIndex;
  const total = CONSULTATION_STEPS.length;

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: '#F8FAFF', fontFamily: 'Inter, sans-serif',
    }}>
      {/* Header */}
      <div style={{
        padding: '18px 24px 14px', borderBottom: '1px solid #E8EDF5',
        background: 'white', display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{
          width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
          background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
        }}>
          <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>Ada — Research Consultant</div>
          <div style={{ fontSize: 12, color: '#6B7280' }}>
            {progress < total ? `Step ${progress + 1} of ${total} — ${CONSULTATION_STEPS[progress]?.field.replace(/_/g, ' ')}` : 'Consultation complete'}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ display: 'flex', gap: 4 }}>
          {CONSULTATION_STEPS.map((_, i) => (
            <div key={i} style={{
              width: 24, height: 4, borderRadius: 2,
              background: i < progress ? BLUE : i === progress ? `${BLUE}60` : '#E5E7EB',
              transition: 'background 0.3s',
            }} />
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <AnimatePresence initial={false}>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22 }}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                gap: 10, alignItems: 'flex-start',
              }}
            >
              {msg.role === 'ada' && (
                <div style={{
                  width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                  overflow: 'hidden', background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
                  marginTop: 2,
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
                boxShadow: msg.role === 'ada' ? '0 1px 4px rgba(0,0,0,0.07)' : 'none',
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
              width: 28, height: 28, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
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
          placeholder="Tell Ada about your research... (Enter to send)"
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
          <ArrowRight size={16} />
        </motion.button>
      </div>
    </div>
  );
}
