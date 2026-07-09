import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-f5bab.up.railway.app';

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
  getDashboard: () => api.get('/api/dashboard'),
  getSubmission: (id: string) => api.get(`/api/submissions/${id}`),
  actionSubmission: (id: string, action: 'approve' | 'reject' | 'flag') =>
    api.post(`/api/submissions/${id}/action`, { action }),
  getSubmissions: (params?: { verdict?: string; limit?: number; offset?: number }) =>
    api.get('/api/submissions', { params }),
  getEnumerators: () => api.get('/api/enumerators'),
  getStats: () => api.get('/api/stats'),
  koboPing: () => api.get('/kobo/ping'),
  koboImport: (asset_uid: string, limit = 30) =>
    api.post('/kobo/import', { asset_uid, limit }),
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

export const adaApi = {
  chat: (message: string, page: string, context: object) =>
    api.post('/ada/chat', { message, page, ...context }),
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
const INSIGHT_API_URL = process.env.REACT_APP_INSIGHTSCORE_API_URL || '/insightscore';

const insightApi = axios.create({
  baseURL: INSIGHT_API_URL,
  // ✅ SECURITY: Send httpOnly cookies automatically
  withCredentials: true,
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
  waitForAnalysis: async (id: string, timeout = 300000) => {
    const startTime = Date.now();
    const pollInterval = 2000;
    while (Date.now() - startTime < timeout) {
      try {
        const status = await insightScoreApi.getStatus(id);
        if (status.data.complete) return status.data;
        if (status.data.failed) throw new Error(status.data.error || 'Analysis failed');
      } catch (err: any) {
        if (err.response?.status === 404) throw err;
        if (Date.now() - startTime >= timeout) throw new Error('Analysis timeout');
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    throw new Error('Analysis timeout');
  },
};

export default api;
