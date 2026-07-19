/**
 * Ada Safeguards — client-side protection layer.
 *
 * These checks run BEFORE a message reaches the backend and BEFORE any
 * AI-returned command is executed. They guard against:
 *   • Prompt injection / jailbreak attempts
 *   • Role-play and persona override attacks
 *   • System-prompt leakage attempts
 *   • Off-scope requests (harmful content)
 *   • Command spoofing from malicious AI responses
 *   • Rapid-fire message flooding
 */

import { AdaCommand } from './AdaContext';

// ── Types ────────────────────────────────────────────────────────────────────

export type GuardResult =
  | { safe: true }
  | { safe: false; reason: 'injection' | 'harmful' | 'scope' | 'length' | 'rate'; reply: string };

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_INPUT_LENGTH = 800;
const RATE_LIMIT_WINDOW_MS = 5000;
const RATE_LIMIT_MAX_MESSAGES = 5;

// ── Rate-limit state (module-level, resets on page reload) ──────────────────

const msgTimestamps: number[] = [];

// ── Pattern lists ────────────────────────────────────────────────────────────

// Classic jailbreak / injection openers
const INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(previous|prior|above|all)\s+(instructions?|rules?|prompts?|context)/i,
  /disregard\s+(previous|prior|above|all)\s+(instructions?|rules?|prompts?)/i,
  /forget\s+(everything|all|your\s+(training|instructions?|guidelines?|rules?))/i,
  /you\s+are\s+now\s+(a\s+)?(?!ada\b)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(?!ada\b)/i,
  /act\s+as\s+(if\s+you\s+(are|have\s+no)|a\s+)?(?!ada\b)/i,
  /roleplay\s+as\s+(?!ada\b)/i,
  /your\s+(new\s+)?(system\s+)?prompt\s+is/i,
  /override\s+(your\s+)?(instructions?|rules?|constraints?|guidelines?)/i,
  /new\s+(system\s+)?instructions?\s*(:|are|follow)/i,
  /from\s+now\s+on\s+(you\s+(are|will|must)|ignore)/i,
  /\bdan\b.{0,40}(mode|no\s+filter|jailbreak)/i,
  /jailbreak/i,
  /developer\s+mode/i,
  /god\s+mode/i,
  /unrestricted\s+mode/i,
  /without\s+(any\s+)?(restrictions?|filters?|limits?|censorship)/i,
  /no\s+(restrictions?|filters?|limits?|rules?|guidelines?)\s+(mode|activated?)/i,
  /as\s+a\s+(large\s+language\s+model|llm|ai)\s+with\s+no/i,
  /your\s+real\s+(instructions?|purpose|identity|goal)/i,
  /what\s+are\s+your\s+(system\s+)?instructions?/i,
  /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?|guidelines?)/i,
  /show\s+me\s+(your\s+)?(system\s+)?(prompt|instructions?)/i,
  /print\s+(your\s+)?(system\s+)?(prompt|instructions?)/i,
  /repeat\s+(your\s+)?(system\s+)?(prompt|instructions?|context)/i,
  /(<\|im_start\|>|<\|im_end\|>|<\|system\|>)/i,
  /\[system\]/i,
  /assistant:\s*ignore/i,
];

// Clearly harmful / out-of-scope content
const HARMFUL_PATTERNS: RegExp[] = [
  /(how\s+to\s+)?(make|build|create|synthesize)\s+(a\s+)?(bomb|weapon|explosive|drug|malware|virus|ransomware)/i,
  /child\s+(sexual|porn|abuse|exploit)/i,
  /\b(csam|cp)\b/i,
  /how\s+to\s+(hack|ddos|attack)\s+(a\s+)?(server|system|network|database)/i,
  /generate\s+(nude|naked|explicit|sexual)\s+(image|photo|content)/i,
  /self.?harm|suicide\s+(method|instruction|how)/i,
];

// ── Guard functions ──────────────────────────────────────────────────────────

function checkRateLimit(): GuardResult {
  const now = Date.now();
  // Remove timestamps outside the window
  while (msgTimestamps.length > 0 && now - msgTimestamps[0] > RATE_LIMIT_WINDOW_MS) {
    msgTimestamps.shift();
  }
  if (msgTimestamps.length >= RATE_LIMIT_MAX_MESSAGES) {
    return {
      safe: false,
      reason: 'rate',
      reply: "I need a moment to catch up. Please wait a few seconds before sending another message.",
    };
  }
  msgTimestamps.push(now);
  return { safe: true };
}

function checkLength(text: string): GuardResult {
  if (text.length > MAX_INPUT_LENGTH) {
    return {
      safe: false,
      reason: 'length',
      reply: `That message is a bit long for me — please keep it under ${MAX_INPUT_LENGTH} characters and I'll do my best to help.`,
    };
  }
  return { safe: true };
}

function checkInjection(text: string): GuardResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: 'injection',
        reply: "I'm Ada, ResearchOS's research assistant. I'm not able to change my identity, override my guidelines, or discuss my underlying configuration. Is there something about your research I can help you with?",
      };
    }
  }
  return { safe: true };
}

function checkHarmful(text: string): GuardResult {
  for (const pattern of HARMFUL_PATTERNS) {
    if (pattern.test(text)) {
      return {
        safe: false,
        reason: 'harmful',
        reply: "That's outside what I'm designed to help with. I'm here to support your research work — let me know if there's something in that space I can assist with.",
      };
    }
  }
  return { safe: true };
}

/**
 * Run all input guards in order. Returns the first failure or safe.
 */
export function guardInput(text: string): GuardResult {
  const trimmed = text.trim();
  if (!trimmed) return { safe: true };

  const checks: Array<() => GuardResult> = [
    () => checkRateLimit(),
    () => checkLength(trimmed),
    () => checkInjection(trimmed),
    () => checkHarmful(trimmed),
  ];

  for (const check of checks) {
    const result = check();
    if (!result.safe) return result;
  }
  return { safe: true };
}

// ── Command validation ───────────────────────────────────────────────────────

// Allowed setting keys Ada may change — anything not in this list is rejected
const ALLOWED_SETTING_KEYS = new Set([
  'language', 'timezone', 'adaPersonality', 'adaProactive', 'adaGuidance',
  'adaBrief', 'adaCelebrations', 'gpsAccuracy', 'dupThreshold', 'passThreshold',
  'minDuration', 'maxDuration', 'mediaRetention', 'notifyEmail', 'notifySlack',
  'notifyInApp', 'sessionTimeout', 'twoFa',
  'brandPrimaryColor', 'brandAccentColor', 'brandFooter',
]);

const ALLOWED_PATH_PREFIXES = [
  '/overview', '/submissions', '/enumerators', '/map', '/insights', '/reports',
  '/questionnaire', '/settings', '/integrations', '/data-cleaning', '/scorecard',
  '/outcome', '/meeting-ada', '/projects',
];

const ALLOWED_VERDICTS = new Set(['PASS', 'FLAG', 'REJECT', 'ALL']);

/**
 * Validate that a command returned by the AI backend is legitimate before
 * executing it. Rejects anything that doesn't match the known safe schema.
 */
export function validateCommand(cmd: unknown): cmd is AdaCommand {
  if (!cmd || typeof cmd !== 'object') return false;
  const c = cmd as Record<string, unknown>;

  switch (c.type) {
    case 'FILTER_SUBMISSIONS':
      return ALLOWED_VERDICTS.has(c.verdict as string);

    case 'HIGHLIGHT_ENUMERATOR':
      return typeof c.id === 'string' && /^[A-Z0-9_-]{1,20}$/i.test(c.id as string);

    case 'NAVIGATE_TO':
      return typeof c.path === 'string' &&
        ALLOWED_PATH_PREFIXES.some(p => (c.path as string) === p || (c.path as string).startsWith(p + '/') || (c.path as string).startsWith(p + '?'));

    case 'SWITCH_PROJECT':
      return typeof c.id === 'string' && c.id.length < 64;

    case 'CHANGE_SETTING': {
      const allSettingKeys = new Set([
        ...Array.from(ALLOWED_SETTING_KEYS),
        'passScoreThreshold','flagScoreThreshold','minDurationMins','maxDurationMins',
        'gpsToleranceMeters','weight_gps','weight_duration','weight_image','weight_audio','weight_duplicate',
      ]);
      if (!allSettingKeys.has(c.key as string)) return false;
      const v = c.value;
      if (c.key === 'adaPersonality') return ['professional', 'friendly', 'concise'].includes(v as string);
      const boolKeys = ['adaProactive','adaGuidance','adaBrief','adaCelebrations','notifyEmail','notifySlack','notifyInApp','twoFa'];
      if (boolKeys.includes(c.key as string)) return typeof v === 'boolean';
      const numKeys = ['gpsAccuracy','dupThreshold','passThreshold','minDuration','maxDuration',
        'passScoreThreshold','flagScoreThreshold','minDurationMins','maxDurationMins',
        'gpsToleranceMeters','weight_gps','weight_duration','weight_image','weight_audio','weight_duplicate'];
      if (numKeys.includes(c.key as string)) return typeof v === 'number' && isFinite(v as number);
      return typeof v === 'string' && (v as string).length < 64;
    }

    case 'RESCORE_PROJECT':
      return typeof c.project_id === 'string' && c.project_id.length > 0;

    case 'BRIDGE_SYNC':
      return typeof c.project_id === 'string' && c.project_id.length > 0;

    case 'GENERATE_REPORT':
      return typeof c.project_id === 'string' && ['docx','pptx','xlsx'].includes(c.format as string);

    case 'OPEN_SETTINGS_SECTION':
    case 'CREATE_PROJECT':
    case 'SHOW_TOAST':
      return true;

    default:
      return false;
  }
}
