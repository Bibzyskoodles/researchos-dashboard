/**
 * KoboToolbox Authentication & API Types
 */

export interface KoboAuthToken {
  token: string;
  server: string;
  username: string;
  lastValidated: Date;
  expiresAt?: Date;
}

export interface KoboUser {
  username: string;
  email?: string;
  url?: string;
  firstName?: string;
  lastName?: string;
  organizationName?: string;
}

export interface KoboConnectionResult {
  username: string;
  user?: KoboUser;
  isValid: boolean;
}

export interface KoboSyncSettings {
  autoSync: boolean;
  syncInterval?: number; // milliseconds
  lastSyncAt?: Date;
  nextSyncAt?: Date;
}

export interface KoboAuthState {
  isAuthenticated: boolean;
  user?: KoboUser;
  server?: string;
  lastError?: string;
  isLoading?: boolean;
}

export interface KoboApiError extends Error {
  statusCode?: number;
  context?: Record<string, unknown>;
}
