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
  delete: (id: string) => api.delete(`/api/projects/${id}`),
  lifecycle: (id: string) => api.get(`/api/projects/${id}/lifecycle`),
  framework: (id: string, data: object) => api.post(`/api/projects/${id}/framework`, data),
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

// ✅ SECURITY: Use environment variable for InsightScore URL
const INSIGHT_API_URL = process.env.REACT_APP_INSIGHTSCORE_API_URL || 'https://insightscore-production.up.railway.app';

// InsightScore is a separate service with no cookie-based auth (its
// endpoints aren't gated by the FieldScore session) — withCredentials here
// makes the browser require a non-wildcard Access-Control-Allow-Origin,
// which InsightScore's CORSMiddleware (allow_origins=["*"]) doesn't send,
// so every request was silently blocked by CORS with no visible error
// beyond the console.
const insightApi = axios.create({
  baseURL: INSIGHT_API_URL,
});

// ✅ SECURITY: Don't manually add token - it's in httpOnly cookie
// Removed interceptor that read from localStorage

export const insightScoreApi = {
  getProjects: () => insightApi.get('/projects'),
  createProject: (data: object) => insightApi.post('/projects', data),
  getProject: (id: string) => insightApi.get(`/projects/${id}`),
  analyseProject: (id: string) => insightApi.post(`/projects/${id}/analyse`),
  getStatus: (id: string) => insightApi.get(`/projects/${id}/status`),
  getReport: (id: string) => insightApi.get(`/projects/${id}/report`),
  downloadReport: (id: string, format: 'docx' | 'pptx' | 'xlsx') =>
    insightApi.get(`/projects/${id}/report`, { params: { format }, responseType: 'blob' }),
  getSubmissions: (id: string) => insightApi.get(`/projects/${id}/submissions`),
  getSignalFidelity: (id: string) => insightApi.get(`/projects/${id}/signal-fidelity`),
  getIFI: (id: string) => insightApi.get(`/projects/${id}/intent-fidelity`),
  getQuestionIntelligence: (id: string) => insightApi.get(`/projects/${id}/question-intelligence`),
  getDemographics: (id: string, field?: string) =>
    insightApi.get(`/projects/${id}/demographics`, { params: field ? { field } : {} }),
  askResearch: (id: string, question: string, context?: object) =>
    insightApi.post(`/projects/${id}/ask`, { question, ...context }),
  exportWorkbook: (id: string, type: string) =>
    insightApi.get(`/projects/${id}/export/${type}`, { responseType: "blob" }),
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

export const insightSyncApi = {
  bulkSync: (projectId: string, limit = 200) =>
    api.post('/api/insightscore/sync', { project_id: projectId, limit }),
  koboPush: (params: { insightscore_project_id: string; asset_uid: string; project_id?: string; project_name?: string; research_context?: string; limit?: number }) =>
    api.post('/kobo/insightscore-push', { limit: 200, ...params }),
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
  createInvite: (email: string, role: string) => api.post('/api/org/invites', { email, role }),
  revokeInvite: (id: string) => api.post(`/api/org/invites/${id}/revoke`),
};

export default api;
