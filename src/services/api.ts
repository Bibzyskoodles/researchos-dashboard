import axios from 'axios';

// ✅ SECURITY: Use environment variable for API URL (defaults to relative)
const BASE_URL = process.env.REACT_APP_FIELDSCORE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  // ✅ SECURITY: Send httpOnly cookies automatically
  withCredentials: true,
});

// ✅ SECURITY: Don't manually add token - it's in httpOnly cookie
// Removed interceptor that read from localStorage

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // ✅ SECURITY: Backend clears httpOnly cookie automatically
      // Frontend doesn't need to do anything
      const currentPath = window.location.pathname;
      window.location.href = `/login?expired=true&returnTo=${encodeURIComponent(currentPath)}`;
    }
    // ✅ SECURITY: Sanitize error messages to hide server details
    if (err.response?.data?.error) {
      const message = err.response.data.error;
      if (typeof message === 'string' &&
          (message.includes('KOBO_API_TOKEN') ||
           message.includes('OPENAI_API_KEY') ||
           message.includes('environ') ||
           message.includes('set on the server'))) {
        // Replace sensitive error details with generic message
        err.response.data.error = 'An error occurred. Please try again.';
      }
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
