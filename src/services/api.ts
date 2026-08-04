import axios from 'axios';
import { GetEnumeratorsResponse, GetLeaderboardResponse } from '../types';

// Fall back to the production domain, not Railway's auto-generated one. The
// previous fallback (web-production-f5bab.up.railway.app) is the hostname
// Railway generates for a service; the backend has since moved to the custom
// domain below, and a generated hostname is not a stable address — it can stop
// resolving when a service is stopped, restarted or given a custom domain.
// When that happened the dashboard called an address that no longer existed,
// which surfaces as a bare "Login failed" with a perfectly healthy server,
// because the browser never gets a response to hand back to the app.
// REACT_APP_API_URL still overrides this and is what Vercel should set; this
// is only the value used when it is missing, so it should be the real one.
const BASE_URL = process.env.REACT_APP_API_URL || 'https://fieldscore.intelligencyai.com.ng';

// Single source of truth for the backend host — the Integrations page builds
// webhook URLs from this so they always point at the same server the
// dashboard talks to.
export const API_BASE_URL = BASE_URL;

// No withCredentials. This used to be set with a comment claiming it sent
// httpOnly cookies — there are none. The server sets no cookie and reads none;
// auth is a Bearer token on the Authorization header, attached by the request
// interceptor below (see the backend's bearer.py, which is deliberately the
// only way a credential is read off a request, with no cookie fallback).
//
// It was not merely redundant, it broke every request. Asking for credentialed
// CORS makes the browser *require* `Access-Control-Allow-Credentials: true` on
// the response; the backend deliberately does not send it, so the browser threw
// away responses the server had answered correctly. curl and a plain fetch()
// both succeeded against the same endpoint from the same origin, because
// neither enforces that rule — only the dashboard failed, and it failed with a
// bare "Login failed" that looked like a rejected password.
const api = axios.create({
  baseURL: BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function clearAuthStorage() {
  localStorage.removeItem('fs_token');
  localStorage.removeItem('fs_refresh_token');
  localStorage.removeItem('fs_user');
  document.cookie = 'fs_token=;path=/;max-age=0';
}

// Access tokens are now short-lived (30 min — see fieldscore-backend's
// auth.py) instead of the old 24h token, so a 401 mid-session is now a
// routine, expected event, not just "the user's been idle for a day."
// This exchanges the stored refresh token for a new pair and retries the
// request that 401'd, instead of immediately booting the user to /login.
//
// Single-flight: if several requests 401 at nearly the same moment (e.g.
// a page that fires 4 API calls on mount), they must NOT each independently
// call /auth/refresh — the backend's refresh token is single-use with
// rotation (see auth.py's reuse-detection), so a second concurrent refresh
// call would present an already-rotated-away token and get treated as
// theft, revoking the whole session and logging the user out for entirely
// normal concurrent usage. All callers share the same in-flight promise.
let refreshPromise: Promise<string | null> | null = null;

function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  const refreshToken = localStorage.getItem('fs_refresh_token');
  if (!refreshToken) return Promise.resolve(null);
  // Plain axios, not the `api` instance — calling through `api` would run
  // this request back through the same response interceptor we're inside
  // of, which is exactly the recursive edge case a refresh call must avoid.
  refreshPromise = axios.post(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken })
    .then(res => {
      const { token, refresh_token } = res.data;
      localStorage.setItem('fs_token', token);
      if (refresh_token) localStorage.setItem('fs_refresh_token', refresh_token);
      return token as string;
    })
    .catch(() => null)
    .finally(() => { refreshPromise = null; });
  return refreshPromise;
}

// A 401 from these specific routes is never "your session expired, let's
// refresh it" — /auth/login's 401 means wrong credentials, /auth/refresh's
// own 401 means the refresh token itself is dead (retrying would just loop).
const NO_REFRESH_RETRY_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/accept-invite'];

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const original = err.config;
    const url: string = original?.url || '';
    const isAuthRoute = NO_REFRESH_RETRY_PATHS.some(p => url.includes(p));

    if (err.response?.status === 401 && !isAuthRoute && !original._retriedAfterRefresh) {
      original._retriedAfterRefresh = true;
      const newToken = await refreshAccessToken();
      if (newToken) {
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
    }

    if (err.response?.status === 401) {
      // Either refresh wasn't attempted (auth route), had nothing to refresh
      // with, or the refresh itself failed (expired/revoked) — no session
      // to recover. Clear everything and never leave a partial session.
      clearAuthStorage();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  // Sends the refresh token so the backend can revoke it server-side —
  // without this, "logout" only ever cleared the browser's copy while the
  // token (and any copy an attacker had) stayed valid for its full
  // lifetime. See auth_routes.py's /auth/logout docstring.
  logout: () => {
    const refresh_token = localStorage.getItem('fs_refresh_token') || undefined;
    return api.post('/auth/logout', { refresh_token });
  },
  logoutAll: () => api.post('/auth/logout-all'),
  listSessions: () => api.get('/auth/sessions'),
  revokeSession: (sessionId: string) => api.delete(`/auth/sessions/${sessionId}`),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
  resendVerification: () => api.post('/auth/resend-verification'),
};

// Platform-operator only. The backend gates /admin/* on the caller's own
// session (a platform-admin JWT) — no ADMIN_SECRET is ever sent from the
// browser. Non-admins get a 403 from the server, so the UI gating is cosmetic
// on top of the real enforcement (per CLAUDE.md).
export interface AdminWorkspace {
  org_id: string;
  name: string;
  email: string;
  plan: string;
  created_at: string;
  verified: boolean;
  used: number | null;
  limit: number | null;   // null = unlimited
  unlimited: boolean;
}
export const adminApi = {
  listWorkspaces: () => api.get<{ workspaces: AdminWorkspace[]; count: number }>('/admin/workspaces'),
  setWorkspaceLimit: (email: string, limit: number) =>
    api.post('/admin/set-workspace-limit', { email, limit }),
};

/** An enquiry from the public site or the /configure page. Stored server-side
 *  before any email is attempted, so this list is the record of who asked —
 *  not a copy of a notification that may never have been delivered. */
export interface Lead {
  id: number;
  /** 'demo_request' (marketing site) or 'configurator' (/configure). */
  source: string;
  name: string;
  email: string;
  organisation: string;
  message: string;
  /** False means the enquiry was captured but the sales email didn't go out —
   *  usually SALES_EMAIL not being set. The lead is still safe. */
  notified: boolean;
  created_at: string;
}

export const leadsApi = {
  list: () => api.get<{ leads: Lead[]; total: number }>('/api/leads/list'),
  remove: (id: number) => api.delete(`/api/leads/${id}`),
};

// fieldscore-backend's /api/media/<sid>/<kind> proxy requires a Bearer
// token — an <img>/<audio> tag pointed straight at it will always 401
// (this backend has no fs_token cookie; see CLAUDE.md). Fetch the bytes
// through the authenticated `api` instance instead and hand the caller a
// Blob to turn into an object URL (same pattern as certificatePrint.ts's
// openCertificate/downloadCertificatePdf).
export const mediaApi = {
  // index selects which photo/recording on a multi-media submission; 0 (default)
  // is the representative Image_URL/Audio_URL, index>0 the Nth stored item.
  fetchImage: (submissionId: string, index = 0) =>
    api.get(`/api/media/${submissionId}/image`, { params: index ? { index } : undefined, responseType: 'blob' }),
  fetchAudio: (submissionId: string, index = 0) =>
    api.get(`/api/media/${submissionId}/audio`, { params: index ? { index } : undefined, responseType: 'blob' }),
};

export const dashboardApi = {
  getVersion: () => api.get('/api/version'),
  getDashboard: (params?: { project_id?: string }) => api.get('/api/dashboard', { params }),
  getSubmission: (id: string) => api.get(`/api/submissions/${id}`),
  actionSubmission: (id: string, action: 'approve' | 'reject' | 'flag') =>
    api.post(`/api/submissions/${id}/action`, { action }),
  overrideVerdict: (id: string, verdict: 'PASS' | 'FLAG' | 'REJECT', reason: string) =>
    api.post(`/api/submissions/${id}/action`, { action: 'override', verdict, reason }),
  clearOverride: (id: string) =>
    api.post(`/api/submissions/${id}/action`, { action: 'clear_override' }),
  getSubmissions: (params?: { verdict?: string; limit?: number; offset?: number; project_id?: string }) =>
    api.get('/api/submissions', { params }),
  getEnumerators: (params?: { project_id?: string }) =>
    api.get<GetEnumeratorsResponse>('/api/enumerators', { params }),
  // Org-wide leaderboard — aggregates server-side across every project the
  // caller's org owns (bypassing the pagination limits a client-side
  // getSubmissions()/getEnumerators() fetch would otherwise hit). Blocked
  // for the client role (enumerator-identifying data — see CLAUDE.md).
  getEnumeratorLeaderboard: (params?: { project_id?: string }) =>
    api.get<GetLeaderboardResponse>('/api/enumerators/leaderboard', { params }),
  getStats: () => api.get('/api/stats'),
  koboPing: () => api.get('/kobo/ping'),
  koboImport: (asset_uid: string, limit = 30, project_id?: string) =>
    api.post('/kobo/import', { asset_uid, limit, ...(project_id ? { project_id } : {}) }),
  odkGetConfig: () => api.get('/odk/config'),
  odkSaveConfig: (server_url: string, email: string, password?: string) =>
    api.put('/odk/config', { server_url, email, ...(password ? { password } : {}) }),
  odkPing: () => api.get('/odk/ping'),
  odkImport: (project_id: string, form_id: string, limit = 30, fieldscore_project_id?: string) =>
    api.post('/odk/import', { project_id, form_id, limit, ...(fieldscore_project_id ? { fieldscore_project_id } : {}) }),
  uploadSubmissions: (submissions: object[]) =>
    api.post('/api/submissions/upload', { submissions }),
  uploadStatus: (batchId: string) =>
    api.get(`/api/submissions/upload-status/${encodeURIComponent(batchId)}`),
  deleteSubmission: (id: string) =>
    api.delete(`/api/submissions/${id}`),
  bulkDelete: (ids: string[]) =>
    api.post('/api/submissions/bulk-delete', { ids }),
  rescoreSubmission: (id: string, level: 'recompute' | 'full') =>
    api.post(`/api/submissions/${id}/rescore`, { level }),
  rescoreHistory: (id: string) =>
    api.get(`/api/submissions/${id}/rescore-history`),
  rescoreProject: (projectId: string, level: 'recompute' | 'full', filter?: 'all' | 'flagged_only') =>
    api.post(`/api/projects/${projectId}/rescore`, { level, filter: filter || 'all' }),
  getScoringConfig: (projectId: string) =>
    api.get(`/api/projects/${projectId}/scoring-config`),
  updateScoringConfig: (projectId: string, config: Record<string, any>) =>
    api.put(`/api/projects/${projectId}/scoring-config`, config),
};

export const questionnaireApi = {
  generate: (payload: object) =>
    api.post('/questionnaire/generate', payload),
  exportXlsform: (questionnaire: object, platform: string) =>
    api.post('/questionnaire/export/xlsform', { questionnaire, platform }, { responseType: 'blob' }),
  exportDocx: (questionnaire: object) =>
    api.post('/questionnaire/export/docx', { questionnaire }, { responseType: 'blob' }),
};

export const projectsApi = {
  list: () => api.get('/api/projects'),
  create: (data: object) => api.post('/api/projects', data),
  get: (id: string) => api.get(`/api/projects/${id}`),
  update: (id: string, data: object) => api.patch(`/api/projects/${id}`, data),
  delete: (id: string, verifyEmpty = false) =>
    api.delete(`/api/projects/${id}`, verifyEmpty ? { params: { verify_empty: 'true' } } : undefined),
  lifecycle: (id: string) => api.get(`/api/projects/${id}/lifecycle`),
  // What the project's saved questionnaire implies about verifying it.
  // Apply deliberately sends no settings: the server re-derives them from the
  // stored questionnaire, because the card the user just read is a
  // client-side object a caller could edit.
  // Find a place on OpenStreetMap and get back candidate zones — a road comes
  // back as its centreline, a ward as its boundary. Read-only: it offers
  // candidates and picks none, and the write still goes through the scoring
  // config save so there is exactly one path that sets a zone.
  zoneSearch: (id: string, q: string) =>
    api.get(`/api/projects/${id}/zone-search`, { params: { q } }),
  configProposal: (id: string) => api.get(`/api/projects/${id}/config-proposal`),
  applyConfigProposal: (id: string) => api.post(`/api/projects/${id}/config-proposal/apply`, {}),
  declineConfigProposal: (id: string) => api.post(`/api/projects/${id}/config-proposal/decline`, {}),
  framework: (id: string, data: object) => api.post(`/api/projects/${id}/framework`, data),
};

// Shareable read-only report links — admin/manager create a token-scoped
// link (auth required); the resulting /shared-report/<token> URL is public
// (no auth) so it can be handed to someone outside the org, same precedent
// as certificateApi.verifyUrl below.
export const reportShareApi = {
  create: (projectId: string, reportType: string, expiryDays?: number) =>
    api.post<{ ok: boolean; token: string; share_url: string; report_type: string; expires_at: string }>(
      `/api/projects/${projectId}/reports/share`,
      { report_type: reportType, ...(expiryDays ? { expiry_days: expiryDays } : {}) }
    ),
};

export interface ReportSchedule {
  id: string;
  org_id: string;
  project_id: string;
  report_type: string;
  frequency: 'weekly' | 'monthly';
  recipient_emails: string[];
  created_by?: string;
  created_at: string;
  next_run_at: string;
  last_run_at: string | null;
  last_run_status: string | null;
  enabled: boolean;
}

// Recurring report delivery — admin/manager create a schedule (server-side
// gated at can(role, "export"), see fieldscore-backend/report_schedule_routes.py)
// that a background poller (report_scheduler.py) picks up and emails out on
// a weekly/monthly cadence. Same project-scoped shape as reportShareApi above.
export const reportScheduleApi = {
  create: (projectId: string, reportType: string, frequency: 'weekly' | 'monthly', recipientEmails: string[]) =>
    api.post<{ ok: boolean; schedule: ReportSchedule }>(
      `/api/projects/${projectId}/report-schedules`,
      { report_type: reportType, frequency, recipient_emails: recipientEmails }
    ),
  list: (projectId: string) =>
    api.get<{ schedules: ReportSchedule[] }>(`/api/projects/${projectId}/report-schedules`),
  setEnabled: (projectId: string, scheduleId: string, enabled: boolean) =>
    api.patch<{ ok: boolean }>(`/api/projects/${projectId}/report-schedules/${scheduleId}`, { enabled }),
  remove: (projectId: string, scheduleId: string) =>
    api.delete<{ ok: boolean }>(`/api/projects/${projectId}/report-schedules/${scheduleId}`),
};

// Certificate routes live at the backend root (/certificate/*, /verify/*),
// not under /api — but they're on the same host, so the `api` axios
// instance's baseURL still resolves them correctly.
export const certificateApi = {
  issue: (projectId: string) =>
    api.post<{ ok: boolean; cert_id: string; issued_at: string; verify_url: string }>(`/certificate/${projectId}/issue`),
  // Certificate HTML/PDF need the same Bearer auth as everything else, so a
  // plain <a href> or window.open(url) won't work (no cookie session is set
  // by this backend — auth is header-only). Fetch through axios instead and
  // hand the browser the result directly.
  fetchHtml: (projectId: string) =>
    api.get<string>(`/certificate/${projectId}`, { responseType: 'text', transformResponse: (data) => data }),
  fetchPdf: (projectId: string) =>
    api.get(`/certificate/${projectId}`, { params: { format: 'pdf' }, responseType: 'blob' }),
  // /verify/<cert_id> is intentionally public (no auth) — safe to link directly.
  verifyUrl: (certId: string) => `${API_BASE_URL}/verify/${certId}`,
};

export const orgAdminApi = {
  resetData: () => api.post('/api/admin/reset-data'),
};

export const adaApi = {
  chat: (message: string, page: string, context: object) =>
    api.post('/ada/chat', { message, page, ...context }),
  analyse: (prompt: string, system?: string) =>
    api.post('/ada/analyse', { prompt, ...(system ? { system } : {}) }),
  pricing: (message: string, volumes: object, goals: string[]) =>
    api.post('/ada/pricing', { message, volumes, goals }),
  brief: (name: string, stats: object) =>
    api.post('/ada/brief', { name, stats }),
  getState: () => api.get('/ada/state'),
  learn: (scope: 'user' | 'org', key: string, value: unknown) =>
    api.post('/ada/learn', { scope, key, value }),
  getMemory: () => api.get('/ada/memory'),
  clearMemory: () => api.delete('/ada/memory'),
  // Server holds the ElevenLabs key — never sent to the browser.
  speak: (text: string) => api.post('/ada/speak', { text }, { responseType: 'blob' }),
  // Rule-based, non-AI proactive observations (see fieldscore-backend's
  // ada/proactive.py) — never mutates anything, just describes what was
  // found. Omit projectId to scan every project the caller's org (and
  // role) permits.
  getProactiveInsights: (projectId?: string) =>
    api.get('/ada/proactive-insights', { params: projectId ? { project_id: projectId } : {} }),
};


// ✅ SECURITY: InsightScore is no longer called directly from the browser.
// InsightScore's own routes now require a server-to-server X-Bridge-Key
// secret on every /projects* endpoint (it has no user auth of its own) —
// a secret that must never be shipped to client JS. Calling it straight
// from here with no auth header at all (the previous state) let any
// anonymous visitor enumerate and read every organisation's projects,
// themes, quotes, and transcripts.
//
// Instead, these calls go through FieldScore's `api` instance (same one
// used everywhere else in this file), which already carries the logged-in
// user's session via the httpOnly fs_token cookie / Authorization header.
// FieldScore's /api/insights/* proxy (fieldscore-backend/insightscore_proxy.py)
// verifies that session, confirms the caller's org actually owns the
// requested InsightScore project, and only then forwards the request to
// InsightScore server-to-server with X-Bridge-Key attached.
export const insightScoreApi = {
  getProjects: () => api.get('/api/insights/projects'),
  createProject: (data: object) => api.post('/api/insights/projects', data),
  getProject: (id: string) => api.get(`/api/insights/projects/${id}`),
  analyseProject: (id: string) => api.post(`/api/insights/projects/${id}/analyse`),
  getStatus: (id: string) => api.get(`/api/insights/projects/${id}/status`),
  getReport: (id: string) => api.get(`/api/insights/projects/${id}/report`),
  downloadReport: (id: string, format: 'docx' | 'pptx' | 'xlsx') =>
    api.get(`/api/insights/projects/${id}/report`, { params: { format }, responseType: 'blob' }),
  getSubmissions: (id: string) => api.get(`/api/insights/projects/${id}/submissions`),
  getSignalFidelity: (id: string) => api.get(`/api/insights/projects/${id}/signal-fidelity`),
  getIFI: (id: string) => api.get(`/api/insights/projects/${id}/intent-fidelity`),
  getQuestionIntelligence: (id: string) => api.get(`/api/insights/projects/${id}/question-intelligence`),
  getDemographics: (id: string, field?: string) =>
    api.get(`/api/insights/projects/${id}/demographics`, { params: field ? { field } : {} }),
  askResearch: (id: string, question: string, context?: object) =>
    api.post(`/api/insights/projects/${id}/ask`, { question, ...context }),
  exportWorkbook: (id: string, type: string) =>
    api.get(`/api/insights/projects/${id}/export/${type}`, { responseType: "blob" }),
  waitForAnalysis: async (id: string, timeout = 300000) => {
    const startTime = Date.now();
    const pollInterval = 2000;
    while (Date.now() - startTime < timeout) {
      try {
        const status = await insightScoreApi.getStatus(id);
        const d = status.data;
        // Accept both boolean {complete:true} and string {status:"complete"} shapes
        const done = d.complete === true || d.status === 'complete';
        const failed = d.failed === true || d.status === 'error' || d.status === 'failed';
        if (done) return d;
        if (failed) throw new Error(d.error || d.message || 'Analysis failed');
      } catch (err: any) {
        if (err.response?.status === 404) throw err;
        // Re-throw errors we explicitly raised above; retry transient network errors
        if (err.message === 'Analysis failed') throw err;
        if (Date.now() - startTime >= timeout) throw new Error('Analysis timeout');
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    throw new Error('Analysis timeout');
  },
};

export const bridgeApi = {
  getStatus: (projectId: string) =>
    api.get(`/api/projects/${projectId}/bridge-status`),
  retry: (projectId: string) =>
    api.post(`/api/projects/${projectId}/bridge-retry`),
};

export const insightSyncApi = {
  bulkSync: (projectId: string, limit = 200) =>
    api.post('/api/insightscore/sync', { project_id: projectId, limit }),
  koboPush: (params: { insightscore_project_id: string; asset_uid: string; project_id?: string; project_name?: string; research_context?: string; limit?: number }) =>
    api.post('/kobo/insightscore-push', { limit: 200, ...params }),
  resetProject: (insightscoreProjectId: string) =>
    api.delete(`/api/insightscore/project/${insightscoreProjectId}`),
};

export const engineConfigApi = {
  // The org's shared Trust Index scoring policy — see services/engineConfig.ts.
  get: () => api.get('/api/engine-config'),
  save: (config: object) => api.put('/api/engine-config', config),
};

export const orgSettingsApi = {
  getSettings: () => api.get('/api/org/settings'),
  updateSettings: (data: object) => api.put('/api/org/settings', data),
  getWorkspace: () => api.get('/api/org/workspace'),
  updateWorkspace: (data: object) => api.put('/api/org/workspace', data),
  getNotifications: () => api.get('/api/org/notifications'),
  updateNotifications: (data: object) => api.put('/api/org/notifications', data),
  getStorage: () => api.get('/api/org/storage'),
  updateStorage: (data: object) => api.put('/api/org/storage', data),
  // The backend's view of retention: the effective cutoff, whether it's active,
  // and legacy_archive_pending (this org still has the old "archive to cold
  // storage" toggle on, which never did anything and deliberately does NOT
  // authorise deletion — see fieldscore-backend retention.py::effective_cutoff).
  getRetentionPolicy: () => api.get('/api/retention/policy'),
  // Right-to-erasure. Two-step by design (see fieldscore-backend
  // retention_routes.py): preview returns what WOULD be erased plus a
  // confirm_token bound to that exact scope, and erase refuses without a
  // matching token — so a deletion can never be a single accidental click, and
  // a stale confirmation stops validating if the scope changed. Admin-only,
  // enforced server-side.
  previewErasure: (target: { project_id?: string; submission_ids?: string[] }) =>
    api.post('/api/retention/preview', target),
  performErasure: (target: { project_id?: string; submission_ids?: string[] }, confirm_token: string, reason: string) =>
    api.post('/api/retention/erase', { ...target, confirm_token, reason }),
  getErasureLog: (limit = 50) => api.get('/api/retention/log', { params: { limit } }),
  // Security activity: who granted or revoked project access, who invited
  // someone, who changed the plan, retention policy or API keys. Admin-only
  // and scoped to the caller's own workspace server-side (the org comes from
  // the token, never from a parameter). Each row is HMAC-signed and carries
  // signature_valid, so a record altered in the database shows as altered
  // rather than silently reading as genuine — same contract as the erasure log.
  getAuditEvents: (limit = 100, action?: string) =>
    api.get('/api/org/audit-events', { params: { limit, ...(action ? { action } : {}) } }),
  getSecurity: () => api.get('/api/org/security'),
  updateSecurity: (data: object) => api.put('/api/org/security', data),
  getBilling: () => api.get('/api/org/billing'),
  // KoboToolbox form publishing — the token is stored server-side (encrypted)
  // and never returned to the browser. `getKoboTokenStatus` reports only
  // whether one is configured. Replaces the old localStorage-token flow that
  // called the Kobo API directly from the browser.
  // Live fieldwork alerts — off by default; a supervisor opts in and chooses
  // channels. PUT is admin-only server-side.
  getFieldAlerts: () => api.get('/api/org/field-alerts'),
  updateFieldAlerts: (data: object) => api.put('/api/org/field-alerts', data),
  getKoboTokenStatus: () => api.get('/kobo/token'),
  saveKoboToken: (token: string) => api.post('/kobo/token', { token }),
  // The questionnaire goes over as-is and the server converts it to a Kobo
  // asset (questionnaire_routes.build_kobo_content). The browser used to do
  // that conversion with its own copy of the question-type mapping, which knew
  // only ODK's names — so a FieldScore "gps"/"image"/"audio" question matched
  // nothing and silently deployed as a plain text box. One mapping, server-side.
  publishToKobo: (name: string, questionnaire: Record<string, unknown>) =>
    api.post('/kobo/publish', { name, questionnaire }),
  // Purchasable paid plans + prices (server-side source of truth) and the
  // caller's current plan.
  getPlans: () => api.get('/api/org/plans'),
  // Start a one-time upgrade payment; returns a Paystack checkout URL the
  // browser redirects to. The plan only changes once the signed webhook
  // confirms payment (see fieldscore-backend payments.py) — this call never
  // changes state itself.
  startPlanUpgrade: (plan: string) =>
    api.post('/api/org/upgrade', { plan }),
  // Per-project ingest token — the credential a form platform uses to write
  // submissions into THIS project and no other. Replaces the old shared
  // webhook secret + ?project_id=, which let any FieldScore customer write into
  // any project (see fieldscore-backend webhook_tokens.py). Only the hash is
  // stored server-side, so `get` reports whether one exists and its prefix but
  // can never return the token itself — `rotate` mints a new one and returns it
  // exactly once, invalidating the previous URL immediately.
  getIngestToken: (projectId: string) =>
    api.get(`/api/projects/${projectId}/ingest-token`),
  rotateIngestToken: (projectId: string) =>
    api.post(`/api/projects/${projectId}/ingest-token`),
  listInvites: () => api.get('/api/org/invites'),
  createInvite: (email: string, role: string, projectIds?: string[]) =>
    api.post('/api/org/invites', { email, role, ...(projectIds ? { project_ids: projectIds } : {}) }),
  revokeInvite: (id: string) => api.post(`/api/org/invites/${id}/revoke`),
};

// Developer surface — API keys (pull: GET /v1/* using a bearer key) and
// outbound webhooks (push: fieldscore-backend POSTs a signed event to a URL
// you control). Both are admin-only on the backend (org_settings_routes.py's
// _require_admin pattern) — these calls will 403 for non-admin roles.
export const apiKeysApi = {
  list: () => api.get('/api/org/api-keys'),
  create: (name: string) => api.post('/api/org/api-keys', { name }),
  revoke: (id: string) => api.delete(`/api/org/api-keys/${id}`),
};

export const webhooksApi = {
  list: () => api.get('/api/org/webhooks'),
  create: (url: string, events: string[]) => api.post('/api/org/webhooks', { url, events }),
  update: (id: string, data: { enabled?: boolean }) => api.patch(`/api/org/webhooks/${id}`, data),
  revoke: (id: string) => api.delete(`/api/org/webhooks/${id}`),
};

// ── CallScore (Call capture mode) ──────────────────────────────────────────
// The Call-mode agent pipeline runs as its own service sharing the backend's
// Postgres (callscore/docs/RECONCILIATION.md §3.4), so it has its own base
// URL. Auth is the same FieldScore Bearer token; this instance reuses the
// same request-header pattern as `api` above. The URL is public config, not
// a secret — nothing key-like ships via REACT_APP_* here.
const CALLSCORE_BASE_URL =
  process.env.REACT_APP_CALLSCORE_API_URL || 'https://researchos-dashboard-production.up.railway.app';

// 2-minute ceiling: a hung request must surface as a retryable error,
// never an infinite spinner (the capture flow shows per-step progress).
const callApi = axios.create({ baseURL: CALLSCORE_BASE_URL, timeout: 120000 });

callApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('fs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const callScoreApi = {
  // Push-ranked supervisor queue (Bible Part 8.6) — call-mode interviews only.
  queue: (projectId: string) =>
    callApi.get(`/api/v1/scorecards/queue/${encodeURIComponent(projectId)}`),
  scorecard: (interviewId: string) =>
    callApi.get(`/api/v1/scorecards/${encodeURIComponent(interviewId)}`),
  // Bearer-auth fetch of an evidence file as a Blob — a plain <audio src>
  // cannot carry the Authorization header (see certificatePrint.ts pattern).
  evidenceFile: (interviewId: string, kind: string) =>
    callApi.get(
      `/api/v1/scorecards/${encodeURIComponent(interviewId)}/evidence-file/${encodeURIComponent(kind)}`,
      { responseType: 'blob' }
    ),
  listInterviews: (projectId: string) =>
    callApi.get(`/api/v1/interviews/project/${encodeURIComponent(projectId)}`),
  // Laptop-as-Device-2 capture flow (browser MediaRecorder).
  listRespondents: (projectId: string) =>
    callApi.get(`/api/v1/respondents/${encodeURIComponent(projectId)}`),
  createRespondent: (projectId: string, displayName: string, phoneNumber?: string) =>
    callApi.post(`/api/v1/respondents/${encodeURIComponent(projectId)}`, {
      display_name: displayName, phone_number: phoneNumber || null,
    }),
  getQuestionnaire: (projectId: string) =>
    callApi.get(`/api/v1/projects/${encodeURIComponent(projectId)}/questionnaire`),
  setQuestionnaire: (projectId: string, items: object[]) =>
    callApi.put(`/api/v1/projects/${encodeURIComponent(projectId)}/questionnaire`, { items }),
  reviewQuestionnaire: (projectId: string, items: object[]) =>
    callApi.post(`/api/v1/projects/${encodeURIComponent(projectId)}/questionnaire/review`, { items }),
  draftQuestionnaire: (projectId: string, brief: string) =>
    callApi.post(`/api/v1/projects/${encodeURIComponent(projectId)}/questionnaire/draft`, { brief }),
  parseQuestionnaireFile: (projectId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return callApi.post(`/api/v1/projects/${encodeURIComponent(projectId)}/questionnaire/parse-file`, form);
  },
  getCallConfig: (projectId: string) =>
    callApi.get(`/api/v1/projects/${encodeURIComponent(projectId)}/call-config`),
  setCallConfig: (projectId: string, payload: object) =>
    callApi.put(`/api/v1/projects/${encodeURIComponent(projectId)}/call-config`, payload),
  // Verified call interviews in InsightScore's ingestion shape (pull side
  // of the bridge — the push side is the pipeline's outbox enqueue).
  analysisExport: (projectId: string) =>
    callApi.get(`/api/v1/projects/${encodeURIComponent(projectId)}/analysis-export`),
  createSession: (payload: object) => callApi.post('/api/v1/interviews/', payload),
  stopSession: (id: string, payload: object) =>
    callApi.post(`/api/v1/interviews/${encodeURIComponent(id)}/stop`, payload),
  uploadRecording: (id: string, kind: 'audio' | 'consent_recording' | 'call_screen', blob: Blob, filename?: string) => {
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', blob, filename || `${kind}.webm`);
    return callApi.post(`/api/v1/sync/${encodeURIComponent(id)}/upload-recording`, form);
  },
  uploadEvidenceBundle: (id: string, artifacts: object[]) =>
    callApi.post(`/api/v1/sync/${encodeURIComponent(id)}/evidence-bundle`, { artifacts }),
  finalizeSync: (id: string, answers?: object) =>
    callApi.post(`/api/v1/sync/${encodeURIComponent(id)}/finalize`, { answers: answers || null }),
  abandonSync: (id: string) =>
    callApi.post(`/api/v1/sync/${encodeURIComponent(id)}/abandon`, {}),
  // Agent mode (Bible Part 12) — optional AI-conducted interviews.
  dispatchAgentInterview: (projectId: string, respondentId: string, orgName?: string) =>
    callApi.post(`/api/v1/agent-interviews/${encodeURIComponent(projectId)}/dispatch`,
      { respondent_id: respondentId, org_name: orgName || '' }),
  listAgentInterviews: (projectId: string) =>
    callApi.get(`/api/v1/agent-interviews/${encodeURIComponent(projectId)}`),
  // Back-checks: human (always available) or AI verification call (when a
  // voice-agent provider is configured). Never a primary interview.
  dispatchBackcheck: (submissionId: string, method: 'human' | 'ai', assignedTo?: string) =>
    callApi.post(`/api/v1/backchecks/${encodeURIComponent(submissionId)}/dispatch`,
      { method, assigned_to: assignedTo }),
  completeBackcheck: (backcheckId: string, summary: string, interviewConfirmed?: string) =>
    callApi.post(`/api/v1/backchecks/complete/${encodeURIComponent(backcheckId)}`,
      { summary, interview_confirmed: interviewConfirmed }),
  listBackchecks: (submissionId: string) =>
    callApi.get(`/api/v1/backchecks/${encodeURIComponent(submissionId)}`),
  // Calibration loop: supervisor verdict on one AI finding.
  findingFeedback: (findingId: string, verdict: 'correct' | 'incorrect' | 'unsure', note?: string) =>
    callApi.post(`/api/v1/feedback/findings/${encodeURIComponent(findingId)}`, { verdict, note }),
  // Override audit (Bible 4A.6) — reason is mandatory, enforced server-side too.
  recordOverride: (interviewId: string, humanAction: string, overriddenBy: string, reason: string) =>
    callApi.post(`/api/v1/scorecards/${encodeURIComponent(interviewId)}/override`, {
      human_action: humanAction,
      overridden_by: overriddenBy,
      reason,
    }),
};

export default api;
