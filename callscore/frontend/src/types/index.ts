// Mirrors backend/app/routes response shapes.
// See docs/ARCHITECTURE_BIBLE.md Part 4.4 for the Scorecard shape.

// Bible 4A.3: register is mechanically derived server-side from
// confidence_level — the UI renders it, never re-derives or rewrites it.
export interface AdaSummary {
  register: "know" | "suspect" | "recommend_checking";
  text: string;
}

export interface Scorecard {
  interview_id: string;
  overall_quality_score: number;
  authenticity_score: number;
  compliance_score: number;
  behaviour_score: number;
  fraud_risk: "low" | "medium" | "high";
  confidence_level: number;
  recommended_action: "none" | "review_recording" | "conduct_backcheck" | "escalate";
  late_start_flag: boolean;
  early_stop_flag: boolean;
  ada_summary: AdaSummary;
  evidence: EvidenceItem[];
}

export interface EvidenceItem {
  agent: string;
  type: string;
  description: string;
  timestamp_range: [number | null, number | null]; // seconds into interview
  confidence: number | null;
}

// Part 8.6: every supervisor queue item needs a one-line "why now".
export interface SupervisorQueueItem {
  interview_id: string;
  enumerator_id: string;
  fraud_risk: "low" | "medium" | "high";
  confidence_level: number;
  recommended_action: Scorecard["recommended_action"];
  why_now: string;
}
