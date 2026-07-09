import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { GuidedStep, GuidedTour, getTour } from './tours';

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface QAEntry {
  id: string;
  question: string;
  answer: string;
  stepId: string;
  timestamp: string;
}

interface GuidedStore {
  active: boolean;
  tourId: string | null;
  tour: GuidedTour | null;
  // resolved steps — may include demoIntro prepended at index 0
  steps: GuidedStep[];
  stepIndex: number;
  paused: boolean;
  showLauncher: boolean;
  highlightRect: HighlightRect | null;
  completedTours: string[];
  // demo mode
  mode: 'tour' | 'demo';
  // live Q&A
  isAnswering: boolean;
  currentQuestion: string | null;
  currentAnswer: string | null;
  qaLog: QAEntry[];
  sessionStartTime: string | null;
}

type GuidedAction =
  | { type: 'START_TOUR'; tourId: string; mode?: 'tour' | 'demo' }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'EXIT_TOUR' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SHOW_LAUNCHER' }
  | { type: 'HIDE_LAUNCHER' }
  | { type: 'SET_HIGHLIGHT'; rect: HighlightRect | null }
  | { type: 'MARK_COMPLETED'; tourId: string }
  | { type: 'BEGIN_QA'; question: string }
  | { type: 'RESOLVE_QA'; answer: string }
  | { type: 'DISMISS_QA' };

const initialStore: GuidedStore = {
  active: false,
  tourId: null,
  tour: null,
  steps: [],
  stepIndex: 0,
  paused: false,
  showLauncher: false,
  highlightRect: null,
  completedTours: [],
  mode: 'tour',
  isAnswering: false,
  currentQuestion: null,
  currentAnswer: null,
  qaLog: [],
  sessionStartTime: null,
};

function buildSteps(tour: GuidedTour, mode: 'tour' | 'demo'): GuidedStep[] {
  if (mode === 'demo' && tour.demoIntro) {
    return [tour.demoIntro, ...tour.steps];
  }
  return tour.steps;
}

function guidedReducer(store: GuidedStore, action: GuidedAction): GuidedStore {
  switch (action.type) {
    case 'START_TOUR': {
      const tour = getTour(action.tourId);
      if (!tour) return store;
      const mode = action.mode ?? 'tour';
      const steps = buildSteps(tour, mode);
      return {
        ...store,
        active: true,
        tourId: action.tourId,
        tour,
        steps,
        stepIndex: 0,
        paused: false,
        showLauncher: false,
        highlightRect: null,
        mode,
        isAnswering: false,
        currentQuestion: null,
        currentAnswer: null,
        sessionStartTime: new Date().toISOString(),
      };
    }
    case 'NEXT_STEP': {
      if (!store.tour) return store;
      const next = store.stepIndex + 1;
      if (next >= store.steps.length) {
        return {
          ...store,
          active: false,
          tour: null,
          tourId: null,
          steps: [],
          stepIndex: 0,
          highlightRect: null,
          isAnswering: false,
          currentQuestion: null,
          currentAnswer: null,
          completedTours: store.tourId && !store.completedTours.includes(store.tourId)
            ? [...store.completedTours, store.tourId]
            : store.completedTours,
        };
      }
      return { ...store, stepIndex: next, highlightRect: null, isAnswering: false, currentQuestion: null, currentAnswer: null };
    }
    case 'PREV_STEP':
      return { ...store, stepIndex: Math.max(0, store.stepIndex - 1), highlightRect: null, isAnswering: false, currentQuestion: null, currentAnswer: null };
    case 'EXIT_TOUR':
      return { ...store, active: false, tour: null, tourId: null, steps: [], stepIndex: 0, highlightRect: null, isAnswering: false, currentQuestion: null, currentAnswer: null };
    case 'PAUSE':
      return { ...store, paused: true };
    case 'RESUME':
      return { ...store, paused: false };
    case 'SHOW_LAUNCHER':
      return { ...store, showLauncher: true };
    case 'HIDE_LAUNCHER':
      return { ...store, showLauncher: false };
    case 'SET_HIGHLIGHT':
      return { ...store, highlightRect: action.rect };
    case 'MARK_COMPLETED':
      return {
        ...store,
        completedTours: store.completedTours.includes(action.tourId)
          ? store.completedTours
          : [...store.completedTours, action.tourId],
      };
    case 'BEGIN_QA':
      return { ...store, isAnswering: true, currentQuestion: action.question, currentAnswer: null };
    case 'RESOLVE_QA': {
      const entry: QAEntry = {
        id: Date.now().toString(),
        question: store.currentQuestion ?? '',
        answer: action.answer,
        stepId: store.steps[store.stepIndex]?.id ?? '',
        timestamp: new Date().toISOString(),
      };
      return { ...store, currentAnswer: action.answer, isAnswering: false, qaLog: [...store.qaLog, entry] };
    }
    case 'DISMISS_QA':
      return { ...store, currentQuestion: null, currentAnswer: null, isAnswering: false };
    default:
      return store;
  }
}

interface GuidedContextValue {
  store: GuidedStore;
  currentStep: GuidedStep | null;
  startTour: (tourId: string, mode?: 'tour' | 'demo') => void;
  nextStep: () => void;
  prevStep: () => void;
  exitTour: () => void;
  showLauncher: () => void;
  hideLauncher: () => void;
  setHighlight: (rect: HighlightRect | null) => void;
  beginQA: (question: string) => void;
  resolveQA: (answer: string) => void;
  dismissQA: () => void;
}

const GuidedCtx = createContext<GuidedContextValue | null>(null);

export function GuidedExperienceProvider({ children }: { children: React.ReactNode }) {
  const [store, dispatch] = useReducer(guidedReducer, initialStore);

  const currentStep = store.steps[store.stepIndex] ?? null;

  const startTour = useCallback((tourId: string, mode?: 'tour' | 'demo') =>
    dispatch({ type: 'START_TOUR', tourId, mode }), []);
  const nextStep = useCallback(() => dispatch({ type: 'NEXT_STEP' }), []);
  const prevStep = useCallback(() => dispatch({ type: 'PREV_STEP' }), []);
  const exitTour = useCallback(() => dispatch({ type: 'EXIT_TOUR' }), []);
  const showLauncherFn = useCallback(() => dispatch({ type: 'SHOW_LAUNCHER' }), []);
  const hideLauncherFn = useCallback(() => dispatch({ type: 'HIDE_LAUNCHER' }), []);
  const setHighlight = useCallback((rect: HighlightRect | null) => dispatch({ type: 'SET_HIGHLIGHT', rect }), []);
  const beginQA = useCallback((question: string) => dispatch({ type: 'BEGIN_QA', question }), []);
  const resolveQA = useCallback((answer: string) => dispatch({ type: 'RESOLVE_QA', answer }), []);
  const dismissQA = useCallback(() => dispatch({ type: 'DISMISS_QA' }), []);

  return (
    <GuidedCtx.Provider value={{
      store, currentStep,
      startTour, nextStep, prevStep, exitTour,
      showLauncher: showLauncherFn, hideLauncher: hideLauncherFn,
      setHighlight, beginQA, resolveQA, dismissQA,
    }}>
      {children}
    </GuidedCtx.Provider>
  );
}

export function useGuidedExperience() {
  const ctx = useContext(GuidedCtx);
  if (!ctx) throw new Error('useGuidedExperience must be used within GuidedExperienceProvider');
  return ctx;
}
