import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-f5bab.up.railway.app';

const api = axios.create({
  baseURL: BASE_URL,
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
      window.dispatchEvent(new CustomEvent('session-expired'));
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
  bulkAction: (submission_ids: string[], action: 'approve' | 'reject' | 'flag') =>
    api.post('/api/submissions/bulk-action', { submission_ids, action }),
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

const insightApi = axios.create({
  baseURL: 'https://insightscore-production.up.railway.app',
});

insightApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('fs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

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
  waitForAnalysis: async (id: string, maxWaitMs = 300000) => {
    const startTime = Date.now();
    const pollInterval = 2000;
    while (Date.now() - startTime < maxWaitMs) {
      const res = await insightApi.get(`/projects/${id}/status`);
      if (res.data.complete) return res.data;
      if (res.data.failed) throw new Error(res.data.error || 'Analysis failed');
      await new Promise(r => setTimeout(r, pollInterval));
    }
    throw new Error('Analysis timeout');
  },
};

export default api;
