import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { AdaState, AdaMessage } from '../types';

interface GuideTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface AdaStore {
  state: AdaState;
  previousState: AdaState | null;
  messages: AdaMessage[];
  isTyping: boolean;
  position: { x: number; y: number };
  exitEdge: { edge: string; position: number } | null;
  exitPending: boolean;
  currentPage: string;
  isOpen: boolean;
  memoryLoaded: boolean;
  guideTarget: GuideTarget | null;
}

type AdaAction =
  | { type: 'SET_STATE'; state: AdaState }
  | { type: 'ADD_MESSAGE'; message: AdaMessage }
  | { type: 'SET_MESSAGES'; messages: AdaMessage[] }
  | { type: 'SET_TYPING'; isTyping: boolean }
  | { type: 'SET_POSITION'; x: number; y: number }
  | { type: 'SET_EXIT_EDGE'; edge: string; position: number }
  | { type: 'SET_EXIT_PENDING'; pending: boolean }
  | { type: 'SET_PAGE'; page: string }
  | { type: 'TOGGLE_OPEN' }
  | { type: 'SET_OPEN'; open: boolean }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'SET_MEMORY_LOADED' }
  | { type: 'SET_GUIDE_TARGET'; target: GuideTarget | null };

const initialState: AdaStore = {
  state: 'idle',
  previousState: null,
  messages: [],
  isTyping: false,
  position: { x: 0.92, y: 0.88 },
  exitEdge: null,
  exitPending: false,
  currentPage: 'overview',
  isOpen: false,
  memoryLoaded: false,
  guideTarget: null,
};

function adaReducer(store: AdaStore, action: AdaAction): AdaStore {
  switch (action.type) {
    case 'SET_STATE':
      return { ...store, previousState: store.state, state: action.state };
    case 'ADD_MESSAGE':
      return { ...store, messages: [...store.messages, action.message] };
    case 'SET_MESSAGES':
      return { ...store, messages: action.messages };
    case 'SET_TYPING':
      return { ...store, isTyping: action.isTyping };
    case 'SET_POSITION':
      return { ...store, position: { x: action.x, y: action.y } };
    case 'SET_EXIT_EDGE':
      return { ...store, exitEdge: { edge: action.edge, position: action.position } };
    case 'SET_EXIT_PENDING':
      return { ...store, exitPending: action.pending };
    case 'SET_PAGE':
      return { ...store, currentPage: action.page };
    case 'TOGGLE_OPEN':
      return { ...store, isOpen: !store.isOpen };
    case 'SET_OPEN':
      return { ...store, isOpen: action.open };
    case 'CLEAR_MESSAGES':
      return { ...store, messages: [] };
    case 'SET_MEMORY_LOADED':
      return { ...store, memoryLoaded: true };
    case 'SET_GUIDE_TARGET':
      return { ...store, guideTarget: action.target };
    default:
      return store;
  }
}

interface AdaContextValue {
  store: AdaStore;
  setState: (state: AdaState) => void;
  addMessage: (message: AdaMessage) => void;
  setMessages: (messages: AdaMessage[]) => void;
  setTyping: (isTyping: boolean) => void;
  setPosition: (x: number, y: number) => void;
  navigatePage: (page: string) => void;
  startExit: () => void;
  clearExit: () => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  computeExitEdge: () => { edge: string; position: number };
  markMemoryLoaded: () => void;
  guideToElement: (selector: string, returnAfterMs?: number) => void;
}

const AdaCtx = createContext<AdaContextValue | null>(null);

export function AdaProvider({ children }: { children: React.ReactNode }) {
  const [store, dispatch] = useReducer(adaReducer, initialState);

  const setState = useCallback((state: AdaState) => {
    dispatch({ type: 'SET_STATE', state });
  }, []);

  const addMessage = useCallback((message: AdaMessage) => {
    dispatch({ type: 'ADD_MESSAGE', message });
  }, []);

  const setMessages = useCallback((messages: AdaMessage[]) => {
    dispatch({ type: 'SET_MESSAGES', messages });
  }, []);

  const setTyping = useCallback((isTyping: boolean) => {
    dispatch({ type: 'SET_TYPING', isTyping });
  }, []);

  const setPosition = useCallback((x: number, y: number) => {
    dispatch({ type: 'SET_POSITION', x, y });
  }, []);

  const computeExitEdge = useCallback(() => {
    const { x, y } = store.position;
    const distances: Record<string, number> = { left: x, right: 1 - x, top: y, bottom: 1 - y };
    const edge = Object.entries(distances).reduce((a, b) => a[1] < b[1] ? a : b)[0];
    const position = edge === 'left' || edge === 'right' ? y : x;
    return { edge, position };
  }, [store.position]);

  const navigatePage = useCallback((page: string) => {
    const exitEdge = computeExitEdge();
    dispatch({ type: 'SET_EXIT_EDGE', edge: exitEdge.edge, position: exitEdge.position });
    dispatch({ type: 'SET_PAGE', page });
  }, [computeExitEdge]);

  const startExit = useCallback(() => {
    const exitEdge = computeExitEdge();
    dispatch({ type: 'SET_EXIT_EDGE', edge: exitEdge.edge, position: exitEdge.position });
    dispatch({ type: 'SET_EXIT_PENDING', pending: true });
  }, [computeExitEdge]);

  const clearExit = useCallback(() => {
    dispatch({ type: 'SET_EXIT_PENDING', pending: false });
  }, []);

  const toggleOpen = useCallback(() => {
    dispatch({ type: 'TOGGLE_OPEN' });
  }, []);

  const setOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_OPEN', open });
  }, []);

  const markMemoryLoaded = useCallback(() => {
    dispatch({ type: 'SET_MEMORY_LOADED' });
  }, []);

  const guideToElement = useCallback((selector: string, returnAfterMs = 3000) => {
    const el = document.querySelector(`[data-ada-target="${selector}"]`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dispatch({ type: 'SET_GUIDE_TARGET', target: { x: rect.left, y: rect.top, width: rect.width, height: rect.height } });
    dispatch({ type: 'SET_STATE', state: 'guiding' });
    setTimeout(() => {
      dispatch({ type: 'SET_GUIDE_TARGET', target: null });
      dispatch({ type: 'SET_STATE', state: 'idle' });
    }, returnAfterMs);
  }, []);

  return (
    <AdaCtx.Provider value={{
      store, setState, addMessage, setMessages, setTyping,
      setPosition, navigatePage, startExit, clearExit,
      toggleOpen, setOpen, computeExitEdge, markMemoryLoaded, guideToElement,
    }}>
      {children}
    </AdaCtx.Provider>
  );
}

export function useAda() {
  const ctx = useContext(AdaCtx);
  if (!ctx) throw new Error('useAda must be used within AdaProvider');
  return ctx;
}
