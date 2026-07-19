import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-f5bab.up.railway.app';

// Single source of truth for the backend host — the Integrations page builds
// webhook URLs from this so they always point at the same server the
// dashboard talks to.
export const API_BASE_URL = BASE_URL;

const api = axios.create({
  baseURL: BASE_URL,
  // ✅ SECURITY: Send httpOnly cookies automatically
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Clear all auth state — never leave a partial session
      localStorage.removeItem('fs_token');
      localStorage.removeItem('fs_user');
      document.cookie = 'fs_token=;path=/;max-age=0';
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
  changePassword: (current_password: string, new_password: string) =>
    api.post('/auth/change-password', { current_password, new_password }),
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
  getEnumerators: (params?: { project_id?: string }) => api.get('/api/enumerators', { params }),
  getStats: () => api.get('/api/stats'),
  koboPing: () => api.get('/kobo/ping'),
  koboImport: (asset_uid: string, limit = 30, project_id?: string) =>
    api.post('/kobo/import', { asset_uid, limit, ...(project_id ? { project_id } : {}) }),
  uploadSubmissions: (submissions: object[]) =>
    api.post('/api/submissions/upload', { submissions }),
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
  save: (questionnaire: object) =>
    api.post('/questionnaire/save', questionnaire),
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
  framework: (id: string, data: object) => api.post(`/api/projects/${id}/framework`, data),
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
};

export const analyticsApi = {
  getQuestionnaireAnalytics: (questionnaireId: string, groupBy?: string) =>
    api.get(`/questionnaires/${questionnaireId}/analytics`, {
      params: { group_by: groupBy },
    }),
  getAnalyticsSummary: (questionnaireId: string) =>
    api.get(`/questionnaires/${questionnaireId}/analytics/summary`),
  getSourceMetrics: (questionnaireId: string) =>
    api.get(`/questionnaires/${questionnaireId}/analytics/sources`),
  getDropOffAnalysis: (questionnaireId: string) =>
    api.get(`/questionnaires/${questionnaireId}/analytics/drop-off`),
  getQuestionAnalytics: (questionnaireId: string, source?: string) =>
    api.get(`/questionnaires/${questionnaireId}/analytics/questions`, {
      params: { source },
    }),
  getAnalyticsHealth: () =>
    api.get('/analytics/health'),
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
  getSecurity: () => api.get('/api/org/security'),
  updateSecurity: (data: object) => api.put('/api/org/security', data),
  getBilling: () => api.get('/api/org/billing'),
  listInvites: () => api.get('/api/org/invites'),
  createInvite: (email: string, role: string, projectIds?: string[]) =>
    api.post('/api/org/invites', { email, role, ...(projectIds ? { project_ids: projectIds } : {}) }),
  revokeInvite: (id: string) => api.post(`/api/org/invites/${id}/revoke`),
};

export default api;
