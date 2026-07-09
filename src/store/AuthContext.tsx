import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Organisation, AuthState } from '../types';
import { authApi } from '../services/api';

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    try { return JSON.parse(localStorage.getItem('fs_user') || 'null'); } catch { return null; }
  });
  const [org, setOrg] = useState<Organisation | null>(null);
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('fs_token'));
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('fs_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    authApi.me()
      .then(res => {
        setUser(res.data.user);
        setOrg(res.data.org);
        setIsAuthenticated(true);
      })
      .catch(() => {
        localStorage.removeItem('fs_token');
        localStorage.removeItem('fs_user');
        setToken(null);
        setIsAuthenticated(false);
        setUser(null);
        setOrg(null);
      })
      .finally(() => setIsLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { token: newToken, user: newUser, org: newOrg } = res.data;
    localStorage.setItem('fs_token', newToken);
    localStorage.setItem('fs_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setOrg(newOrg);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fs_token');
    localStorage.removeItem('fs_user');
    document.cookie = 'fs_token=;path=/;max-age=0';
    setToken(null);
    setUser(null);
    setOrg(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  }, []);

  return (
    <AuthCtx.Provider value={{
      user, org, token,
      isAuthenticated,
      isLoading, login, logout,
    }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
