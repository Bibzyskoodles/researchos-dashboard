import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { useAdaGreeting } from '../../hooks/useAdaGreeting';
import ConsultationPhase from './ConsultationPhase';
import WorkspacePhase from './WorkspacePhase';
import { ConsultationState, GeneratedQuestionnaire, QuestionnaireState } from './types';

const BLUE = '#2463EB';

const GENERATING_MESSAGES = [
  "I'm designing your questionnaire now. Structuring it to build rapport before sensitive topics...",
  "Writing warm-up questions to ease respondents in and establish trust...",
  "Designing the core questions — choosing optimal types for your interview context...",
  "Adding skip logic for branching pathways based on respondent answers...",
  "Running a final quality check — checking for bias, double-barrelling, and ambiguity...",
  "Almost done. Assembling your questionnaire and preparing methodology notes...",
];

function GeneratingPhase({ consultation }: { consultation: ConsultationState }) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMsgIndex(i => Math.min(i + 1, GENERATING_MESSAGES.length - 1));
    }, 3200);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      height: '100%', background: '#F8FAFF', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Inter, sans-serif', padding: 24,
    }}>
      <div style={{ maxWidth: 440, textAlign: 'center' }}>
        <div style={{ position: 'relative', width: 72, height: 72, margin: '0 auto 28px' }}>
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              position: 'absolute', inset: -8, borderRadius: '50%',
              background: `${BLUE}33`,
            }}
          />
          <div style={{
            width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
            background: `linear-gradient(135deg, ${BLUE}, #7C3AED)`,
          }}>
            <img src="/ada-avatar.jpg" alt="Ada" style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={msgIndex}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{ color: '#374151', fontSize: 14, lineHeight: 1.6, margin: '0 0 28px' }}
          >
            {GENERATING_MESSAGES[msgIndex]}
          </motion.p>
        </AnimatePresence>

        <div style={{ height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
          <motion.div
            animate={{ width: `${((msgIndex + 1) / GENERATING_MESSAGES.length) * 100}%` }}
            transition={{ duration: 0.6 }}
            style={{ height: '100%', background: BLUE, borderRadius: 2 }}
          />
        </div>

        {consultation.platform && (
          <p style={{ color: '#9CA3AF', fontSize: 12, marginTop: 14 }}>
            Optimised for {consultation.platform}
          </p>
        )}
      </div>
    </div>
  );
}

// The server now always sends a title and a duration. It did not until today —
// /questionnaire/generate returned { sections, model } and nothing else — and
// everything downstream assumed otherwise: the exports name their file after
// the title and threw on it ("Cannot read properties of undefined (reading
// 'replace')"), and the workspace header rendered "~ min" with the number
// missing.
//
// Applied on every path a questionnaire can enter this page by, not just the
// one that was reported: a questionnaire SAVED before that fix is sitting in a
// project right now with no title, and reopening it must not reproduce the bug
// the server fix already closed.
function backfillMissingFields(
  q: GeneratedQuestionnaire,
  consultation?: ConsultationState,
): GeneratedQuestionnaire {
  if (!q.title || !String(q.title).trim()) {
    const decision = consultation?.decision?.trim();
    q.title = decision ? `${decision.slice(0, 80)} — Questionnaire` : 'Research Questionnaire';
  }
  if (!Number.isFinite(q.estimated_duration_mins) || q.estimated_duration_mins <= 0) {
    q.estimated_duration_mins = consultation?.duration_mins || 20;
  }
  q.sections = (q.sections || []).map((sec, si) => ({
    ...sec,
    id: sec.id || `sec_${si}`,
    questions: (sec.questions || []).map((question, qi) => ({
      ...question,
      id: question.id || `q_${si}_${qi}`,
    })),
  }));
  return q;
}

const initialState: QuestionnaireState = {
  phase: 'consultation',
  consultation: {
    decision: null, audience: null, context: null, duration_mins: null,
    language: null, platform: null, literacy_level: null,
    interview_mode: null, sensitivity: null, ready_to_generate: false,
  },
  questionnaire: null,
  selectedQuestionId: null,
  selectedSectionId: null,
  unsavedChanges: false,
  qualityIssues: [],
  adaContext: '',
};

export default function QuestionnairePage() {
  useAdaGreeting({ page: "questionnaire" });
  const { projectId } = useParams<{ projectId?: string }>();
  const [state, setState] = useState<QuestionnaireState>(initialState);
  const [loadingSaved, setLoadingSaved] = useState(!!projectId);

  // Reopen the project's saved questionnaire.
  //
  // WorkspacePhase has always POSTed to /api/projects/<id>/questionnaire, and
  // the backend has always served the matching GET — but nothing ever called
  // it. So the designer opened at the consultation every single time: you could
  // design a questionnaire, save it, navigate to Collect and back, and be asked
  // to describe your study from scratch while the saved copy sat on the server
  // untouched. Losing work you were explicitly told was saved is worse than
  // never offering to save it.
  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    api.get(`/api/projects/${projectId}/questionnaire`)
      .then(res => {
        const saved = res.data?.questionnaire;
        if (cancelled || !saved?.sections?.length) return;
        setState(prev => ({
          ...prev,
          phase: 'workspace',
          // No consultation to draw defaults from — this questionnaire was
          // designed in an earlier session. backfillMissingFields covers the
          // case that matters: anything saved before the title fix has none.
          questionnaire: backfillMissingFields(saved, saved.consultation),
          consultation: saved.consultation || prev.consultation,
          unsavedChanges: false,
        }));
      })
      // A questionnaire that cannot be loaded is not an error worth a banner —
      // the consultation is a complete way to start, and it is what this page
      // did for every project until now. Failing loudly here would make a new
      // project look broken.
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingSaved(false); });
    return () => { cancelled = true; };
  }, [projectId]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (state.unsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [state.unsavedChanges]);

  const handleConsultationReady = useCallback(async (consultation: ConsultationState, brief: string) => {
    setState(prev => ({ ...prev, phase: 'generating', consultation }));

    try {
      const res = await api.post('/questionnaire/generate', {
        brief,
        consultation,
        platform: consultation.platform || 'KoboToolbox',
        duration_mins: consultation.duration_mins || 20,
        literacy_level: consultation.literacy_level || 'medium',
        interview_mode: consultation.interview_mode || 'face_to_face',
        language: consultation.language || 'English',
        sensitivity: consultation.sensitivity || 'medium',
      });

      const data = res.data;
      const questionnaire: GeneratedQuestionnaire = data.questionnaire || data;

      backfillMissingFields(questionnaire, consultation);
      questionnaire.consultation = consultation;

      setState(prev => ({ ...prev, phase: 'workspace', questionnaire, unsavedChanges: false }));
    } catch {
      const demo = buildDemoQuestionnaire(consultation);
      setState(prev => ({ ...prev, phase: 'workspace', questionnaire: demo, unsavedChanges: false }));
    }
  }, []);

  const handleQuestionnaireUpdate = useCallback((updated: GeneratedQuestionnaire) => {
    setState(prev => ({ ...prev, questionnaire: updated, unsavedChanges: true }));
  }, []);

  const handleRestart = useCallback(() => {
    if (state.unsavedChanges) {
      if (!window.confirm('You have unsaved changes. Start a new questionnaire anyway?')) return;
    }
    setState(initialState);
  }, [state.unsavedChanges]);

  return (
    <div data-ada-target="questionnaire-builder" style={{ height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <AnimatePresence mode="wait">
        {loadingSaved && (
          <motion.div key="loading-saved" style={{ flex: 1 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div style={{
              height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: '#F8FAFF', fontFamily: 'Inter, sans-serif',
              color: '#6B7280', fontSize: 13,
            }}>
              Opening this project's questionnaire…
            </div>
          </motion.div>
        )}

        {!loadingSaved && state.phase === 'consultation' && (
          <motion.div key="consultation" style={{ flex: 1, overflow: 'auto' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ConsultationPhase onReady={handleConsultationReady} />
          </motion.div>
        )}

        {state.phase === 'generating' && (
          <motion.div key="generating" style={{ flex: 1 }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <GeneratingPhase consultation={state.consultation} />
          </motion.div>
        )}

        {state.phase === 'workspace' && state.questionnaire && (
          <motion.div key="workspace"
            style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <WorkspacePhase
              questionnaire={state.questionnaire}
              onUpdate={handleQuestionnaireUpdate}
              onRestart={handleRestart}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function buildDemoQuestionnaire(consultation: ConsultationState): GeneratedQuestionnaire {
  const platform = consultation.platform || 'KoboToolbox';
  const audience = consultation.audience || 'respondents';
  const decision = consultation.decision || 'research decisions';

  return {
    title: `Research Questionnaire — ${new Date().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`,
    estimated_duration_mins: consultation.duration_mins || 20,
    methodology_notes: `Designed to support: ${decision}. Target audience: ${audience}. Optimised for ${platform}.`,
    xlsform_notes: `This form is ready for ${platform}. Test on a mobile device before full deployment.`,
    sections: [
      {
        id: 'sec_0',
        title: 'Introduction & Consent',
        purpose: 'Establish rapport and obtain informed consent',
        questions: [
          {
            id: 'q_0_0',
            text: 'Good day. My name is [INTERVIEWER NAME]. I am working with [ORGANISATION] on a research study. We would like to ask you some questions. This should take about [DURATION] minutes. Your participation is voluntary and your answers will be kept confidential. Do you agree to participate?',
            type: 'select',
            required: true,
            options: ['Yes, I agree', 'No, I do not agree'],
            interviewer_instruction: 'If respondent says No, thank them and end the interview.',
          },
          {
            id: 'q_0_1',
            text: 'How old are you?',
            type: 'number',
            required: true,
            validation: 'Must be between 15 and 99',
          },
        ],
      },
      {
        id: 'sec_1',
        title: 'Background',
        purpose: 'Collect demographic and contextual information',
        questions: [
          {
            id: 'q_1_0',
            text: 'What is your gender?',
            type: 'select',
            required: false,
            options: ['Male', 'Female', 'Prefer not to say', 'Other'],
          },
          {
            id: 'q_1_1',
            text: 'What is the highest level of education you have completed?',
            type: 'select',
            required: true,
            options: ['No formal education', 'Primary school', 'Secondary school', 'Vocational/technical training', 'University degree', 'Postgraduate'],
          },
        ],
      },
      {
        id: 'sec_2',
        title: 'Core Questions',
        purpose: `Questions directly related to: ${decision}`,
        questions: [
          {
            id: 'q_2_0',
            text: 'How would you rate your overall experience over the past 12 months?',
            type: 'scale',
            required: true,
            scale_min: 1,
            scale_max: 5,
            scale_labels: { '1': 'Very poor', '3': 'Average', '5': 'Excellent' },
          },
          {
            id: 'q_2_1',
            text: 'What are the most important challenges you currently face? Please select all that apply.',
            type: 'multi_select',
            required: true,
            options: ['Access to resources', 'Financial constraints', 'Lack of information', 'Limited support', 'Time constraints', 'Other'],
          },
          {
            id: 'q_2_2',
            text: 'In your own words, what is your biggest challenge right now?',
            type: 'open',
            required: false,
            interviewer_instruction: 'Probe: "Can you tell me more about that?" Do not suggest answers.',
          },
        ],
      },
      {
        id: 'sec_3',
        title: 'Closing',
        purpose: 'Final questions and location data',
        questions: [
          {
            id: 'q_3_0',
            text: 'Is there anything else you would like to share with us?',
            type: 'open',
            required: false,
          },
          {
            id: 'q_3_1',
            text: 'Interview location',
            type: 'gps',
            required: false,
            interviewer_instruction: 'Record GPS coordinates of the interview location.',
          },
        ],
      },
    ],
    quality_checks: [
      {
        type: 'sensitive',
        question_id: 'q_1_0',
        issue: 'Gender questions can be sensitive in some cultural contexts.',
        suggestion: 'Keep as non-required (already set) and ensure "Prefer not to say" is available.',
      },
    ],
  };
}
