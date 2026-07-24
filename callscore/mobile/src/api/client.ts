/**
 * API client. Auth is the same FieldScore account/token used everywhere
 * else (Bible 1.3: one app, one login) — login goes to fieldscore-backend,
 * call-mode data goes to the CallScore service. Every call here must
 * tolerate being offline: callers treat failures as "queue it and move on"
 * (Design Principle 5), never as fatal.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Override via app config / env at build time as needed.
export const FIELDSCORE_URL = 'https://web-production-f5bab.up.railway.app';
export const CALLSCORE_URL = 'https://callscore-production.up.railway.app';

const TOKEN_KEY = 'fs_token';
const USER_KEY = 'fs_user';

export async function getToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getUser(): Promise<{ id?: string; email?: string; org?: string } | null> {
  const raw = await AsyncStorage.getItem(USER_KEY);
  return raw ? JSON.parse(raw) : null;
}

async function request<T>(base: string, path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${detail.slice(0, 200)}`);
  }
  return res.json();
}

export const authApi = {
  async login(email: string, password: string) {
    const data = await request<{ token: string; user: object }>(FIELDSCORE_URL, '/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(data.user || {}));
    return data;
  },
  async logout() {
    await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
  },
};

export const callApi = {
  listRespondents: (projectId: string) =>
    request<{ respondents: import('../types').Respondent[] }>(
      CALLSCORE_URL, `/api/v1/respondents/${encodeURIComponent(projectId)}`),

  createSession: (payload: object) =>
    request(CALLSCORE_URL, '/api/v1/interviews/', {
      method: 'POST', body: JSON.stringify(payload),
    }),

  stopSession: (id: string, payload: object) =>
    request(CALLSCORE_URL, `/api/v1/interviews/${encodeURIComponent(id)}/stop`, {
      method: 'POST', body: JSON.stringify(payload),
    }),

  uploadEvidenceBundle: (id: string, artifacts: object[]) =>
    request(CALLSCORE_URL, `/api/v1/sync/${encodeURIComponent(id)}/evidence-bundle`, {
      method: 'POST', body: JSON.stringify({ artifacts }),
    }),
};
