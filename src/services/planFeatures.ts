// Reading the server's "not on this plan" answer.
//
// The backend's plan_features.py refuses three deliverables for a free
// workspace — the data integrity certificate, shared report links, and the
// analysis workbook — and answers 402 rather than 403. That distinction is the
// whole point: 403 means "you are not allowed", 402 means "not on this plan",
// and only the second one has an action attached to it.
//
// This module exists so no page has to re-derive that from a status code. A
// component asks `upgradeRequired(error)` and either gets the sentence to show
// beside an upgrade link, or null and its ordinary error handling.
//
// The gate itself is server-side and stays there. Nothing here enforces
// anything — hiding a button protects nothing (CLAUDE.md). This is only about
// what the person sees when the server has already said no.

/** Feature keys, matching plan_features.PAID_FEATURES on the backend. */
export type PaidFeature = 'certificate' | 'shared_report' | 'analysis_export';

export interface UpgradeRequired {
  feature: PaidFeature | string;
  /** The server's own sentence — it names what upgrading gets you. */
  message: string;
}

/**
 * The upgrade prompt behind an axios error, or null if this was an ordinary
 * failure.
 *
 * Deliberately checks the `upgrade_required` flag and not the status code
 * alone: `usage_limits` also answers 402 when a workspace has spent its
 * verification allowance, and that is a different message with a different
 * remedy. Reading the flag keeps the two apart even though they share a code.
 */
export function upgradeRequired(error: unknown): UpgradeRequired | null {
  const data = (error as { response?: { status?: number; data?: unknown } })?.response;
  if (!data || data.status !== 402) return null;
  const body = data.data as { upgrade_required?: boolean; feature?: string; error?: string } | undefined;
  if (!body?.upgrade_required) return null;
  return {
    feature: body.feature || 'unknown',
    message: body.error || 'This is available on a paid plan.',
  };
}

/**
 * What a free workspace can still do with this feature, said plainly.
 *
 * Shown under the upgrade sentence so the refusal never reads as "your work is
 * locked away". It is not: the findings are on screen, and the rows they
 * uploaded are still theirs to export. Only our attestation of them is paid.
 */
export const STILL_AVAILABLE: Record<string, string> = {
  certificate:
    'Your verification results stay on screen, and you can still export your submissions.',
  shared_report:
    'You can still see the full report here and export your submissions.',
  analysis_export:
    'The themes and findings stay visible on screen.',
};
