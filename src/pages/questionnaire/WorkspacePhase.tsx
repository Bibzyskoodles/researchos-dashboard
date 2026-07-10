import React, { useState, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Plus, Download, RotateCcw, Save, Check, ArrowRight } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import SectionNav from './SectionNav';
import QuestionCard from './QuestionCard';
import AdaMethodologyPanel from './AdaMethodologyPanel';
import ExportPanel from './ExportPanel';
import { GeneratedQuestionnaire, Question, QualityIssue, Section } from './types';

interface Props {
  questionnaire: GeneratedQuestionnaire;
  onUpdate: (q: GeneratedQuestionnaire) => void;
  onRestart: () => void;
}

const BLUE = '#2463EB';

let idCounter = Date.now();
const newId = (prefix: string) => `${prefix}_${++idCounter}`;

function runQualityChecks(sections: Section[]): QualityIssue[] {
  const issues: QualityIssue[] = [];
  const LEADING_PHRASES = ["don't you agree", "isn't it", "wouldn't you", "obviously", "surely", "clearly", "of course"];

  sections.forEach(sec => sec.questions.forEach(q => {
    const t = q.text.toLowerCase();

    if (LEADING_PHRASES.some(p => t.includes(p))) {
      issues.push({
        type: 'leading_question',
        question_id: q.id,
        issue: 'This question may lead respondents toward a particular answer.',
        suggestion: 'Rephrase to present the question neutrally without implying an expected answer.',
      });
    }

    if (t.includes(' and ') && t.includes('?') && t.length > 60) {
      const parts = t.split(' and ');
      if (parts.length >= 2 && parts.every(p => p.includes('how') || p.includes('what') || p.includes('do') || p.includes('are'))) {
        issues.push({
          type: 'double_barrelled',
          question_id: q.id,
          issue: 'This question may be asking about two things at once.',
          suggestion: 'Split into two separate questions.',
        });
      }
    }

    if ((q.type === 'select' || q.type === 'multi_select') && (!q.options || q.options.filter(o => o.trim()).length < 2)) {
      issues.push({
        type: 'ambiguous',
        question_id: q.id,
        issue: 'Select question has no options defined.',
        suggestion: 'Add response options for respondents to choose from.',
      });
    }
  }));

  return issues;
}

export default function WorkspacePhase({ questionnaire, onUpdate, onRestart }: Props) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    questionnaire.sections[0]?.questions[0]?.id || null
  );
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(
    questionnaire.sections[0]?.id || null
  );
  const [showExport, setShowExport] = useState(false);
  const [adaFocusQuestion, setAdaFocusQuestion] = useState<Question | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showNextStep, setShowNextStep] = useState(false);
  const { projectId } = useParams<{ projectId?: string }>();
  const navigate = useNavigate();

  const qualityIssues: QualityIssue[] = useMemo(() => {
    const fromGeneration = questionnaire.quality_checks || [];
    const live = runQualityChecks(questionnaire.sections);
    const liveIds = new Set(live.map(i => i.question_id));
    const filtered = fromGeneration.filter(i => !liveIds.has(i.question_id));
    return [...live, ...filtered];
  }, [questionnaire]);

  const updateQuestion = useCallback((sectionId: string, questionId: string, updated: Question) => {
    const sections = questionnaire.sections.map(sec =>
      sec.id !== sectionId ? sec : {
        ...sec,
        questions: sec.questions.map(q => q.id !== questionId ? q : updated),
      }
    );
    onUpdate({ ...questionnaire, sections });
  }, [questionnaire, onUpdate]);

  const deleteQuestion = useCallback((sectionId: string, questionId: string) => {
    const sections = questionnaire.sections.map(sec =>
      sec.id !== sectionId ? sec : {
        ...sec,
        questions: sec.questions.filter(q => q.id !== questionId),
      }
    ).filter(sec => sec.questions.length > 0 || questionnaire.sections.length === 1);
    onUpdate({ ...questionnaire, sections });
    if (selectedQuestionId === questionId) setSelectedQuestionId(null);
  }, [questionnaire, onUpdate, selectedQuestionId]);

  const addQuestion = useCallback((sectionId: string) => {
    const newQuestion: Question = {
      id: newId('q'), text: '', type: 'open', required: true,
    };
    const sections = questionnaire.sections.map(sec =>
      sec.id !== sectionId ? sec : {
        ...sec,
        questions: [...sec.questions, newQuestion],
      }
    );
    onUpdate({ ...questionnaire, sections });
    setSelectedQuestionId(newQuestion.id);
    setSelectedSectionId(sectionId);
  }, [questionnaire, onUpdate]);

  const addSection = useCallback(() => {
    const newSection: Section = {
      id: newId('sec'),
      title: 'New Section',
      purpose: '',
      questions: [{
        id: newId('q'), text: '', type: 'open', required: true,
      }],
    };
    onUpdate({ ...questionnaire, sections: [...questionnaire.sections, newSection] });
    setSelectedSectionId(newSection.id);
    setSelectedQuestionId(newSection.questions[0].id);
  }, [questionnaire, onUpdate]);

  const applySuggestion = useCallback((questionId: string, newText: string) => {
    let updated = false;
    const sections = questionnaire.sections.map(sec => ({
      ...sec,
      questions: sec.questions.map(q => {
        if (q.id === questionId) { updated = true; return { ...q, text: newText }; }
        return q;
      }),
    }));
    if (updated) onUpdate({ ...questionnaire, sections });
  }, [questionnaire, onUpdate]);

  const selectedQuestion = useMemo(() => {
    for (const sec of questionnaire.sections) {
      for (const q of sec.questions) {
        if (q.id === selectedQuestionId) return q;
      }
    }
    return null;
  }, [questionnaire, selectedQuestionId]);

  const handleSave = async () => {
    setSaveState('saving');
    try {
      if (projectId) {
        await api.post(`/projects/${projectId}/questionnaire`, { questionnaire });
      }
      setSaveState('saved');
      setShowNextStep(true);
      setTimeout(() => setSaveState('idle'), 3000);
    } catch {
      setSaveState('error');
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden', fontFamily: 'Inter, sans-serif' }}>
      {/* Left: Section navigator */}
      <SectionNav
        sections={questionnaire.sections}
        selectedQuestionId={selectedQuestionId}
        selectedSectionId={selectedSectionId}
        qualityIssues={qualityIssues}
        onSelectQuestion={(qId, sId) => {
          setSelectedQuestionId(qId);
          setSelectedSectionId(sId);
          const q = questionnaire.sections.flatMap(s => s.questions).find(q => q.id === qId);
          if (q) setAdaFocusQuestion(q);
        }}
        onAddSection={addSection}
      />

      {/* Center: Question editor */}
      <div style={{ flex: 1, overflowY: 'auto', padding: 24, background: '#FAFAFA' }}>
        {/* Top bar */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: '#111827' }}>
              {questionnaire.title}
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: '#6B7280' }}>
              {questionnaire.sections.reduce((s, sec) => s + sec.questions.length, 0)} questions •
              ~{questionnaire.estimated_duration_mins} min
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={onRestart}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 10, border: '1px solid #E5E7EB',
                background: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#6B7280',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              <RotateCcw size={14} /> New
            </button>
            <motion.button
              onClick={handleSave}
              disabled={saveState === 'saving'}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 10, border: 'none',
                background: saveState === 'saved' ? '#059669' : saveState === 'error' ? '#DC2626' : '#374151',
                color: 'white', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
              }}
            >
              {saveState === 'saved' ? <><Check size={14} /> Saved</> :
               saveState === 'saving' ? 'Saving...' :
               saveState === 'error' ? 'Save failed' :
               <><Save size={14} /> Save</>}
            </motion.button>
            <motion.button
              onClick={() => setShowExport(true)}
              whileTap={{ scale: 0.97 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 16px', borderRadius: 10, border: 'none',
                background: BLUE, color: 'white', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'Inter, sans-serif',
              }}
            >
              <Download size={14} /> Export
            </motion.button>
          </div>
        </div>

        {/* Post-save next step banner */}
        {showNextStep && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginBottom: 20, padding: '14px 18px', borderRadius: 12,
              background: 'linear-gradient(135deg, #ECFDF5, #D1FAE5)',
              border: '1px solid #6EE7B7', display: 'flex', alignItems: 'center', gap: 14,
            }}
          >
            <Check size={18} color="#059669" style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#065F46' }}>Questionnaire saved to project</div>
              <div style={{ fontSize: 12, color: '#047857', marginTop: 2 }}>
                Ready to deploy to your data collection platform?
              </div>
            </div>
            {projectId && (
              <button
                onClick={() => navigate(`/projects/${projectId}/collect`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: '#059669', color: 'white', cursor: 'pointer',
                  fontSize: 12, fontWeight: 700, fontFamily: 'Inter, sans-serif', whiteSpace: 'nowrap',
                }}
              >
                Go to Collect <ArrowRight size={12} />
              </button>
            )}
            <button
              onClick={() => setShowNextStep(false)}
              style={{ border: 'none', background: 'transparent', color: '#6B7280', cursor: 'pointer', padding: 4 }}
            >
              ✕
            </button>
          </motion.div>
        )}

        {/* Sections and questions */}
        {questionnaire.sections.map(section => (
          <div key={section.id} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#374151' }}>
                  {section.title}
                </h2>
                {section.purpose && (
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9CA3AF' }}>{section.purpose}</p>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {section.questions.map((q, idx) => {
                const issuesForQ = qualityIssues.filter(i => i.question_id === q.id);
                return (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={idx}
                    sectionTitle={section.title}
                    qualityIssues={issuesForQ}
                    isSelected={selectedQuestionId === q.id}
                    onSelect={() => {
                      setSelectedQuestionId(q.id);
                      setSelectedSectionId(section.id);
                    }}
                    onUpdate={updated => updateQuestion(section.id, q.id, updated)}
                    onDelete={() => deleteQuestion(section.id, q.id)}
                    onAskAda={question => {
                      setAdaFocusQuestion(question);
                      setSelectedQuestionId(q.id);
                    }}
                  />
                );
              })}

              <button
                onClick={() => addQuestion(section.id)}
                style={{
                  padding: '12px', borderRadius: 10, border: '2px dashed #E5E7EB',
                  background: 'transparent', cursor: 'pointer', color: '#9CA3AF',
                  fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', gap: 6, width: '100%', fontFamily: 'Inter, sans-serif',
                  transition: 'border-color 0.2s, color 0.2s',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = BLUE;
                  (e.currentTarget as HTMLElement).style.color = BLUE;
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = '#E5E7EB';
                  (e.currentTarget as HTMLElement).style.color = '#9CA3AF';
                }}
              >
                <Plus size={14} /> Add question to {section.title}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Right: Ada panel */}
      <AdaMethodologyPanel
        questionnaire={questionnaire}
        focusedQuestion={adaFocusQuestion || selectedQuestion}
        qualityIssues={qualityIssues}
        onApplySuggestion={applySuggestion}
      />

      {showExport && (
        <ExportPanel
          questionnaire={questionnaire}
          onClose={() => setShowExport(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
