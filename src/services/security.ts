/**
 * Frontend security utilities
 * CSRF protection, request throttling, and suspicious activity detection
 */

import { AxiosError } from 'axios';

const CSRF_TOKEN_KEY = 'csrf_token';
const REQUEST_THROTTLE_MS = 500;
const MAX_REQUESTS_PER_MINUTE = 60;

let lastRequestTime = 0;
let requestCount = 0;
let requestCountResetTime = Date.now();

/**
 * Generate a CSRF token for form submissions
 */
export function generateCSRFToken(): string {
  const token = Math.random().toString(36).substring(2, 15) +
                Math.random().toString(36).substring(2, 15);
  sessionStorage.setItem(CSRF_TOKEN_KEY, token);
  return token;
}

/**
 * Get the stored CSRF token
 */
export function getCSRFToken(): string {
  return sessionStorage.getItem(CSRF_TOKEN_KEY) || '';
}

/**
 * Validate CSRF token before submission
 */
export function validateCSRFToken(token: string): boolean {
  const stored = getCSRFToken();
  return stored && token === stored && token.length > 16;
}

/**
 * Check if request should be throttled
 */
export function shouldThrottleRequest(): boolean {
  const now = Date.now();

  // Reset counter every minute
  if (now - requestCountResetTime > 60000) {
    requestCount = 0;
    requestCountResetTime = now;
  }

  // Check minute-level limit (60 req/min max)
  if (requestCount >= MAX_REQUESTS_PER_MINUTE) {
    console.warn('[Security] Rate limit exceeded: 60 requests per minute');
    return true;
  }

  // Check sub-second throttling (minimum 500ms between requests)
  if (now - lastRequestTime < REQUEST_THROTTLE_MS) {
    console.warn('[Security] Request throttled: too fast');
    return true;
  }

  lastRequestTime = now;
  requestCount++;
  return false;
}

/**
 * Check if an error response indicates we're not a real user
 */
export function isNonUserError(error: AxiosError): boolean {
  const status = error.response?.status || 0;
  const data = error.response?.data as any;

  // 403: Forbidden (suspicious activity, bot detection)
  if (status === 403) {
    return true;
  }

  // 429: Too many requests (rate limited)
  if (status === 429) {
    return true;
  }

  // Check for bot-specific error messages
  const message = data?.error || '';
  const botMessages = [
    'unsupported client',
    'suspicious',
    'bot',
    'automated',
    'crawler'
  ];

  return botMessages.some(msg => message.toLowerCase().includes(msg));
}

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string, maxLength: number = 1000): string {
  if (!input) return '';

  let sanitized = input
    .substring(0, maxLength)
    .trim()
    .replace(/[<>\"']/g, match => ({
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    })[match] || match);

  return sanitized;
}

/**
 * Check for suspicious patterns in input
 */
export function hasSuspiciousPatterns(input: string): boolean {
  const suspiciousPatterns = [
    /(\bOR\b|union|select|drop|exec|script)/i,
    /<script|javascript:|onerror=/i,
    /eval\(|Function\(|setTimeout\(/i,
    /document\.|window\.|location\./i,
  ];

  return suspiciousPatterns.some(pattern => pattern.test(input));
}

/**
 * Detect if user might be a bot based on behavior
 */
export function detectBotBehavior(): boolean {
  // Check if page has been interacted with (mouse/keyboard events)
  let hasInteracted = false;

  const onInteract = () => {
    hasInteracted = true;
    document.removeEventListener('mousemove', onInteract);
    document.removeEventListener('keydown', onInteract);
    document.removeEventListener('click', onInteract);
    document.removeEventListener('touchstart', onInteract);
  };

  document.addEventListener('mousemove', onInteract, { once: true });
  document.addEventListener('keydown', onInteract, { once: true });
  document.addEventListener('click', onInteract, { once: true });
  document.addEventListener('touchstart', onInteract, { once: true });

  // If no interaction within 10 seconds, likely not a real user
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(!hasInteracted);
    }, 10000);
  });
}

/**
 * Validate that request came from legitimate browser
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Requested-With': 'XMLHttpRequest',
    'X-CSRF-Token': getCSRFToken(),
  };
}
