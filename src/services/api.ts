import axios from 'axios';

const BASE_URL = process.env.REACT_APP_API_URL || 'https://web-production-f5bab.up.railway.app';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fs_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Redirect to login on 401
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

// ── Auth ──────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  me: () => api.get('/auth/me'),
  logout: () => api.post('/auth/logout'),
};

// ── Dashboard ─────────────────────────────────────────────────────────────
export const dashboardApi = {
  getDashboard: () => api.get('/api/dashboard'),
  getSubmissions: (params?: { verdict?: string; limit?: number; offset?: number }) =>
    api.get('/api/submissions', { params }),
  getSubmission: (id: string) => api.get(`/api/submissions/${id}`),
  getEnumerators: () => api.get('/api/enumerators'),
  getStats: () => api.get('/api/stats'),
};

// ── Ada ───────────────────────────────────────────────────────────────────
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

export default api;
