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
  // ✅ SECURITY: Don't store token in state - it's managed by httpOnly cookie
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // ✅ SECURITY: Check authentication via backend endpoint
    // The httpOnly cookie is automatically sent with every request
    authApi.me()
      .then(res => {
        setUser(res.data.user);
        setOrg(res.data.org);
        setIsAuthenticated(true);
      })
      .catch(() => {
        // Not authenticated or session expired
        setIsAuthenticated(false);
        setUser(null);
        setOrg(null);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    // ✅ SECURITY: Backend sets httpOnly cookie automatically
    // Frontend never sees or stores the token
    const { user, org } = res.data;
    setUser(user);
    setOrg(org);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      // ✅ SECURITY: Call logout endpoint to clear httpOnly cookie
      await authApi.logout();
    } catch (e) {
      // Continue even if logout API call fails
    }
    setUser(null);
    setOrg(null);
    setIsAuthenticated(false);
    window.location.href = '/login';
  }, []);

  return (
    <AuthCtx.Provider value={{
      user, org,
      // ✅ SECURITY: Never expose token in context
      isAuthenticated,
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
