import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { AdaState, AdaMessage } from '../types';

interface GuideTarget {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Commands Ada can issue to adjust the UI when the user asks. She can filter,
// highlight, navigate, switch project, and change settings — never delete or submit.
export type AdaCommand =
  | { type: 'FILTER_SUBMISSIONS'; verdict: 'PASS' | 'FLAG' | 'REJECT' | 'ALL' }
  | { type: 'HIGHLIGHT_ENUMERATOR'; id: string }
  | { type: 'NAVIGATE_TO'; path: string; state?: Record<string, unknown> }
  | { type: 'OPEN_SETTINGS_SECTION'; section: string; label: string }
  | { type: 'SWITCH_PROJECT'; id: string }
  | { type: 'CREATE_PROJECT' }
  | { type: 'SHOW_TOAST'; message: string }
  | { type: 'CHANGE_SETTING'; key: string; value: any; label: string };

// Map a natural-language message to a command intent, or null if none.
export function parseAdaCommand(text: string): AdaCommand | null {
  const t = (text || '').toLowerCase();

  // Enumerator highlight — e.g. "show me ENID0010's submissions"
  const enumMatch = text.match(/\b(ENID\d{3,})\b/i);
  if (enumMatch && /(show|highlight|find|filter|only)/.test(t)) {
    return { type: 'HIGHLIGHT_ENUMERATOR', id: enumMatch[1].toUpperCase() };
  }

  // Verdict filter
  if (/(all submissions|clear (the )?filter|reset|show everything)/.test(t)) {
    return { type: 'FILTER_SUBMISSIONS', verdict: 'ALL' };
  }
  if (/(flag|flagged)/.test(t)) return { type: 'FILTER_SUBMISSIONS', verdict: 'FLAG' };
  if (/(reject|rejected|failed)/.test(t)) return { type: 'FILTER_SUBMISSIONS', verdict: 'REJECT' };
  if (/(passed|passing|approved|clean)/.test(t)) return { type: 'FILTER_SUBMISSIONS', verdict: 'PASS' };

  // ── Create project ──────────────────────────────────────────────────────────
  if (/(create|new|start|add|make)\s+(a\s+)?(new\s+)?project/.test(t)) {
    return { type: 'CREATE_PROJECT' };
  }

  // ── Settings sections — specific sub-pages ───────────────────────────────
  const settingsSectionMap: [RegExp, string, string][] = [
    [/(billing|payment|plan|invoice|subscription|upgrade|paystack)/, 'billing', 'Billing'],
    [/(team|member|people|collaborat|invite|staff)/, 'team', 'Team & Members'],
    [/(notification|alert|email notif|slack notif)/, 'notifications', 'Notifications'],
    [/(ada|ai setting|ai config|personality|briefing|proactive)/, 'ada', 'AI & Ada'],
    [/(brand|logo|color|colour|theme|appearance|organisation|organization|org name)/, 'organization', 'Organization'],
    [/(permission|role|access|admin|viewer|manager)/, 'permissions', 'Permissions'],
    [/(security|password|2fa|two.factor|session|login)/, 'security', 'Security'],
    [/(integration|kobo|webhook|api key|connect)/, 'integrations', 'Integrations'],
    [/(research default|gps|accuracy|duration|threshold|data collection)/, 'research', 'Research Defaults'],
    [/(audit|log|activity|history)/, 'audit', 'Audit Log'],
    [/(danger|delete org|reset)/, 'danger', 'Danger Zone'],
  ];

  const settingsTrigger = /(setting|configure|manage|set up|change|update|open|show)\s/.test(t) || /(go to|take me to|open)\s+(the\s+)?/.test(t);
  if (settingsTrigger || /setting/.test(t)) {
    for (const [pattern, section, label] of settingsSectionMap) {
      if (pattern.test(t)) {
        return { type: 'OPEN_SETTINGS_SECTION', section, label };
      }
    }
  }

  // ── Navigation intents (explicit + config) ───────────────────────────────
  const navPatterns: [RegExp, string][] = [
    [/(go to|open|take me to|show me the?|navigate to|set up|configure|connect|manage)\s+(overview|dashboard|home)/, '/overview'],
    [/(go to|open|take me to|show me the?|navigate to)\s+(all\s+)?submission/, '/submissions'],
    [/(go to|open|take me to|show me the?|navigate to)\s+(field\s+)?(enumerator|interviewer|field agent|surveyor)/, '/enumerators'],
    [/(go to|open|take me to|show me the?|navigate to)\s+(the\s+)?(map|coverage|location)/, '/map'],
    [/(go to|open|take me to|show me the?|navigate to)\s+(insight|analysis|analyse|analyze)/, '/insights'],
    [/(go to|open|take me to|show me the?|navigate to)\s+(report|executive report)/, '/reports'],
    [/(go to|open|take me to|show me the?|navigate to|set up|configure|manage|change)\s+(setting|branding|brand|logo|organization|org|team)/, '/settings'],
    [/(go to|open|take me to|show me the?|navigate to|set up|configure|connect)\s+(integration|kobo|kobotoolbox|webhook|connect)/, '/integrations'],
    [/(go to|open|take me to|show me the?|navigate to)\s+(project list|all projects|my projects)/, '/projects'],
    [/(go to|open|take me to|show me the?|navigate to)\s+(field quality|field.quality)/, '/overview'],
  ];

  for (const [pattern, path] of navPatterns) {
    if (pattern.test(t)) return { type: 'NAVIGATE_TO', path };
  }

  // Catch-all navigation
  if (/(go to|open|take me to|show me the?|navigate to)/.test(t)) {
    const pages: Record<string, string> = {
      overview: '/overview', dashboard: '/overview', home: '/overview',
      submission: '/submissions', enumerator: '/enumerators', interviewer: '/enumerators',
      map: '/map', coverage: '/map', insight: '/insights', analysis: '/insights',
      report: '/reports', questionnaire: '/projects', setting: '/settings',
      integration: '/integrations', project: '/projects', billing: '/settings',
      team: '/settings',
    };
    for (const key of Object.keys(pages)) {
      if (t.includes(key)) {
        // Check if this is a settings sub-section
        if (key === 'billing') return { type: 'OPEN_SETTINGS_SECTION', section: 'billing', label: 'Billing' };
        if (key === 'team') return { type: 'OPEN_SETTINGS_SECTION', section: 'team', label: 'Team & Members' };
        return { type: 'NAVIGATE_TO', path: pages[key] };
      }
    }
  }

  // ── Settings changes ─────────────────────────────────────────────────────

  // Ada personality
  if (/(ada|make her|make you|set you|set ada).*(friendly|warm|casual|personal)/.test(t) ||
      /(friendl(y|ier)|warmer|more casual|more personal).*mode/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaPersonality', value: 'friendly', label: 'Ada set to Friendly mode' };
  }
  if (/(ada|make her|make you|set you|set ada).*(concise|brief|short|minimal|direct)/.test(t) ||
      /(concise|minimal|direct|brief).*mode/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaPersonality', value: 'concise', label: 'Ada set to Concise mode' };
  }
  if (/(ada|make her|make you|set you|set ada).*(professional|formal|enterprise)/.test(t) ||
      /(professional|formal).*mode/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaPersonality', value: 'professional', label: 'Ada set to Professional mode' };
  }

  // Ada behaviour toggles
  if (/(turn on|enable|activate).*(proactive|briefing)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaProactive', value: true, label: 'Proactive briefings enabled' };
  }
  if (/(turn off|disable|stop).*(proactive|briefing)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaProactive', value: false, label: 'Proactive briefings disabled' };
  }
  if (/(turn on|enable|activate).*(element guidance|guidance|highlight)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaGuidance', value: true, label: 'Element guidance enabled' };
  }
  if (/(turn off|disable|stop).*(element guidance|guidance|highlight)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaGuidance', value: false, label: 'Element guidance disabled' };
  }
  if (/(turn on|enable|activate).*(daily|morning|summary|brief)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaBrief', value: true, label: 'Daily summary brief enabled' };
  }
  if (/(turn off|disable|stop).*(daily|morning|summary|brief)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaBrief', value: false, label: 'Daily summary brief disabled' };
  }
  if (/(turn on|enable).*(celebration|milestone)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaCelebrations', value: true, label: 'Milestone celebrations enabled' };
  }
  if (/(turn off|disable|stop).*(celebration|milestone)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'adaCelebrations', value: false, label: 'Milestone celebrations disabled' };
  }

  // Language
  const langMap: Record<string, string> = {
    english: 'English', french: 'French', arabic: 'Arabic', portuguese: 'Portuguese',
    swahili: 'Swahili', hausa: 'Hausa', yoruba: 'Yoruba', igbo: 'Igbo',
  };
  const langMatch = t.match(/(change|set|switch).*(language|lang).*?(?:to\s+)?(\w+)/);
  if (langMatch) {
    const lang = langMap[langMatch[3]];
    if (lang) return { type: 'CHANGE_SETTING', key: 'language', value: lang, label: `Primary language set to ${lang}` };
  }

  // Timezone
  const tzMap: Record<string, string> = {
    lagos: 'Africa/Lagos', 'africa/lagos': 'Africa/Lagos',
    utc: 'UTC', london: 'Europe/London', 'new york': 'America/New_York',
    'new_york': 'America/New_York', 'kolkata': 'Asia/Kolkata', india: 'Asia/Kolkata',
  };
  if (/(change|set|switch).*(timezone|time zone)/.test(t)) {
    for (const [key, tz] of Object.entries(tzMap)) {
      if (t.includes(key)) return { type: 'CHANGE_SETTING', key: 'timezone', value: tz, label: `Timezone set to ${tz}` };
    }
  }

  // Notifications
  if (/(turn on|enable).*(email).*(notif|alert)/.test(t) || /(email).*(notif|alert).*(on|enable)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'notifyEmail', value: true, label: 'Email notifications enabled' };
  }
  if (/(turn off|disable|stop).*(email).*(notif|alert)/.test(t) || /(email).*(notif|alert).*(off|disable)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'notifyEmail', value: false, label: 'Email notifications disabled' };
  }
  if (/(turn on|enable).*(slack).*(notif|alert)/.test(t) || /(slack).*(notif|alert).*(on|enable)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'notifySlack', value: true, label: 'Slack notifications enabled' };
  }
  if (/(turn off|disable|stop).*(slack).*(notif|alert)/.test(t) || /(slack).*(notif|alert).*(off|disable)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'notifySlack', value: false, label: 'Slack notifications disabled' };
  }
  if (/(turn off|disable|stop).*(in.?app).*(notif|alert)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'notifyInApp', value: false, label: 'In-app notifications disabled' };
  }
  if (/(turn on|enable).*(in.?app).*(notif|alert)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'notifyInApp', value: true, label: 'In-app notifications enabled' };
  }

  // Research defaults — GPS accuracy
  const gpsMatch = t.match(/(gps|accuracy|tolerance).*?(\d+)\s*(m|meter|metre)?/);
  if (gpsMatch && /(set|change|update|gps|accuracy)/.test(t)) {
    const val = Math.min(500, Math.max(10, Number(gpsMatch[2])));
    return { type: 'CHANGE_SETTING', key: 'gpsAccuracy', value: val, label: `GPS accuracy set to ${val}m` };
  }

  // Pass threshold
  const passMatch = t.match(/(pass|score|threshold).*?(\d+)/);
  if (passMatch && /(set|change|update|lower|raise|increase|decrease).*(pass|threshold)/.test(t)) {
    const val = Math.min(100, Math.max(0, Number(passMatch[2])));
    return { type: 'CHANGE_SETTING', key: 'passThreshold', value: val, label: `Pass threshold set to ${val}` };
  }

  // Duplicate detection threshold
  const dupMatch = t.match(/(duplicate|dup|similarity).*?(\d+)(%)?/);
  if (dupMatch && /(set|change|update).*(dup|duplicate|similarity)/.test(t)) {
    const val = Math.min(100, Math.max(50, Number(dupMatch[2])));
    return { type: 'CHANGE_SETTING', key: 'dupThreshold', value: val, label: `Duplicate threshold set to ${val}%` };
  }

  // Min/max interview duration
  const minMatch = t.match(/(min(imum)?|fastest|shortest).*?(\d+)\s*(min|minute)?/);
  if (minMatch && /(set|change|update).*(min|duration|interview)/.test(t)) {
    const val = Math.min(60, Math.max(1, Number(minMatch[3])));
    return { type: 'CHANGE_SETTING', key: 'minDuration', value: val, label: `Minimum interview duration set to ${val} mins` };
  }
  const maxMatch = t.match(/(max(imum)?|longest|slowest).*?(\d+)\s*(min|minute)?/);
  if (maxMatch && /(set|change|update).*(max|duration|interview)/.test(t)) {
    const val = Math.min(360, Math.max(30, Number(maxMatch[3])));
    return { type: 'CHANGE_SETTING', key: 'maxDuration', value: val, label: `Maximum interview duration set to ${val} mins` };
  }

  // Session timeout
  const sessionMap: Record<string, string> = {
    '1 hour': '1h', '1h': '1h', '4 hour': '4h', '4h': '4h',
    '8 hour': '8h', '8h': '8h', '24 hour': '24h', '24h': '24h', '1 day': '24h',
    '7 day': '7d', '7d': '7d', '1 week': '7d',
  };
  if (/(session|logout|timeout)/.test(t)) {
    for (const [key, val] of Object.entries(sessionMap)) {
      if (t.includes(key)) return { type: 'CHANGE_SETTING', key: 'sessionTimeout', value: val, label: `Session timeout set to ${val}` };
    }
  }

  // 2FA
  if (/(turn on|enable|activate).*(2fa|two.factor|two factor)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'twoFa', value: true, label: 'Two-factor authentication enabled' };
  }
  if (/(turn off|disable).*(2fa|two.factor|two factor)/.test(t)) {
    return { type: 'CHANGE_SETTING', key: 'twoFa', value: false, label: 'Two-factor authentication disabled' };
  }

  return null;
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
  command: (AdaCommand & { seq: number }) | null;
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
  | { type: 'SET_GUIDE_TARGET'; target: GuideTarget | null }
  | { type: 'SET_COMMAND'; command: AdaCommand };

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
  command: null,
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
    case 'SET_COMMAND':
      return { ...store, command: { ...action.command, seq: (store.command?.seq ?? 0) + 1 } };
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
  dispatchCommand: (command: AdaCommand) => void;
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

  const dispatchCommand = useCallback((command: AdaCommand) => {
    dispatch({ type: 'SET_COMMAND', command });
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
      dispatchCommand,
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
