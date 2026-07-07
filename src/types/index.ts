export type AdaState =
  | 'idle' | 'greeting' | 'listening' | 'thinking'
  | 'speaking' | 'guiding' | 'celebrating' | 'warning'
  | 'explaining' | 'reviewing' | 'connecting' | 'waiting' | 'hidden';

export type UserMode = 'beginner' | 'intermediate' | 'expert';

export interface AdaContext {
  state: AdaState;
  previousState: AdaState | null;
  position: { x: number; y: number };
  page: string;
  isTyping: boolean;
  lastMessage: string | null;
}

export interface AdaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  page?: string;
}

export type Platform = 'field-quality' | 'insights' | 'reports' | 'research';

export type Verdict = 'PASS' | 'FLAG' | 'REJECT';
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface Submission {
  submission_id: string;
  enumerator_id: string;
  submission_date: string;
  duration_mins: number;
  project_id: string;
  platform: string;
  overall_score: number;
  grade: Grade;
  verdict: Verdict;
  flags: string | string[];
  supervisor_action: string;
  scored_at: string;
  gps: {
    lat: number;
    lon: number;
    accuracy_m: number;
    address: string;
  };
  checks?: {
    image: { status: string; score: number; finding: string };
    audio: { status: string; score: number; finding: string };
    duplicate: { status: string };
  };
}

export interface Enumerator {
  enumerator_id: string;
  total_subs: number;
  avg_score: number;
  grade: Grade;
  trend: 'up' | 'down' | 'neutral';
  pass_count: number;
  flag_count: number;
  last_submission: string;
}

export interface DashboardStats {
  total_submissions: number;
  avg_score: number;
  pass_rate: number;
  pass_count: number;
  flag_count: number;
  reject_count: number;
  active_enumerators: number;
  score_trend: number;
  gps_compliance?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recent_submissions: Submission[];
  enumerators: Enumerator[];
  score_chart: { score: number; date: string }[];
  alerts: Submission[];
  engine_averages: {
    image: number;
    audio: number;
  };
}

export type InsightProjectStatus = 'pending' | 'analysing' | 'complete' | 'error';

export interface InsightProject {
  id: string;
  name: string;
  submission_count: number;
  status: InsightProjectStatus;
  last_activity: string;
  created_at: string;
}

export interface InsightTheme {
  title: string;
  summary: string;
  quote_count: number;
  quotes: string[];
  sentiment: 'positive' | 'negative' | 'mixed' | 'neutral';
}

export interface InsightReport {
  executive_summary: string;
  business_implications: string[];
  unexpected_findings: string[];
  risks: string[];
  opportunities: string[];
  themes: InsightTheme[];
  contradictions: string[];
  outliers: string[];
  recommendations: string[];
  generated_at: string;
  download_url?: string;
}

export interface InsightSubmission {
  id: string;
  enumerator_id: string;
  score: number;
  date: string;
  location: string;
  verdict: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'viewer';
  last_login: string;
}

export interface Organisation {
  id: string;
  name: string;
  plan: 'trial' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'trial' | 'expired' | 'cancelled';
}

export interface AuthState {
  user: User | null;
  org: Organisation | null;
  token: string | null;
  isAuthenticated: boolean;
}
