# Open Decisions — needs the founder

Living list of things I can't safely do without your input or an infra action.
I re-surface these in status updates. Remove a row once it's resolved.

## ✅ Resolved

- **Persistent volumes mounted** at `/data` on fieldscore-backend + insightscore
  (2026-07-08). Data now survives redeploys.
- **JWT set + fail-closed shipped** (2026-07-08). `JWT_SECRET` is set in Railway
  (real value); backend now refuses to boot on the insecure default.
- **`/api/*` default-open hole closed** (2026-07-08). All API reads now require
  a valid login; anonymous access returns 401. (Org-based *filtering* still
  deferred — see below.)

## Blocking / risk (do with you)

1. **Per-org isolation filtering (multitenancy).**
   Auth is now required, so the API is no longer anonymous. The remaining step
   is *filtering rows by organisation* (`MULTITENANCY_ENABLED=true`). Deferred
   because it's single-tenant today ("only me for now") and the JWT `org` vs
   Sheet `Org_ID` mapping still needs reconciling before it's safe with
   multiple orgs. *Revisit when a second real org onboards.*

2. **Managed Postgres migration (later).**
   Volumes fixed the immediate durability risk. Longer term, moving submissions
   off Google Sheets and auth/dedup/InsightScore off SQLite to Postgres is the
   real scale/backup story. Not urgent; flag when you want it scoped.

## Confirmations (quick)

3. **Stronger JWT secret (optional).** Current value is a bit guessable. Swap in
   the long random one (`jQIFhBqP4G-pdwuSQvCynOKTx66AI0IKos5CeCb1Wn_v7pklbdW0kFoyt0LXmksm`)
   when convenient. Changing it logs everyone out (they re-login).

4. **ADMIN_SECRET.** Confirm it's set on fieldscore-backend (gates the
   create-client admin endpoint). Safe to set; no side effects.

5. **WEBHOOK_SECRET (Kobo).** Still unset → `/webhook`, `/batch`, `/kobo`,
   `/questionnaire` accept unauthenticated calls. Setting it requires also
   adding `Authorization: Bearer <secret>` to your KoboToolbox webhook, or
   incoming submissions get rejected. Tell me when you want to do both sides.

6. **Benchmark rates & SOC 2 wording** — as before: tell me if the pricing
   ₦2,500/hr & $35/hr benchmarks should change, or if you're pursuing SOC 2.
