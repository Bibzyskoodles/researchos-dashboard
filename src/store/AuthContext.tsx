import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { User, Organisation, AuthState } from '../types';
import { authApi } from '../services/api';
import {
  initializeClientSecurity,
  getToken,
  setToken,
  clearToken,
  getDeviceId,
  getSessionId,
  logout as clientLogout,
  isTokenExpiringSoon,
} from '../services/clientSecurity';

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
}

const AuthCtx = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [org, setOrg] = useState<Organisation | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize client security on mount
    initializeClientSecurity();

    const stored = getToken();
    if (stored) {
      authApi.me()
        .then(res => {
          setUser(res.data.user);
          setOrg(res.data.org);
          setTokenState(stored);
        })
        .catch(() => {
          clearToken();
          setTokenState(null);
        })
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    const { token, user, org } = res.data;

    // Store token securely (sessionStorage + optional secure cookie)
    setToken(token, 86400); // 24 hour expiry
    document.cookie = `fs_token=${token};path=/;max-age=86400;SameSite=Lax;Secure`;

    setTokenState(token);
    setUser(user);
    setOrg(org);
  }, []);

  const logout = useCallback(() => {
    // Use client security logout to clear all data
    clientLogout();
    clearToken();
    document.cookie = 'fs_token=;path=/;max-age=0;Secure';
    setTokenState(null);
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
