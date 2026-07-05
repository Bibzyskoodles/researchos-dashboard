import React, { createContext, useContext, useReducer, useCallback, useRef } from 'react';
import { AdaState, AdaMessage, AdaContext as AdaContextType } from '../types';

interface AdaStore {
  state: AdaState;
  previousState: AdaState | null;
  messages: AdaMessage[];
  isTyping: boolean;
  position: { x: number; y: number };
  exitEdge: { edge: string; position: number } | null;
  currentPage: string;
  isOpen: boolean;
}

type AdaAction =
  | { type: 'SET_STATE'; state: AdaState }
  | { type: 'ADD_MESSAGE'; message: AdaMessage }
  | { type: 'SET_TYPING'; isTyping: boolean }
  | { type: 'SET_POSITION'; x: number; y: number }
  | { type: 'SET_EXIT_EDGE'; edge: string; position: number }
  | { type: 'SET_PAGE'; page: string }
  | { type: 'TOGGLE_OPEN' }
  | { type: 'SET_OPEN'; open: boolean }
  | { type: 'CLEAR_MESSAGES' };

const initialState: AdaStore = {
  state: 'idle',
  previousState: null,
  messages: [],
  isTyping: false,
  position: { x: 0.92, y: 0.88 },
  exitEdge: null,
  currentPage: 'overview',
  isOpen: false,
};

function adaReducer(store: AdaStore, action: AdaAction): AdaStore {
  switch (action.type) {
    case 'SET_STATE':
      return { ...store, previousState: store.state, state: action.state };
    case 'ADD_MESSAGE':
      return { ...store, messages: [...store.messages, action.message] };
    case 'SET_TYPING':
      return { ...store, isTyping: action.isTyping };
    case 'SET_POSITION':
      return { ...store, position: { x: action.x, y: action.y } };
    case 'SET_EXIT_EDGE':
      return { ...store, exitEdge: { edge: action.edge, position: action.position } };
    case 'SET_PAGE':
      return { ...store, currentPage: action.page };
    case 'TOGGLE_OPEN':
      return { ...store, isOpen: !store.isOpen };
    case 'SET_OPEN':
      return { ...store, isOpen: action.open };
    case 'CLEAR_MESSAGES':
      return { ...store, messages: [] };
    default:
      return store;
  }
}

interface AdaContextValue {
  store: AdaStore;
  setState: (state: AdaState) => void;
  addMessage: (message: AdaMessage) => void;
  setTyping: (isTyping: boolean) => void;
  setPosition: (x: number, y: number) => void;
  navigatePage: (page: string) => void;
  toggleOpen: () => void;
  setOpen: (open: boolean) => void;
  computeExitEdge: () => { edge: string; position: number };
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

  const setTyping = useCallback((isTyping: boolean) => {
    dispatch({ type: 'SET_TYPING', isTyping });
  }, []);

  const setPosition = useCallback((x: number, y: number) => {
    dispatch({ type: 'SET_POSITION', x, y });
  }, []);

  const computeExitEdge = useCallback(() => {
    const { x, y } = store.position;
    const distances = { left: x, right: 1 - x, top: y, bottom: 1 - y };
    const edge = Object.entries(distances).reduce((a, b) => a[1] < b[1] ? a : b)[0];
    const position = edge === 'left' || edge === 'right' ? y : x;
    return { edge, position };
  }, [store.position]);

  const navigatePage = useCallback((page: string) => {
    const exitEdge = computeExitEdge();
    dispatch({ type: 'SET_EXIT_EDGE', edge: exitEdge.edge, position: exitEdge.position });
    dispatch({ type: 'SET_PAGE', page });
  }, [computeExitEdge]);

  const toggleOpen = useCallback(() => {
    dispatch({ type: 'TOGGLE_OPEN' });
  }, []);

  const setOpen = useCallback((open: boolean) => {
    dispatch({ type: 'SET_OPEN', open });
  }, []);

  return (
    <AdaCtx.Provider value={{
      store, setState, addMessage, setTyping,
      setPosition, navigatePage, toggleOpen, setOpen, computeExitEdge
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
