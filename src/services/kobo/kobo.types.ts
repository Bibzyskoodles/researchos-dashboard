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

// ─── API Resource Types ───────────────────────────────────────────────────────

export interface KoboAsset {
  uid: string;
  name: string;
  asset_type: string;
  version_count: number;
  created: string;
  downloads: {
    xls: string;
    xml: string;
  };
  settings: Record<string, unknown>;
  deployment_status?: string;
}

export interface KoboDeployment {
  uid: string;
  active: boolean;
  submission_count: number;
  version_id: string;
}

export interface KoboSubmission {
  _id: number;
  _uuid: string;
  _date_modified: string;
  _submission_time: string;
  [key: string]: unknown;
}

export interface PublishResult {
  success: boolean;
  assetUid?: string;
  shareLink?: string;
  xlsLink?: string;
  version?: number;
  error?: string;
  timestamp: string;
}

export interface SyncResult {
  success: boolean;
  submissionsImported: number;
  submissionsUpdated: number;
  submissionsSkipped: number;
  error?: string;
  timestamp: string;
}

export interface PublishConfig {
  projectName: string;
  versionNumber: string;
  description?: string;
  isPublic?: boolean;
  syncResponses: boolean;
}

export interface RevisionHistory {
  version: number;
  publishedAt: string;
  assetUid: string;
  shareLink: string;
  description?: string;
  questionCount: number;
  syncEnabled: boolean;
}

// ─── Questionnaire Types ──────────────────────────────────────────────────────

export interface QuestionOption {
  value: string;
  label: string;
}

export interface QuestionDef {
  id: string | number;
  name?: string;
  label?: string;
  type: string;
  required?: boolean;
  condition?: string;
  options?: QuestionOption[];
}

export interface Questionnaire {
  id: string;
  name: string;
  version?: string;
  questions?: QuestionDef[];
}

// ─── XLSForm Types ───────────────────────────────────────────────────────────

export interface XLSFormQuestion {
  type: string;
  name: string;
  label: string;
  hint?: string;
  relevant?: string;
  required?: 'yes' | 'no';
  appearance?: string;
}

export interface XLSForm {
  settings: Record<string, string>;
  survey: XLSFormQuestion[];
  choices?: Array<{ list_name: string; name: string; label: string }>;
}
