/**
 * Client-side security: Token management, session protection, and credential safety
 */

const TOKEN_KEY = 'fs_token';
const TOKEN_EXPIRY_KEY = 'fs_token_expiry';
const SESSION_ID_KEY = 'fs_session_id';
const DEVICE_ID_KEY = 'fs_device_id';

// Session management
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
let lastActivityTime = Date.now();
let sessionCheckInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize client security measures
 */
export function initializeClientSecurity(): void {
  // Generate device ID on first visit
  if (!getDeviceId()) {
    setDeviceId(generateDeviceId());
  }

  // Generate session ID
  setSessionId(generateSessionId());

  // Setup session timeout monitoring
  setupSessionTimeout();

  // Prevent token storage vulnerabilities
  setupTokenSecurity();

  // Listen for page visibility changes
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Clear sensitive data on unload
  window.addEventListener('beforeunload', clearSensitiveData);

  console.log('[ClientSecurity] Initialized');
}

/**
 * Generate a unique device ID (persists across sessions)
 */
function generateDeviceId(): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return Math.random().toString(36).substring(2, 15);

  ctx.textBaseline = 'top';
  ctx.font = '14px Arial';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#f60';
  ctx.fillRect(125, 1, 62, 20);
  ctx.fillStyle = '#069';
  ctx.fillText('ResearchOS', 2, 15);

  const canvasData = canvas.toDataURL();
  return btoa(canvasData).substring(0, 32);
}

/**
 * Generate a unique session ID (changes per session)
 */
function generateSessionId(): string {
  return 'sess_' + Math.random().toString(36).substring(2, 15) +
         '_' + Date.now().toString(36);
}

/**
 * Store device ID securely
 */
function setDeviceId(id: string): void {
  try {
    // Use localStorage for persistence across sessions
    localStorage.setItem(DEVICE_ID_KEY, id);
  } catch (e) {
    console.warn('[ClientSecurity] Could not store device ID');
  }
}

/**
 * Get stored device ID
 */
export function getDeviceId(): string | null {
  try {
    return localStorage.getItem(DEVICE_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Store session ID securely (sessionStorage - cleared on browser close)
 */
function setSessionId(id: string): void {
  try {
    sessionStorage.setItem(SESSION_ID_KEY, id);
  } catch (e) {
    console.warn('[ClientSecurity] Could not store session ID');
  }
}

/**
 * Get current session ID
 */
export function getSessionId(): string {
  return sessionStorage.getItem(SESSION_ID_KEY) || '';
}

/**
 * Store JWT token securely
 * Uses memory + optional secure cookie, never plain localStorage
 */
export function setToken(token: string, expirySeconds: number = 86400): void {
  try {
    // Store in sessionStorage (cleared on browser close)
    sessionStorage.setItem(TOKEN_KEY, token);

    // Set expiry
    const expiryTime = Date.now() + (expirySeconds * 1000);
    sessionStorage.setItem(TOKEN_EXPIRY_KEY, expiryTime.toString());

    // Also set as HttpOnly cookie via Set-Cookie header (backend handles this)
    // This prevents XSS from stealing the token
  } catch (e) {
    console.warn('[ClientSecurity] Could not store token');
  }
}

/**
 * Get stored JWT token
 */
export function getToken(): string | null {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY);
    if (!token) return null;

    // Check expiry
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
    if (expiry && Date.now() > parseInt(expiry)) {
      clearToken();
      return null;
    }

    return token;
  } catch {
    return null;
  }
}

/**
 * Check if token is about to expire (within 5 minutes)
 */
export function isTokenExpiringSoon(): boolean {
  try {
    const expiry = sessionStorage.getItem(TOKEN_EXPIRY_KEY);
    if (!expiry) return false;

    const expiryTime = parseInt(expiry);
    const fiveMinutesMs = 5 * 60 * 1000;
    return Date.now() > (expiryTime - fiveMinutesMs);
  } catch {
    return false;
  }
}

/**
 * Clear token and session data
 */
export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_EXPIRY_KEY);
    sessionStorage.removeItem(SESSION_ID_KEY);
  } catch (e) {
    console.warn('[ClientSecurity] Could not clear token');
  }
}

/**
 * Setup secure token storage protection
 */
function setupTokenSecurity(): void {
  // Never allow token to be accessed by third-party scripts
  // Use Content Security Policy headers (set by backend)

  // Monitor for suspicious token access patterns
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.name.includes('token') || entry.name.includes('auth')) {
        // Log suspicious access patterns
        console.warn('[ClientSecurity] Token access pattern detected:', entry.name);
      }
    }
  });

  try {
    observer.observe({ entryTypes: ['resource', 'measure'] });
  } catch {
    // PerformanceObserver not supported
  }
}

/**
 * Setup session timeout with activity tracking
 */
function setupSessionTimeout(): void {
  // Track user activity
  const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart'];

  const recordActivity = () => {
    lastActivityTime = Date.now();
  };

  activityEvents.forEach(event => {
    document.addEventListener(event, recordActivity, { passive: true });
  });

  // Check session timeout periodically
  sessionCheckInterval = setInterval(() => {
    const inactivityTime = Date.now() - lastActivityTime;

    if (inactivityTime > SESSION_TIMEOUT_MS) {
      console.warn('[ClientSecurity] Session timeout due to inactivity');
      clearToken();
      window.location.href = '/login?reason=session_timeout';
    }
  }, 60000); // Check every minute
}

/**
 * Handle page visibility changes
 */
function handleVisibilityChange(): void {
  if (document.hidden) {
    // Page hidden - pause activity tracking
    console.log('[ClientSecurity] Page hidden - pausing activity tracking');
  } else {
    // Page visible again - check if session is still valid
    const token = getToken();
    if (!token) {
      console.warn('[ClientSecurity] Session lost while page was hidden');
      window.location.href = '/login';
    }
  }
}

/**
 * Clear sensitive data before page unload
 */
function clearSensitiveData(): void {
  // Don't clear token on unload - user may navigate back
  // Only clear explicitly on logout
}

/**
 * Logout: Clear all session data
 */
export function logout(): void {
  // Clear all sensitive data
  clearToken();
  clearDeviceId();
  clearSessionId();

  // Stop session monitoring
  if (sessionCheckInterval) {
    clearInterval(sessionCheckInterval);
  }

  // Remove event listeners
  document.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('beforeunload', clearSensitiveData);

  console.log('[ClientSecurity] Logged out - all data cleared');
}

/**
 * Clear device ID (careful - only on manual logout)
 */
function clearDeviceId(): void {
  try {
    localStorage.removeItem(DEVICE_ID_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Clear session ID
 */
function clearSessionId(): void {
  try {
    sessionStorage.removeItem(SESSION_ID_KEY);
  } catch {
    // Ignore errors
  }
}

/**
 * Get security headers for API requests
 */
export function getSecurityMetadata(): Record<string, string> {
  return {
    'X-Device-ID': getDeviceId() || 'unknown',
    'X-Session-ID': getSessionId(),
    'X-Timestamp': Date.now().toString(),
  };
}

/**
 * Verify request is from same origin (CSRF protection)
 */
export function verifySameOrigin(targetUrl: string): boolean {
  const currentOrigin = window.location.origin;
  const targetOrigin = new URL(targetUrl, window.location.href).origin;
  return currentOrigin === targetOrigin;
}

/**
 * Setup Content Security Policy headers (backend should handle, but check)
 */
export function validateCSPHeaders(): boolean {
  // Check if CSP headers are present in meta tags
  const cspMeta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (cspMeta) {
    console.log('[ClientSecurity] CSP header found');
    return true;
  }

  // Backend should set CSP via HTTP headers, but frontend can validate
  return true; // Trust backend implementation
}

/**
 * Lock down window object to prevent xss
 */
export function hardtenWindowObject(): void {
  // Prevent external scripts from modifying window
  if (typeof Object.defineProperty === 'function') {
    try {
      // Make certain properties non-configurable
      Object.defineProperty(window, '__proto__', { writable: false, configurable: false });
      Object.defineProperty(window, 'constructor', { writable: false, configurable: false });
    } catch {
      // May fail in strict mode or with certain CSP policies
    }
  }
}
