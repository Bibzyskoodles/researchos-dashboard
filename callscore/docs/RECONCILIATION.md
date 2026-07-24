# CallScore ↔ FieldScore Reconciliation

Status: analysis complete against `fieldscore-backend` @ `ab407f5`.
Per `CLAUDE.md` ("Reconciliation, not replacement"), this maps CallScore's
proposed schema onto FieldScore's *actual* code, and names the decisions
that need a human call before any migration is applied.

## 1. FieldScore's real persistence state (verified in code)

FieldScore runs **two databases plus a legacy SQLite layer** — not one
Supabase schema, and no longer Google Sheets:

| Store | Module | Holds | Notes |
|---|---|---|---|
| Railway Postgres (`DATABASE_URL`) | `db.py` | `submissions`, `project_configs`, `enumerator_zones`, `insightscore_outbox`, `webhook_outbox` | **System of record for scored work.** Replaced Sheets ("Sheets was never meant to be a database"). TEXT ids, TitleCase JSON in `checks_json`. |
| Supabase (`SUPABASE_URL`) | `database.py` | `clients`, `projects`, `billing_ledger`, `invoices`, `audit_log`, fingerprints (schema.sql) | Accounts/billing. `clients` ≈ CallScore's `organizations`. TEXT ids (`CLI-`, `PROJ-`). |
| SQLite `/data/fieldscore.db` | `auth.py` (default), `ada/memory.py` | orgs/users auth (unless `AUTH_BACKEND=supabase`), Ada's User/Org memory | Ephemeral without a Railway volume. |

The `CLAUDE.md` note "dashboard may still run off Google Sheets" is **stale**:
`db.py` is the live path; `scripts/migrate_from_sheets.py` exists for the cutover.

## 2. Entity mapping

| CallScore proposal (0001_init.sql) | FieldScore reality | Reconciliation |
|---|---|---|
| `organizations` | `clients` (Supabase) + `org_id` on submissions | **Drop.** Use `client_id`/`org_id`. |
| `projects` (UUID) | `projects` (Supabase, TEXT `PROJ-…`, JSONB `config`) + `project_configs` (db.py) | **Drop.** Call mode becomes config on the existing project (`config.collection_modes`, call-check settings alongside `checks_enabled`). |
| `respondents` | none — FieldScore has no respondent entity | **New table, genuinely Call-specific** (encrypted PII per Bible Part 9). |
| `enumerators` (global UUID table) | **Deliberately none.** `enumerator_stats.py` documents `enumerator_memory` as dead; identity is the free-text `enumerator_id` on submission rows, stats always computed live | **CONFLICT — decision needed** (§3.1). |
| `interview_sessions` | `submissions` (db.py) — the interview/submission entity | **Extend, don't duplicate**: add `collection_mode` (`'field'`\|`'call'`), `started_at`, `stopped_at`, `device1_call_started_at/ended_at`, `consent_captured`, `sync_status`. Client-generated id fits the TEXT PK. |
| `evidence_artifacts` | nothing equivalent (media urls are flat columns) | **New table**, keyed on `submission_id`. |
| `agent_findings` | per-check flat columns + `checks_json` on submissions | **New table** — Call's Tier 1–4 findings are richer than flat columns; keyed on `submission_id`. |
| `scorecards` | already on `submissions`: `overall_score`, `grade`, `verdict`, `flags`, `fraud_flag`, `supervisor_action` | **Map onto submissions columns**; Call-specific sub-scores (authenticity/compliance/behaviour/confidence) go in `checks_json` or a slim `call_scorecards` table (§3.2). |
| `sync_queue` | none (webhooks push server-side) | **New table** — offline-first is Call-specific. |
| `ada_overrides` | already on `submissions`: `verdict_override`, `override_reason`, `override_by`, `override_at`, `review_status` | **CONFLICT — decision needed** (§3.3). |
| Scorecard JSON (UUID, 0-100 scores) | TitleCase dicts, `PASS/FLAG/REJECT` verdicts, A–F grades | Call scorecard must render into the existing verdict/grade vocabulary for shared dashboards. |

Also: FieldScore already has an `insightscore_outbox` — CallScore's "flows to
InsightScore automatically" should reuse that outbox, not build a new handoff.

## 3. Decision points (stop-and-ask per CLAUDE.md)

> **Status: DECIDED 2026-07-23** — all four recommended options approved:
> 3.1 (a) registry table, 3.2 (b→slim `call_scorecards`), 3.3 shared
> append-only `override_log`, 3.4 (a) separate service. Implemented in
> `migrations/0001_call_mode.sql` and the rewritten models/routes.
> 3.5 (Ada memory) remains open — revisit when Ada work reaches this repo.

### 3.1 Enumerator identity — the trust record depends on this
Bible 4.6/4A.5 requires a **global `enumerators` table from MVP**. FieldScore
*deliberately rejected* a stored enumerator table after `enumerator_memory`
drifted from reality — identity is free-text IDs on submissions, stats
computed live. Options:
- **(a) Registry table**: introduce `enumerators` keyed `(org_id, enumerator_ref)`
  (TEXT, matching submissions' free-text ids), used for identity/voice-fingerprint
  metadata only — *stats stay computed live* from submissions, so the drift
  concern doesn't recur. Trust-record queries join on `enumerator_ref`.
- **(b) No table**: keep identity implicit; trust record = live queries over
  submissions in both modes. Simpler, but nowhere to hang voice-fingerprint
  enrolment, cross-org passport identity, or Call-mode assignment.

### 3.2 Where Call scores live
- **(a) On `submissions`** via `checks_json` (like every existing engine) —
  one queue, one dashboard, minimal schema change.
- **(b) Slim `call_scorecards` table** for the 4 sub-scores + confidence +
  timing flags — cleaner queries, but a second place scores live.

### 3.3 Override audit
FieldScore already records verdict overrides on the submission row (no reason
required? — `override_reason` exists but enforcement unverified). Bible 4A.6
wants an append-only log with mandatory reason. Options: extend the existing
override columns' write path to *also* append to an `ada_overrides`-style log
(both modes benefit), or keep CallScore's separate table for Call only.

### 3.4 Backend placement of the agent pipeline
- **(a) Separate service** (the FastAPI app in this repo), same Railway
  Postgres, writing the shared tables — async queue fits Celery/RQ; Flask app
  untouched.
- **(b) Module inside the Flask app** — one deploy, but the long-running
  audio pipeline sits badly in sync Flask request workers.

### 3.5 Ada memory
FieldScore's Ada has SQLite User/Org memory layers; Bible 4A.4 says Ada
memory *is* the trust record ("no separate Ada memory database"). Needs an
explicit ruling: keep FieldScore's conversational-preference memory (arguably
out of the Bible's scope) and make *interview* memory query the shared tables.

## 4. Frontend (researchos-dashboard)

- Mode choice (Field/Call) goes at the existing start-interview point;
  post-login shell gains Field / Call / InsightScore destinations with
  InsightScore strictly downstream (Bible 1.4).
- `SupervisorQueue.tsx` / `GlanceConfirm.tsx` get rebuilt in the dashboard's
  conventions (axios `api` instance with Bearer interceptor — never plain
  fetch to backend routes; role gating mirrors `Sidebar.tsx`).
- Call review data joins the existing scorecard/leaderboard pages via the
  shared verdict/grade vocabulary (§2 last row).

## 5. Proposed build sequence once decisions land

1. Additive migration on the Railway Postgres (db.py bootstrap style —
   `ADD COLUMN IF NOT EXISTS` on `submissions`; new `respondents`,
   `evidence_artifacts`, `agent_findings`, `sync_queue` tables keyed on
   TEXT `submission_id`).
2. Rewrite this repo's models/routes against that reconciled schema
   (retire `0001_init.sql`'s parallel core tables).
3. Wire pipeline output into `submissions` verdict/grade + `insightscore_outbox`.
4. Frontend mode selection + Call screens in researchos-dashboard.

Nothing in this document has been applied to any live database.
