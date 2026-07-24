/**
 * Proactive surfacing for InsightScore (CallScore Bible Part 1.4): the AI
 * Analysis destination badges itself when freshly-verified interviews are
 * ready to analyze, instead of waiting for the user to remember to check.
 * "Fresh" = PASS submissions scored since the user last opened AI Analysis
 * (tracked locally per browser — this is a nudge, not an unread-count
 * system of record).
 */
import { useEffect, useState } from 'react';
import { dashboardApi } from '../services/api';

const SEEN_KEY = 'fs_insights_seen_at';
const REFRESH_MS = 5 * 60 * 1000;

export function markInsightsSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, new Date().toISOString());
  } catch {
    // storage unavailable (private mode) — badge just stays, harmless
  }
}

function countFresh(rows: any[]): number {
  const seenAt = localStorage.getItem(SEEN_KEY);
  const seenTs = seenAt ? Date.parse(seenAt) : 0;
  let count = 0;
  for (const r of rows) {
    const verdict = r.Verdict ?? r.verdict ?? '';
    if (verdict !== 'PASS') continue;
    const scored = r.Scored_At ?? r.scored_at ?? r.Submission_Date ?? r.submission_date ?? '';
    const ts = scored ? Date.parse(scored) : NaN;
    // Rows without a parseable timestamp count as fresh only for first-time
    // viewers (seenTs 0) — better to over-invite than silently hide.
    if (isNaN(ts) ? seenTs === 0 : ts > seenTs) count++;
  }
  return count;
}

export function useVerifiedReadyCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      dashboardApi
        .getSubmissions({ verdict: 'PASS', limit: 100 })
        .then((r) => {
          if (cancelled) return;
          const rows = r.data.submissions || r.data || [];
          setCount(Array.isArray(rows) ? countFresh(rows) : 0);
        })
        .catch(() => {
          // Roles without submission access (or a flaky connection) just
          // don't get the nudge — never an error surface.
          if (!cancelled) setCount(0);
        });
    };
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    const onSeen = () => refresh();
    window.addEventListener('fs-insights-seen', onSeen);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener('fs-insights-seen', onSeen);
    };
  }, []);

  return count;
}

export function notifyInsightsSeen(): void {
  markInsightsSeen();
  window.dispatchEvent(new Event('fs-insights-seen'));
}
