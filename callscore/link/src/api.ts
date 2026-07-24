// Same auth as everywhere on the platform (Bible 1.3: one login).
import AsyncStorage from '@react-native-async-storage/async-storage';

export const FIELDSCORE_URL = 'https://web-production-f5bab.up.railway.app';
export const CALLSCORE_URL = 'https://callscore-production.up.railway.app';

const TOKEN_KEY = 'fs_token';

async function request<T>(base: string, path: string, options: RequestInit = {}): Promise<T> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    if (res.status === 404) throw new Error('No active interview matches this code.');
    throw new Error(`Request failed (HTTP ${res.status}).`);
  }
  return res.json();
}

export const authApi = {
  async login(email: string, password: string) {
    const data = await request<{ token: string }>(FIELDSCORE_URL, '/auth/login', {
      method: 'POST', body: JSON.stringify({ email, password }),
    });
    await AsyncStorage.setItem(TOKEN_KEY, data.token);
  },
};

export const linkApi = {
  pair: (code: string) =>
    request<{ submission_id: string }>(
      CALLSCORE_URL, `/api/v1/interviews/pair/${encodeURIComponent(code)}`),
  reportState: (
    submissionId: string,
    state: { call_started_at?: string; call_ended_at?: string; number?: string; name?: string },
  ) =>
    request(CALLSCORE_URL, `/api/v1/interviews/${encodeURIComponent(submissionId)}/device1-state`, {
      method: 'POST', body: JSON.stringify(state),
    }),
};
