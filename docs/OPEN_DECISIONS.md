# Open Decisions — needs the founder

Living list of things I can't safely do without your input or an infra action.
I re-surface these in status updates. Remove a row once it's resolved.

## Blocking / risk (do with you)

1. **Enable tenant isolation (multitenancy).**
   Today `MULTITENANCY_ENABLED` defaults OFF → `/api/*` serves all orgs
   unauthenticated. Flipping it on is the fix, BUT the JWT `org` (users-table
   UUID) and the Sheet `Org_ID` (webhook `client_id`) come from different
   sources and aren't reconciled. If they don't match, **every dashboard goes
   blank.** *Need from you:* confirmation of how live submissions' `Org_ID`
   relates to the logged-in user's `org` (or let me add a reconciliation step),
   then I enable it.

2. **Fail-closed JWT secret.**
   `JWT_SECRET` has an insecure default and the app boots anyway (forgeable
   tokens). I can make it refuse to start without a real secret. *Need from
   you:* confirm `JWT_SECRET` is set in the Railway env; then I flip it.

3. **Persist data across redeploys.**
   Auth/orgs/users, dedup history, Kobo schema cache, and all InsightScore
   projects live in ephemeral SQLite at `/data` with **no volume declared** —
   a redeploy wipes them. *Need from you:* either mount a Railway volume at
   `/data` (fastest), or green-light me to start the managed-Postgres
   migration.

## Confirmations (quick)

4. **AI keys in prod.** The pricing Ada + dashboard Ada use the backend
   `OPENAI_API_KEY`. Dashboard Ada already works, so this is likely fine —
   confirm if pricing Ada ever says "can't reach my AI service."

5. **Benchmark rates on the pricing page.** Impact value uses ₦2,500/hr (NGN)
   and $35/hr (USD), from published salary data. Tell me if you want different
   numbers for your market.

6. **SOC 2 wording.** I removed the "SOC 2 Type II Compliant" footer claim
   (not certified). If you're pursuing certification, say so and I'll reword to
   something forward-looking rather than absent.
