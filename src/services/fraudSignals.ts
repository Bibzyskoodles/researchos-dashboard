// Cross-submission fraud signals — Trust Intelligence Bible, new §16.
//
// This module answers questions that no single submission can answer alone:
//   1. Impossible-travel: could the enumerator physically have moved that far
//      between their last submission and this one?
//   2. Time-burst: did multiple submissions appear within minutes of each other,
//      suggesting batch fabrication?
//   3. Off-hours: are submissions consistently arriving at unusual hours?
//
// All functions are pure (no I/O, no clock beyond what callers supply). The
// analysis runs on the client from whatever submissions are currently loaded.

import { haversineMeters } from "./trustEngine";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SubmissionForSignal {
  submission_id: string;
  enumerator_id: string;
  submission_date: string;
  gps?: { lat?: number | null; lon?: number | null } | null;
}

export type TravelRisk = "IMPOSSIBLE" | "VERY_HIGH" | "SUSPICIOUS" | "CLEAR";

export interface TravelSegment {
  fromId: string;
  toId: string;
  fromDate: string;
  toDate: string;
  distanceM: number;
  durationMinutes: number;
  impliedSpeedKph: number;
  risk: TravelRisk;
  riskLabel: string;
}

export type TimingAlertType = "BURST" | "OFF_HOURS";

export interface TimingAlert {
  submissionIds: string[];
  windowStart: string;
  windowEnd: string;
  windowMinutes: number;
  type: TimingAlertType;
  reading: string;
}

export interface EnumeratorFraudSignals {
  enumeratorId: string;
  travelSegments: TravelSegment[];
  timingAlerts: TimingAlert[];
  impossibleCount: number;
  veryHighCount: number;
  suspiciousCount: number;
  burstCount: number;
  offHoursCount: number;
  riskLevel: "CRITICAL" | "HIGH" | "MEDIUM" | "CLEAR";
}

// ─── Thresholds ───────────────────────────────────────────────────────────────

// Speed thresholds for travel risk classification
const IMPOSSIBLE_KPH = 900;   // faster than any commercial aircraft
const VERY_HIGH_KPH  = 350;   // faster than any land vehicle ever
const SUSPICIOUS_KPH = 120;   // above realistic Nigerian road speed

// Burst detection: N+ submissions in this many minutes is a burst
const BURST_WINDOW_MINUTES = 10;
const BURST_THRESHOLD = 3;

// Off-hours: before 5am or after 11pm (local browser time)
const OFF_HOURS_START = 23; // 11pm
const OFF_HOURS_END   = 5;  // 5am

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDate(s: string): Date | null {
  try { const d = new Date(s); return isNaN(d.getTime()) ? null : d; }
  catch { return null; }
}

function numOrNull(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function getHour(dateStr: string): number {
  const d = parseDate(dateStr);
  return d ? d.getHours() : 12;
}

function classifySpeed(kph: number): { risk: TravelRisk; riskLabel: string } {
  if (kph > IMPOSSIBLE_KPH) return { risk: "IMPOSSIBLE",  riskLabel: "Physically impossible — faster than any aircraft" };
  if (kph > VERY_HIGH_KPH)  return { risk: "VERY_HIGH",   riskLabel: "Faster than any land vehicle" };
  if (kph > SUSPICIOUS_KPH) return { risk: "SUSPICIOUS",  riskLabel: "Faster than realistic field travel" };
  return { risk: "CLEAR", riskLabel: "Plausible" };
}

// ─── Main analysis ─────────────────────────────────────────────────────────────

export function analyseEnumeratorSignals(
  submissions: SubmissionForSignal[]
): EnumeratorFraudSignals[] {
  // Group by enumerator
  const byEnum = new Map<string, SubmissionForSignal[]>();
  for (const s of submissions) {
    const list = byEnum.get(s.enumerator_id) || [];
    list.push(s);
    byEnum.set(s.enumerator_id, list);
  }

  const results: EnumeratorFraudSignals[] = [];

  byEnum.forEach((subs, enumeratorId) => {
    // Chronological order
    const sorted = [...subs].sort((a, b) => {
      const da = parseDate(a.submission_date), db = parseDate(b.submission_date);
      if (!da || !db) return 0;
      return da.getTime() - db.getTime();
    });

    // ── 1. Impossible-travel analysis ──────────────────────────────────────────
    const travelSegments: TravelSegment[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1], curr = sorted[i];
      const lat1 = numOrNull(prev.gps?.lat), lon1 = numOrNull(prev.gps?.lon);
      const lat2 = numOrNull(curr.gps?.lat), lon2 = numOrNull(curr.gps?.lon);
      const d1 = parseDate(prev.submission_date), d2 = parseDate(curr.submission_date);
      if (lat1 == null || lon1 == null || lat2 == null || lon2 == null || !d1 || !d2) continue;
      const durationMinutes = (d2.getTime() - d1.getTime()) / 60000;
      // Sub-minute gaps are almost always batch-import artifacts (rows scored
      // together carry near-identical timestamps), not real field movement —
      // dividing by them fabricates absurd speeds. True duplicates are the
      // duplicate engine's job; travel analysis needs a real time gap.
      if (durationMinutes < 1) continue;
      const distanceM = haversineMeters(lat1, lon1, lat2, lon2);
      const impliedSpeedKph = (distanceM / 1000) / (durationMinutes / 60);
      const { risk, riskLabel } = classifySpeed(impliedSpeedKph);
      if (risk !== "CLEAR") {
        travelSegments.push({
          fromId: prev.submission_id, toId: curr.submission_id,
          fromDate: prev.submission_date, toDate: curr.submission_date,
          distanceM: Math.round(distanceM),
          durationMinutes: Math.round(durationMinutes),
          impliedSpeedKph: Math.round(impliedSpeedKph),
          risk, riskLabel,
        });
      }
    }

    // ── 2. Time-burst analysis ─────────────────────────────────────────────────
    const timingAlerts: TimingAlert[] = [];
    const usedInBurst = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
      if (usedInBurst.has(sorted[i].submission_id)) continue;
      const anchor = parseDate(sorted[i].submission_date);
      if (!anchor) continue;
      const windowEnd = new Date(anchor.getTime() + BURST_WINDOW_MINUTES * 60000);
      const inWindow = sorted.filter(s => {
        const d = parseDate(s.submission_date);
        return d && d >= anchor && d <= windowEnd;
      });
      if (inWindow.length >= BURST_THRESHOLD) {
        inWindow.forEach(s => usedInBurst.add(s.submission_id));
        const lastDate = inWindow[inWindow.length - 1].submission_date;
        const actualMinutes = Math.round(
          ((parseDate(lastDate)?.getTime() || anchor.getTime()) - anchor.getTime()) / 60000
        );
        timingAlerts.push({
          submissionIds: inWindow.map(s => s.submission_id),
          windowStart: sorted[i].submission_date,
          windowEnd: lastDate,
          windowMinutes: actualMinutes,
          type: "BURST",
          reading: `${inWindow.length} submissions in ${actualMinutes < 1 ? "under a minute" : `${actualMinutes} minutes`} — possible batch fabrication.`,
        });
      }
    }

    // Off-hours: group consecutive off-hours submissions
    const offHoursSubs = sorted.filter(s => {
      const h = getHour(s.submission_date);
      return h >= OFF_HOURS_START || h < OFF_HOURS_END;
    });
    if (offHoursSubs.length >= 2) {
      timingAlerts.push({
        submissionIds: offHoursSubs.map(s => s.submission_id),
        windowStart: offHoursSubs[0].submission_date,
        windowEnd: offHoursSubs[offHoursSubs.length - 1].submission_date,
        windowMinutes: 0,
        type: "OFF_HOURS",
        reading: `${offHoursSubs.length} submissions logged outside working hours (before ${OFF_HOURS_END}am or after ${OFF_HOURS_START - 12}pm).`,
      });
    }

    // ── Summary ────────────────────────────────────────────────────────────────
    const impossibleCount  = travelSegments.filter(t => t.risk === "IMPOSSIBLE").length;
    const veryHighCount    = travelSegments.filter(t => t.risk === "VERY_HIGH").length;
    const suspiciousCount  = travelSegments.filter(t => t.risk === "SUSPICIOUS").length;
    const burstCount       = timingAlerts.filter(t => t.type === "BURST").length;
    const offHoursCount    = offHoursSubs.length;

    const riskLevel: EnumeratorFraudSignals["riskLevel"] =
      impossibleCount > 0          ? "CRITICAL" :
      veryHighCount > 0            ? "HIGH"     :
      burstCount > 0 || suspiciousCount > 1 ? "HIGH" :
      suspiciousCount > 0 || offHoursCount >= 3 ? "MEDIUM" : "CLEAR";

    results.push({
      enumeratorId, travelSegments, timingAlerts,
      impossibleCount, veryHighCount, suspiciousCount,
      burstCount, offHoursCount, riskLevel,
    });
  });

  return results;
}

// ─── Convenience lookup helpers ───────────────────────────────────────────────

export function getEnumeratorSignals(
  enumeratorId: string,
  allSignals: EnumeratorFraudSignals[]
): EnumeratorFraudSignals | null {
  return allSignals.find(s => s.enumeratorId === enumeratorId) ?? null;
}

/** Returns travel segments that reference this submission (as from or to). */
export function getSubmissionTravelFlags(
  submissionId: string,
  allSignals: EnumeratorFraudSignals[]
): TravelSegment[] {
  const out: TravelSegment[] = [];
  for (const sig of allSignals) {
    for (const seg of sig.travelSegments) {
      if (seg.fromId === submissionId || seg.toId === submissionId) out.push(seg);
    }
  }
  return out;
}

/** True if this submission is part of any burst cluster. */
export function isInBurst(
  submissionId: string,
  allSignals: EnumeratorFraudSignals[]
): boolean {
  return allSignals.some(sig =>
    sig.timingAlerts.some(a => a.type === "BURST" && a.submissionIds.includes(submissionId))
  );
}
