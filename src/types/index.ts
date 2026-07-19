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

// Attached to an assistant message that proposes an action significant
// enough to need explicit confirmation before it runs — rendered as a
// confirm/cancel card instead of (or alongside) plain text. Nothing the
// action describes has happened yet; only the user's click triggers it.
export type AdaConfirmAction =
  | { type: 'delete_project'; project_id: string; project_name: string }
  | {
      type: 'upload_submissions';
      fileName: string;
      suggestedProjectName: string;
      rowCount: number;
      headers: string[];
      rows: Record<string, string>[];
      mapping: Record<string, string>;
      mappedFieldLabels: string[];
    };

// A read-only follow-up offered alongside a proactive insight message (e.g.
// "highlight this enumerator", "filter to flagged submissions"). Unlike
// AdaConfirmAction this never mutates anything, so it dispatches straight
// through the existing AdaCommand mechanism on click — no confirm/cancel
// step, same as any other navigation/filter/highlight command Ada's chat
// tool-calls already produce. `command` is intentionally typed loosely
// here (not importing AdaCommand, which lives in ada/AdaContext.tsx and
// would create a circular import) — AdaDock casts it when dispatching.
export interface AdaInsightAction {
  label: string;
  command: Record<string, unknown>;
}

export interface AdaMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  page?: string;
  confirmAction?: AdaConfirmAction;
  insightAction?: AdaInsightAction;
}

// One rule-based, non-AI observation from GET /ada/proactive-insights —
// see fieldscore-backend/ada/proactive.py. `message` is a templated
// sentence built from real numbers (never LLM-generated), and
// `suggested_action`, when present, is an AdaCommand-shaped object safe to
// pass straight to dispatchCommand (read-only: navigate/filter/highlight).
export interface ProactiveInsight {
  id: string;
  type: 'enumerator_burst' | 'flag_rate_spike' | 'stale_certificate';
  severity: 'warning' | 'info';
  project_id: string;
  project_name: string;
  message: string;
  detail: Record<string, unknown>;
  suggested_action: Record<string, unknown> | null;
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
  review_status?: string;
  // Verdict is always the algorithm's original, permanent call — never
  // overwritten. An override is recorded separately, always attributed.
  verdict_override?: 'PASS' | 'FLAG' | 'REJECT' | null;
  override_reason?: string | null;
  override_by?: string | null;
  override_at?: string | null;
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
  name?: string;
  total_subs?: number;
  total_submissions?: number;
  avg_score: number;
  grade?: Grade;
  trend?: 'up' | 'down' | 'neutral';
  // Raw backend Verdict tally, frozen at scoring time — can legitimately
  // drift from the live Trust Index recompute (see GetEnumeratorsResponse's
  // enumerator_submissions below). Kept as a fallback for when that capped
  // detail set doesn't cover this enumerator.
  pass_count?: number;
  pass_rate?: number;
  flag_count?: number;
  flags?: number;
  last_submission?: string;
}

// GET /api/enumerators — see fieldscore-backend's api.py `enumerators()`
// route comment (mirrors /api/dashboard's stats_submissions pattern).
export interface GetEnumeratorsResponse {
  enumerators: Enumerator[];
  // Capped (ENUM_DETAIL_CAP, most-recent rows), per-engine detail rows for
  // the frontend to regroup by enumerator_id and recompute live pass/flag/
  // reject counts — same reason /api/dashboard ships stats_submissions.
  enumerator_submissions?: Submission[];
  detail_capped?: boolean;
  detail_row_count?: number;
}

// GET /api/enumerators/leaderboard
export interface LeaderboardEntry {
  rank: number;
  enumerator_id: string;
  total_submissions: number;
  pass_count: number;
  flag_count: number;
  reject_count: number;
  pass_rate: number;
  avg_score: number;
  trend: number;
  badges: string[];
}

export interface GetLeaderboardResponse {
  leaderboard: LeaderboardEntry[];
  top_performers: LeaderboardEntry[];
  total_enumerators: number;
  project_id: string | null;
  generated_at: string;
  // Same capped-detail-rows pattern as GetEnumeratorsResponse — see
  // fieldscore-backend's api.py `enumerators_leaderboard()` route comment.
  leaderboard_submissions?: Submission[];
  detail_capped?: boolean;
  detail_row_count?: number;
}

export interface DashboardStats {
  total_submissions: number;
  avg_score: number;
  pass_rate: number;
  // Raw backend Verdict tally, frozen at scoring time — can legitimately
  // drift from the live Trust Index recompute (see stats_submissions
  // below). Kept as a fallback for when stats_submissions is capped/empty.
  pass_count: number;
  flag_count: number;
  reject_count: number;
  active_enumerators: number;
  score_trend: number;
  gps_compliance?: number;
  // True when the org has more submissions than stats_submissions covers
  // (see fieldscore-backend's STATS_DETAIL_CAP) — the live recompute below
  // is then based on a subset, not the full org.
  stats_capped?: boolean;
  stats_row_count?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  recent_submissions: Submission[];
  // Full (capped) row set with per-engine `checks`, for recomputing the
  // headline pass/flag/reject counts with the same live Trust Index logic
  // SubmissionsPage.tsx and this page's own per-row badges already use —
  // see OverviewPage.tsx's liveStats computation.
  stats_submissions?: Submission[];
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
  quotes: (string | { text: string; respondent?: string })[];
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
  role: 'admin' | 'manager' | 'viewer' | 'client';
  last_login: string;
}

export interface Organisation {
  id: string;
  name: string;
  plan: 'trial' | 'starter' | 'professional' | 'enterprise';
  status: 'active' | 'trial' | 'expired' | 'cancelled';
  industry_id?: string;
  default_study_type_id?: string;
}

export interface AuthState {
  user: User | null;
  org: Organisation | null;
  token: string | null;
  isAuthenticated: boolean;
}

// Analytics Types
export type DataSource = 'fieldscore_direct' | 'kobotools';
export type DeviceType = 'mobile' | 'web' | 'tablet' | 'unknown';

export interface SourceMetrics {
  source: string;
  total_responses: number;
  completed_responses: number;
  incomplete_responses: number;
  completion_rate: number;
  device_distribution: Record<string, number>;
  avg_completion_time_seconds: number;
  median_completion_time_seconds: number;
  response_rate_per_day: Array<{ date: string; count: number }>;
  last_response_time: string | null;
  first_response_time: string | null;
}

export interface QuestionMetrics {
  question_id: string;
  question_text: string;
  source: string | null;
  response_count: number;
  skip_count: number;
  skip_rate: number;
  answer_distribution: Record<string, number>;
  most_common_answer: string | null;
  avg_rating: number | null;
  device_breakdown: Record<string, number>;
}

export interface DropOffAnalysis {
  question_position: number;
  question_id: string;
  question_text: string;
  responses_at_question: number;
  responses_at_next_question: number;
  drop_off_count: number;
  drop_off_rate: number;
  source_breakdown: Record<string, { responses_at_question: number; responses_at_next: number; drop_off: number }>;
}

export interface SourceDistribution {
  total_responses: number;
  source_counts: Record<string, number>;
  source_percentages: Record<string, number>;
}

export interface AnalyticsReport {
  questionnaire_id: string;
  generated_at: string;
  total_responses: number;
  source_distribution: SourceDistribution;
  source_metrics: Record<string, SourceMetrics>;
  question_metrics: QuestionMetrics[];
  per_source_question_metrics: Record<string, QuestionMetrics[]>;
  drop_off_analysis: DropOffAnalysis[];
  completion_rate_by_source: Record<string, number>;
  avg_time_by_source: Record<string, number>;
  device_recommendations: Record<string, string>;
}

export interface Questionnaire {
  id: string;
  title: string;
  description?: string;
  organization_id: string;
  created_at: string;
  updated_at: string;
}
