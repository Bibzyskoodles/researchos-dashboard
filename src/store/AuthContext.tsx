import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Organisation, AuthState } from '../types';
import { authApi } from '../services/api';

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Organisation | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('fs_token'));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem('fs_token');
    if (stored) {
      authApi.me()
        .then(res => {
          setUser(res.data.user);
          setOrg(res.data.org);
          setToken(stored);
        })
        .catch(() => {
          localStorage.removeItem('fs_token');
          setToken(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { token, user, org } = res.data;
    localStorage.setItem('fs_token', token);
    document.cookie = `fs_token=${token};path=/;max-age=86400;SameSite=Lax`;
    setToken(token);
    setUser(user);
    setOrg(org);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('fs_token');
    document.cookie = 'fs_token=;path=/;max-age=0';
    setToken(null);
    setUser(null);
    setOrg(null);
    window.location.href = '/login';
  }, []);

  return (
    <AuthCtx.Provider value={{
      user, org, token,
      isAuthenticated: !!token,
      isLoading, login, logout
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
