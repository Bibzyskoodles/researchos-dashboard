// Enumerator Reputation Engine — Trust Intelligence Bible, new §17.
//
// A single Trust Index answers "how reliable is this one submission?"
// The reputation engine answers "how reliable is this enumerator, over time?"
//
// Model: Bayesian updating with exponential recency decay.
//
//   reputation = (prior_mean × prior_strength + Σ(trust_i × w_i))
//                / (prior_strength + Σw_i)
//
//   where w_i = exp(−0.693 × age_days / half_life)
//   so a submission half_life days old has half the weight of one submitted today.
//
// This means a brand-new enumerator starts at the prior (70/100 — "assumed average"),
// slides toward their actual track record as submissions accumulate, and old poor
// performance fades more quickly than recent good performance.

export interface SubmissionForReputation {
  submission_id: string;
  enumerator_id: string;
  submission_date: string;
  trustIndex: number;
  verdict: string;  // "PASS" | "FLAG" | "REJECT"
}

export type ReputationRiskBand = "TRUSTED" | "WATCH" | "CONCERN" | "CRITICAL";
export type ReputationTrend = "IMPROVING" | "DECLINING" | "STABLE" | "INSUFFICIENT_DATA";

export interface ReputationScore {
  enumeratorId: string;
  score: number;              // 0–100 Bayesian estimate
  submissionCount: number;
  effectiveWeight: number;    // Σw_i — shows how much recent data we have
  approveRate: number;        // 0–1 fraction of PASS verdicts
  flagRate: number;
  rejectRate: number;
  trend: ReputationTrend;
  trendDelta: number;         // recent window avg − previous window avg
  lastActivityDate: string | null;
  riskBand: ReputationRiskBand;
  riskBandLabel: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIOR_MEAN     = 70;   // assumed trust for a brand-new enumerator
const PRIOR_STRENGTH = 5;    // equivalent virtual submissions worth of prior
const HALF_LIFE_DAYS = 30;   // score halved in weight every 30 days
const TREND_WINDOW   = 3;    // compare last N vs previous N submissions

// ─── Helpers ──────────────────────────────────────────────────────────────────

function decayWeight(dateStr: string, now: Date): number {
  try {
    const ageDays = (now.getTime() - new Date(dateStr).getTime()) / 86400000;
    return Math.exp((-0.693 * Math.max(0, ageDays)) / HALF_LIFE_DAYS);
  } catch { return 1; }
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

const RISK_BAND_MAP: Record<ReputationRiskBand, string> = {
  TRUSTED:  "Trusted — high track record",
  WATCH:    "Watch — acceptable but monitor",
  CONCERN:  "Concern — patterns need review",
  CRITICAL: "Critical — consistent poor quality",
};

// ─── Main function ────────────────────────────────────────────────────────────

export function computeEnumeratorReputation(
  submissions: SubmissionForReputation[],
  now: Date = new Date()
): ReputationScore[] {
  // Group by enumerator
  const byEnum = new Map<string, SubmissionForReputation[]>();
  for (const s of submissions) {
    const list = byEnum.get(s.enumerator_id) || [];
    list.push(s);
    byEnum.set(s.enumerator_id, list);
  }

  const results: ReputationScore[] = [];

  byEnum.forEach((subs, enumeratorId) => {
    // Chronological order
    const sorted = [...subs].sort((a, b) => {
      try {
        return new Date(a.submission_date).getTime() - new Date(b.submission_date).getTime();
      } catch { return 0; }
    });

    // ── Bayesian score ─────────────────────────────────────────────────────────
    let weightedSum = 0;
    let weightSum   = 0;
    for (const s of sorted) {
      const w = decayWeight(s.submission_date, now);
      weightedSum += s.trustIndex * w;
      weightSum   += w;
    }
    const score = Math.round(
      (PRIOR_MEAN * PRIOR_STRENGTH + weightedSum) / (PRIOR_STRENGTH + weightSum)
    );

    // ── Verdict rates ──────────────────────────────────────────────────────────
    const total = sorted.length;
    const passCount   = sorted.filter(s => s.verdict === "PASS").length;
    const flagCount   = sorted.filter(s => s.verdict === "FLAG").length;
    const rejectCount = sorted.filter(s => s.verdict === "REJECT").length;
    const approveRate = total > 0 ? passCount   / total : 0;
    const flagRate    = total > 0 ? flagCount   / total : 0;
    const rejectRate  = total > 0 ? rejectCount / total : 0;

    // ── Trend ──────────────────────────────────────────────────────────────────
    let trend: ReputationTrend = "INSUFFICIENT_DATA";
    let trendDelta = 0;
    if (sorted.length >= TREND_WINDOW * 2) {
      const recentScores   = sorted.slice(-TREND_WINDOW).map(s => s.trustIndex);
      const previousScores = sorted.slice(-(TREND_WINDOW * 2), -TREND_WINDOW).map(s => s.trustIndex);
      trendDelta = Math.round(avg(recentScores) - avg(previousScores));
      trend = trendDelta >= 3 ? "IMPROVING" : trendDelta <= -3 ? "DECLINING" : "STABLE";
    } else if (sorted.length >= TREND_WINDOW) {
      trend = "STABLE";
    }

    // ── Risk band ──────────────────────────────────────────────────────────────
    const riskBand: ReputationRiskBand =
      score >= 80 && rejectRate < 0.10 ? "TRUSTED"  :
      score >= 65 && rejectRate < 0.30 ? "WATCH"    :
      score >= 50                       ? "CONCERN"  : "CRITICAL";

    results.push({
      enumeratorId,
      score,
      submissionCount: total,
      effectiveWeight: Math.round(weightSum * 10) / 10,
      approveRate, flagRate, rejectRate,
      trend, trendDelta,
      lastActivityDate: sorted.length > 0 ? sorted[sorted.length - 1].submission_date : null,
      riskBand,
      riskBandLabel: RISK_BAND_MAP[riskBand],
    });
  });

  return results;
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getEnumeratorReputation(
  enumeratorId: string,
  scores: ReputationScore[]
): ReputationScore | null {
  return scores.find(s => s.enumeratorId === enumeratorId) ?? null;
}
