// Call-mode (CallScore) response shapes — mirrors callscore/backend routes.
// Headline verdict/grade use the same vocabulary as Field submissions so
// shared surfaces render both modes identically.

export type CallFraudRisk = 'low' | 'medium' | 'high';
export type CallRecommendedAction = 'none' | 'review_recording' | 'conduct_backcheck' | 'escalate';

// Bible 4A.3: the register is derived server-side from confidence_level —
// the UI renders it, never re-derives or rewrites it.
export interface AdaSummary {
  register: 'knows' | 'suspects' | 'recommends_checking';
  text: string;
}

export interface CallEvidenceItem {
  agent: string;
  type: string;
  description: string;
  timestamp_range: [number | null, number | null]; // seconds into interview
  confidence: number | null;
}

export interface CallScorecard {
  interview_id: string;
  overall_quality_score: number | null;
  verdict: 'PASS' | 'FLAG' | 'REJECT' | null;
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | null;
  authenticity_score: number | null;
  compliance_score: number | null;
  behaviour_score: number | null;
  fraud_risk: CallFraudRisk;
  confidence_level: number;
  recommended_action: CallRecommendedAction;
  late_start_flag: boolean;
  early_stop_flag: boolean;
  ada_summary: AdaSummary;
  evidence: CallEvidenceItem[];
}

// Bible Part 8.6: every queue item carries a one-line "why now".
export interface CallQueueItem {
  interview_id: string;
  enumerator_id: string;
  fraud_risk: CallFraudRisk;
  confidence_level: number;
  recommended_action: CallRecommendedAction;
  why_now: string;
}

export interface CallInterviewListItem {
  id: string;
  enumerator_id: string | null;
  respondent_id: string | null;
  started_at: string | null;
  stopped_at: string | null;
  consent_captured: boolean;
  sync_status: string | null;
  verdict: string | null;
  grade: string | null;
}
