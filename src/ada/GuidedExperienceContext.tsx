import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { GuidedStep, GuidedTour, getTour } from './tours';

export interface HighlightRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface GuidedStore {
  active: boolean;
  tourId: string | null;
  tour: GuidedTour | null;
  stepIndex: number;
  paused: boolean;
  showLauncher: boolean;
  highlightRect: HighlightRect | null;
  completedTours: string[];
}

type GuidedAction =
  | { type: 'START_TOUR'; tourId: string }
  | { type: 'NEXT_STEP' }
  | { type: 'PREV_STEP' }
  | { type: 'EXIT_TOUR' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'SHOW_LAUNCHER' }
  | { type: 'HIDE_LAUNCHER' }
  | { type: 'SET_HIGHLIGHT'; rect: HighlightRect | null }
  | { type: 'MARK_COMPLETED'; tourId: string };

const initialStore: GuidedStore = {
  active: false,
  tourId: null,
  tour: null,
  stepIndex: 0,
  paused: false,
  showLauncher: false,
  highlightRect: null,
  completedTours: [],
};

function guidedReducer(store: GuidedStore, action: GuidedAction): GuidedStore {
  switch (action.type) {
    case 'START_TOUR': {
      const tour = getTour(action.tourId);
      if (!tour) return store;
      return { ...store, active: true, tourId: action.tourId, tour, stepIndex: 0, paused: false, showLauncher: false, highlightRect: null };
    }
    case 'NEXT_STEP': {
      if (!store.tour) return store;
      const next = store.stepIndex + 1;
      if (next >= store.tour.steps.length) {
        return { ...store, active: false, tour: null, tourId: null, stepIndex: 0, highlightRect: null,
          completedTours: store.tourId && !store.completedTours.includes(store.tourId)
            ? [...store.completedTours, store.tourId] : store.completedTours };
      }
      return { ...store, stepIndex: next, highlightRect: null };
    }
    case 'PREV_STEP':
      return { ...store, stepIndex: Math.max(0, store.stepIndex - 1), highlightRect: null };
    case 'EXIT_TOUR':
      return { ...store, active: false, tour: null, tourId: null, stepIndex: 0, highlightRect: null };
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
      return { ...store, completedTours: store.completedTours.includes(action.tourId) ? store.completedTours : [...store.completedTours, action.tourId] };
    default:
      return store;
  }
}

interface GuidedContextValue {
  store: GuidedStore;
  currentStep: GuidedStep | null;
  startTour: (tourId: string) => void;
  nextStep: () => void;
  prevStep: () => void;
  exitTour: () => void;
  showLauncher: () => void;
  hideLauncher: () => void;
  setHighlight: (rect: HighlightRect | null) => void;
}

const GuidedCtx = createContext<GuidedContextValue | null>(null);

export function GuidedExperienceProvider({ children }: { children: React.ReactNode }) {
  const [store, dispatch] = useReducer(guidedReducer, initialStore);

  const currentStep = store.tour ? store.tour.steps[store.stepIndex] ?? null : null;

  const startTour = useCallback((tourId: string) => dispatch({ type: 'START_TOUR', tourId }), []);
  const nextStep = useCallback(() => dispatch({ type: 'NEXT_STEP' }), []);
  const prevStep = useCallback(() => dispatch({ type: 'PREV_STEP' }), []);
  const exitTour = useCallback(() => dispatch({ type: 'EXIT_TOUR' }), []);
  const showLauncherFn = useCallback(() => dispatch({ type: 'SHOW_LAUNCHER' }), []);
  const hideLauncherFn = useCallback(() => dispatch({ type: 'HIDE_LAUNCHER' }), []);
  const setHighlight = useCallback((rect: HighlightRect | null) => dispatch({ type: 'SET_HIGHLIGHT', rect }), []);

  return (
    <GuidedCtx.Provider value={{ store, currentStep, startTour, nextStep, prevStep, exitTour, showLauncher: showLauncherFn, hideLauncher: hideLauncherFn, setHighlight }}>
      {children}
    </GuidedCtx.Provider>
  );
}

export function useGuidedExperience() {
  const ctx = useContext(GuidedCtx);
  if (!ctx) throw new Error('useGuidedExperience must be used within GuidedExperienceProvider');
  return ctx;
}
