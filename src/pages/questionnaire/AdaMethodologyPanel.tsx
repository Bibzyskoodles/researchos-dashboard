import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles } from 'lucide-react';
import { adaApi } from '../../services/api';
import { Question, GeneratedQuestionnaire, QualityIssue } from './types';

interface Message {
  role: 'ada' | 'user';
  text: string;
}

interface Props {
  questionnaire: GeneratedQuestionnaire;
  focusedQuestion: Question | null;
  qualityIssues: QualityIssue[];
  onApplySuggestion?: (questionId: string, newText: string) => void;
}

const BLUE = '#2463EB';
const AMBER = '#D97706';
const GREEN = '#059669';

const REVIEW_SYSTEM = `You are Ada, a world-class research methodologist. You are helping a researcher refine their questionnaire in the ResearchOS workspace.

When focused on a specific question, provide concise, actionable methodology advice:
- Identify biases (leading, acquiescence, social desirability, double-barrelled)
- Suggest better phrasing if needed
- Flag cultural or literacy concerns
- Recommend the right question type
- Note skip logic that might be needed

Keep responses SHORT (2-4 sentences max unless asked for more). Be direct and expert. If you have a specific rewrite suggestion, provide it clearly.

Format suggestions as:
"SUGGESTION: [rewritten question text]" on its own line if you want to propose a rewrite.`;

export default function AdaMethodologyPanel({
  questionnaire, focusedQuestion, qualityIssues, onApplySuggestion,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const prevQuestionRef = useRef<string | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!focusedQuestion || focusedQuestion.id === prevQuestionRef.current) return;
    prevQuestionRef.current = focusedQuestion.id;

    const issues = qualityIssues.filter(i => i.question_id === focusedQuestion.id);
    if (issues.length === 0) return;

    const issue = issues[0];
    setMessages(prev => [...prev, {
      role: 'ada',
      text: `⚠ **${issue.type.replace(/_/g, ' ')}**: ${issue.issue}\n\n${issue.suggestion}`,
    }]);
  }, [focusedQuestion, qualityIssues]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    setMessages(prev => [...prev, { role: 'user', text }]);
    setInput('');
    setSending(true);

    try {
      const context = {
        system_override: REVIEW_SYSTEM,
        focused_question: focusedQuestion ? {
          text: focusedQuestion.text,
          type: focusedQuestion.type,
          id: focusedQuestion.id,
        } : null,
        questionnaire_title: questionnaire.title,
        total_questions: questionnaire.sections.reduce((s, sec) => s + sec.questions.length, 0),
        quality_issues: qualityIssues.filter(i => !focusedQuestion || i.question_id === focusedQuestion.id),
        history: messages.slice(-6).map(m => ({ role: m.role === 'ada' ? 'assistant' : 'user', content: m.text })),
      };

      const res = await adaApi.chat(text, 'questionnaire_workspace', context);
      const responseText = res.data?.message || res.data?.response || '';

      setMessages(prev => [...prev, { role: 'ada', text: responseText }]);

      // Check for suggestion to apply
      const suggestionMatch = responseText.match(/SUGGESTION:\s*(.+?)(?:\n|$)/);
      if (suggestionMatch && focusedQuestion && onApplySuggestion) {
        // Don't auto-apply — show a button
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'ada',
        text: "I'm having trouble connecting. Please try again.",
      }]);
    } finally {
      setSending(false);
    }
  }, [input, sending, messages, focusedQuestion, questionnaire, qualityIssues, onApplySuggestion]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const totalQuestions = questionnaire.sections.reduce((s, sec) => s + sec.questions.length, 0);
  const byType: Record<string, number> = {};
  questionnaire.sections.forEach(sec => sec.questions.forEach(q => {
    byType[q.type] = (byType[q.type] || 0) + 1;
  }));

  return (
    <div style={{
      width: 280, background: '#F0F4FF', borderLeft: '1px solid #DBEAFE',
      display: 'flex', flexDirection: 'column', flexShrink: 0,
      fontFamily: 'Inter, sans-serif',
    }}>
      {/* Ada header */}
      <div style={{
        padding: '16px', borderBottom: '1px solid #DBEAFE',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
          background: 'linear-gradient(135deg, #2463EB, #7C3AED)', flexShrink: 0,
        }}>
          <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        </div>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1E40AF' }}>Ada</div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>Research Methodologist</div>
        </div>
      </div>

      {/* Focused question context */}
      {focusedQuestion && (
        <div style={{
          padding: '10px 14px', background: '#DBEAFE',
          borderBottom: '1px solid #BFDBFE', fontSize: 12,
        }}>
          <div style={{ fontWeight: 600, color: '#1E40AF', marginBottom: 2 }}>Focused on:</div>
          <div style={{ color: '#374151', lineHeight: 1.4, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {focusedQuestion.text || 'Untitled question'}
          </div>
        </div>
      )}

      {/* Conversation */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 12px' }}>
            <Sparkles size={24} color={BLUE} style={{ margin: '0 auto 8px', display: 'block' }} />
            <div style={{ fontSize: 13, color: '#374151', fontWeight: 600, marginBottom: 4 }}>
              Ask me anything
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
              Select a question or ask about methodology, bias, or how to improve your questionnaire.
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, i) => {
            const hasSuggestion = msg.role === 'ada' && msg.text.includes('SUGGESTION:');
            const suggestionMatch = hasSuggestion ? msg.text.match(/SUGGESTION:\s*(.+?)(?:\n|$)/) : null;
            const cleanText = msg.text.replace(/SUGGESTION:.*?(?:\n|$)/g, '').trim();

            return (
              <motion.div key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <div style={{
                  padding: '10px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.5,
                  background: msg.role === 'ada' ? 'white' : BLUE,
                  color: msg.role === 'ada' ? '#111827' : 'white',
                  whiteSpace: 'pre-wrap',
                }}>
                  {cleanText}
                </div>
                {suggestionMatch && focusedQuestion && onApplySuggestion && (
                  <div style={{ marginTop: 6, padding: '8px 10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: GREEN, marginBottom: 4 }}>Suggested rewrite:</div>
                    <div style={{ fontSize: 12, color: '#065F46', lineHeight: 1.4, marginBottom: 8 }}>
                      "{suggestionMatch[1]}"
                    </div>
                    <button
                      onClick={() => onApplySuggestion(focusedQuestion.id, suggestionMatch[1])}
                      style={{
                        padding: '5px 10px', borderRadius: 6, border: 'none',
                        background: GREEN, color: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                      }}
                    >
                      Apply suggestion
                    </button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        {sending && (
          <div style={{ padding: '10px 12px', borderRadius: 10, background: 'white', display: 'flex', gap: 4, alignItems: 'center' }}>
            {[0, 1, 2].map(i => (
              <motion.div key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.2, delay: i * 0.2, repeat: Infinity }}
                style={{ width: 5, height: 5, borderRadius: '50%', background: '#9CA3AF' }}
              />
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '10px', borderTop: '1px solid #DBEAFE' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask Ada..."
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 10,
              border: '1px solid #BFDBFE', background: 'white',
              fontSize: 13, fontFamily: 'Inter, sans-serif', outline: 'none', color: '#111827',
            }}
          />
          <button
            onClick={send}
            disabled={!input.trim() || sending}
            style={{
              width: 36, height: 36, borderRadius: 10, border: 'none',
              background: !input.trim() || sending ? '#DBEAFE' : BLUE,
              color: 'white', cursor: !input.trim() || sending ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
          >
            <Send size={14} />
          </button>
        </div>
      </div>

      {/* Methodology stats */}
      <div style={{ padding: '12px', borderTop: '1px solid #DBEAFE', background: 'white' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
          Methodology
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#6B7280' }}>Est. duration</span>
            <span style={{ fontWeight: 700, color: '#111827' }}>{questionnaire.estimated_duration_mins} min</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#6B7280' }}>Questions</span>
            <span style={{ fontWeight: 700, color: '#111827' }}>{totalQuestions}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: '#6B7280' }}>Sections</span>
            <span style={{ fontWeight: 700, color: '#111827' }}>{questionnaire.sections.length}</span>
          </div>
          {qualityIssues.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: AMBER }}>⚠ Issues</span>
              <span style={{ fontWeight: 700, color: AMBER }}>{qualityIssues.length}</span>
            </div>
          )}
        </div>
        {Object.entries(byType).length > 0 && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #E5E7EB' }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 }}>
              By type
            </div>
            {Object.entries(byType).map(([type, count]) => (
              <div key={type} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                <span style={{ color: '#6B7280' }}>{type.replace(/_/g, ' ')}</span>
                <span style={{ color: '#374151', fontWeight: 600 }}>{count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
