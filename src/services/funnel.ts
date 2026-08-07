import api from "./api";

/**
 * First-party funnel events — fire-and-forget counters to our own backend
 * (POST /api/events). No third-party trackers, no cookies, no personal data:
 * the only identifier is a random browser-local UUID, and the backend keeps a
 * closed allowlist of event names and prop keys (funnel_events.py), so
 * nothing free-form can be sent even by accident.
 *
 * Server-side stages (signup_completed, cap_hit, upgrade_paid) are recorded
 * by the backend itself; this client only reports the browser-side steps.
 */

export type FunnelEvent =
  | "page_view"
  | "signup_started"
  | "project_created"
  | "data_imported"
  | "upgrade_clicked";

const ANON_KEY = "fs_anon_id";

function anonId(): string {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) {
      id = (crypto as { randomUUID?: () => string }).randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(ANON_KEY, id);
    }
    return id;
  } catch {
    return ""; // storage blocked (private mode) — the event still counts, uniqueness doesn't
  }
}

/** Record one funnel event. Never throws, never blocks, never retries —
 *  losing a counter is always better than touching the user's flow. */
export function track(event: FunnelEvent, props?: Record<string, string>): void {
  try {
    api.post("/api/events", { event, anon_id: anonId(), props }).catch(() => {});
  } catch {
    /* even a synchronous axios failure must not surface */
  }
}
