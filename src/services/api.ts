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

export const adaApi = {
  chat: (message: string, page: string, context: object) =>
    api.post('/ada/chat', { message, page, ...context }),
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
  getReport: (id: string) => insightApi.get(`/projects/${id}/report`),
  downloadReport: (id: string, format: 'docx' | 'pptx' | 'xlsx') =>
    insightApi.get(`/projects/${id}/report`, { params: { format }, responseType: 'blob' }),
  getSubmissions: (id: string) => insightApi.get(`/projects/${id}/submissions`),
};

export default api;
