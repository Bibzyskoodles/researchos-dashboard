# ResearchOS — Implementation Audit (as-built)

**Date:** 2026-07-08
**Scope:** researchos-dashboard (React/TS), fieldscore-backend (Flask), insightscore (FastAPI)
**Method:** direct reading of the actual source. Every claim is what the code *does today*, not the intended design. "NOT IMPLEMENTED" / "STUB" / "DEAD CODE" are used literally.

> **One-paragraph reality check.** ResearchOS today is three loosely-coupled services. The durable system of record for field submissions is a **Google Sheet**. InsightScore is a **separate single-tenant FastAPI app with its own SQLite DB** doing real Whisper transcription and real GPT-4o analysis, emitting Word/PPT/Excel that are **100% generated in code with hardcoded vendor branding and no templates**. Auth, dedup, Ada memory, and Kobo schema caches live in an **ephemeral SQLite file that is wiped on every redeploy unless a Railway volume is mounted**. Multi-tenant isolation is a **feature flag that defaults OFF**, so in the default configuration `/api/*` serves every organisation's data unauthenticated. Billing is real Paystack + a Supabase credit balance; **RIUs and usage metering do not exist in any backend**. A large fraction of the product surface — most of Settings, all of Branding, the Reports page, and most of the new `platform/` spine — is **UI-only mockups or built-but-inert scaffolding**.

---

## 1. InsightScore Workflow

**Current implementation.** A standalone FastAPI service (`insightscore/main.py`) with its own SQLite database. Real Whisper (`whisper-1`) transcription (`transcriber.py`) and a real four-pass GPT-4o analysis (`analyser.py`): per-file coding → theme synthesis/dedup → quote attribution → executive synthesis. Output is a structured JSON report (themes, sentiment, cross-cutting patterns, exec summary, key findings, recommendations).

**User workflow.**
1. `POST /projects` creates a project (`project_title` ≥3 chars, `research_context` ≥20 chars, `num_themes` 3–12, `source`). Row stored in SQLite `projects`, status `pending`.
2. Data enters two ways: **manual upload** (`POST /projects/{id}/upload`, one file per request) or the **FieldScore bridge** (`POST /projects/{id}/ingest`, secured by an `X-Bridge-Key` shared secret).
3. `POST /projects/{id}/analyse` runs the pipeline. Report JSON is stored on the project row.
4. `GET /projects/{id}/report?format=docx|pptx|xlsx` (or no format → JSON) downloads the deliverable.

**Ingestion pipeline — exact answers.**
- **Only from FieldScore?** No — manual upload *and* bridge both exist.
- **Upload types / formats:** `.mp3 .mp4 .m4a .wav .ogg .webm .flac .txt .docx .pdf` (audio, text, DOCX, PDF).
- **Max file size:** 100 MB (hardcoded `main.py:43`; the `config.py` `MAX_FILE_SIZE_MB` env var is **dead code** — never imported).
- **Max files:** 50 per project.
- **Batch upload (many files in one request):** NOT IMPLEMENTED (single `UploadFile`).
- **Folder upload:** NOT IMPLEMENTED. **ZIP upload:** NOT IMPLEMENTED (`.zip` not allowed, no unzip logic). **Raw text-paste:** NOT IMPLEMENTED (text only via `.txt` file or bridge JSON).
- **Multiple uploads to same project:** Yes, while status is `pending`.
- **Analysis reruns automatically on new data:** No. It runs only on explicit `/analyse`. Once analysis starts, status leaves `pending` and further uploads are blocked; there is **no re-analyse endpoint** — analysis is one-shot and non-resumable.
- **Language detection:** Only as a Whisper byproduct for audio (`response.language`); DOCX/PDF/TXT are hardcoded language `"text"`. No standalone detector.
- **Duplicate detection:** Only bridge idempotency by `submission_id`. No content dedup; manual re-upload of the same file creates two records.
- **Transcript storage:** SQLite `project_files.transcript` column. Raw uploaded bytes live in `/tmp/insightscore_{id}` and are deleted after analysis.

**Storage model.** SQLite at `DB_PATH` (default `/data/insightscore.db`), tables `projects` + `project_files`. Persists across deploys **only if `/data` is a mounted Railway volume** — otherwise wiped.

**Technical architecture.** FastAPI, `aiosqlite`, OpenAI (`whisper-1` + `gpt-4o`), python-docx/python-pptx/openpyxl. Audio >25 MB is split by **raw byte offset** (`transcriber.py:74`), which can cut compressed frames mid-stream and degrade boundary transcription.

**Limitations.** No re-analysis; single-file uploads only; no ZIP/folder/batch; O(files) submission recompute on every request; whole file read into memory; extension-only validation (no type sniffing); no pagination.

**Alignment with platform vision.** *Partial.* The analysis engine is genuinely strong and reusable. But it is single-tenant, UUID-gated (no auth, no org), non-resumable, and its ingestion is too thin for enterprise volumes. It needs org scoping, batch/ZIP ingest, and re-analysis before it can be a platform-grade capability.

---

## 2. Branding System

**Current implementation.** NOT IMPLEMENTED as functional. `BrandingSection` (`SettingsPage.tsx:326`) renders a logo dropzone with **no `<input type=file>` and no handler**, colour pickers / font select / footer with `defaultValue` and **no state or onChange**, and template rows whose upload inputs are **not wired**. Nothing is stored anywhere.

**Per asset:**
| Asset | Upload? | Stored? |
|---|---|---|
| Company logo | cosmetic dropzone | No |
| Client logo | — (no client entity) | No |
| Brand colours | cosmetic pickers | No |
| Fonts | cosmetic select | No |
| Word/PPT templates | unwired upload inputs | No |
| Email signatures | — | No |
| Report covers | — | No |
| Watermarks | — | No |

**What exists today.** A single static `/researchos-logo.png` (the *vendor's* logo) hardcoded in the sidebar, login, and pricing page, plus "by Intelligency AI" text. InsightScore's generated reports embed **hardcoded** Intelligency colours (NAVY/TEAL), Arial font, company name, URL and phone — and **no logo image at all**.

**Distance from your goal ("org keeps its own brand; agency brands deliverables per client").** Very far — effectively greenfield. It requires: (a) a **Client** entity (none exists), (b) an asset upload + storage service with endpoints (none exists — no object storage anywhere), (c) a branding data model scoped org-vs-client with inheritance, and (d) making the deliverable generators actually *consume* logo/colour/template parameters (they currently accept only `format`).

**Alignment.** This is one of the largest gaps between vision and reality.

---

## 3. Deliverable Generation

**Current implementation.** All real generation is in **InsightScore `reporter.py`**, triggered from **InsightProjectPage** (the dashboard `ReportsPage` is a pure mockup — its Download buttons have no handlers and call no API).
- **Word:** python-docx, built entirely in code (cover, headings with OOXML rules, dividers, pull-quotes, footer). No `.docx` template file.
- **PowerPoint:** python-pptx on the blank layout, all shapes drawn manually, incl. a native verdict/theme chart. No `.pptx` template.
- **Excel:** openpyxl, four code-built sheets. No `.xlsx` template.

**Where templates come from.** Nowhere — there are **no template files**. Everything is programmatic.

**Can templates be customised / multiple per org / project override?** No, No, No. Branding is hardcoded module constants; the only user inputs that affect a report are `project_title`, `research_context`, `num_themes`, `language_hint`. `?format=` is the only generation parameter.

**What would need to change.** Introduce a template/branding layer the generators read from: a template registry (org-owned, project-overridable), an asset store for logos/covers, and a theming object (colours/fonts/footer) resolved per project/client. The generators would take a resolved `BrandKit` + optional `.docx/.pptx` template instead of hardcoded constants.

**Alignment.** The *engines* are solid and reusable; the *customisation architecture* around them does not exist yet.

---

## 4. Settings

14 tabs (`SettingsPage.tsx`). **Only one control persists to a backend; one persists to localStorage; everything else is local React state or hardcoded constants.**

| Section | Works today | Stored where | Org/Project | Inheritance |
|---|---|---|---|---|
| Organization | Industry select only | localStorage `fs_industry` | — | No |
| Workspace | Cosmetic | — | — | No |
| Users & Teams | Mock table, no handlers | — | — | No |
| Roles & Permissions | Read-only static matrix | — | — | No |
| Branding | Cosmetic (see §2) | — | — | No |
| Integrations (tab) | Fake statuses, no-op | — | — | No |
| AI & Ada | Cosmetic; model badge static | — | — | No |
| Research Defaults | **Cosmetic** (GPS/dup/duration/pass sliders) | — | — | No |
| Data & Storage | Hardcoded usage | — | — | No |
| **Security** | **Change password — REAL** (`POST /auth/change-password`) | backend | user | — |
| Notifications | In-session matrix, no save | — | — | No |
| Billing & Capacity | All mock (`MOCK_BILLING`) | — | — | No |
| API & Webhooks | Fake key, non-functional | — | — | No |
| Audit Log | Hardcoded events | — | — | No |

**Notable:** the settings that would matter most operationally — **Research Defaults** (scoring thresholds) — do not persist at all. No org/project scoping or inheritance exists anywhere in the UI. `platform/types.ts:43` declares a `SettingsSchemaDef.scope: organization|workspace|project`, but no schema is ever registered or read.

**Alignment with the planned Configuration Platform.** The *type* exists; the *implementation* is near-zero. This is a build-from-scratch area (with the resolver spine as the right foundation).

---

## 5. File Storage

| Artifact | Where it lives | Persistence |
|---|---|---|
| Submission **images** | Not stored — only source `Image_URL` in the Sheet; bytes fetched transiently, discarded | Depends on external source (Kobo/Drive) staying reachable |
| Submission **audio** | Not stored — only `Audio_URL`; transcript text kept in `Detail_JSON` | Same |
| Generated **reports** (docx/pptx/xlsx) | Generated on demand by InsightScore, streamed; **not saved server-side** | Ephemeral (regenerated each request) |
| **Logos / branding** | NOT IMPLEMENTED — no storage anywhere | — |
| **Questionnaires** | Generated by OpenAI, returned as JSON; **not persisted** | Lost on reload |
| **Kobo form schemas** | SQLite `form_schemas`, 24h TTL | Ephemeral SQLite |
| Auth (orgs/users), dedup fingerprints, image/audio hashes, back-to-back history | SQLite `/data/fieldscore.db` | **Wiped on redeploy unless `/data` volume mounted** |
| InsightScore projects/transcripts/reports | SQLite `/data/insightscore.db` | Same caveat |

- **SQLite?** Yes (auth, dedup, schema cache; InsightScore projects). **Railway?** Ephemeral filesystem unless a volume is declared — `railway.toml` does **not** declare one. **Temporary?** Uploaded bytes in `/tmp`, deleted post-analysis. **Google Sheets?** Yes — the durable submission store.
- **Media proxy:** `/api/media/<sid>/<kind>` re-fetches the source URL server-side each call and streams it (adds a Kobo token for kobotoolbox hosts, normalises Drive links, 20 MB cap). Nothing is written to disk.
- **After deployment:** Google Sheets survives (external). Everything in `/data/*.db` is lost without a mounted volume — meaning **logins, dedup history and InsightScore projects can vanish on a redeploy**. Supabase fallback (`AUTH_BACKEND=supabase`) exists **only for orgs/users**, not for dedup/hash state or InsightScore.

**What should change.** (1) Mount persistent volumes *now* (or move to Postgres). (2) Introduce real object storage (S3/GCS/R2) for media, generated deliverables, and brand assets — copy media on ingest instead of hot-proxying source URLs. (3) Persist questionnaires. (4) Move the submission system-of-record off Sheets to a database.

---

## 6. Multi-Tenancy

- **Mechanism:** `MULTITENANCY_ENABLED` env flag, **default `false`** (`config.py:100`). Isolation key is a string `Org_ID` column on each Google Sheet row (written as the webhook `client_id`). When on, `/api/*` requires a JWT and filters rows to `Org_ID == token.org` (`api.py:52`).
- **Isolated (only when flag on):** dashboard, submissions list/detail, enumerators, stats, media proxy.
- **NOT isolated:** with the flag off (default) everything is public and unfiltered. `submission_action` is not org-scoped unless the flag is on. **Ada memory, the duplicate store, InsightScore projects, questionnaire generation, and per-project config take no org parameter at all** — they are effectively global across tenants.
- **Identity mismatch:** the JWT `org` (a UUID from the users table) must equal the Sheet `Org_ID` (the webhook `client_id`) for filtering to work — these come from different sources and are never reconciled in code.
- **Risks:** default-open API; prefix-match `sid` lookups (`startswith`) allow ID enumeration/prefix collisions; blank-`Org_ID` rows are global when the flag is off.

**Enterprise-ready?** No. Isolation is opt-in, string-based, Sheet-scoped, and does not cover Ada/dedup/InsightScore. This is the single biggest architectural blocker for enterprise sale.

---

## 7. Research Capacity (Billing / RIU)

- **Billing:** `billing.py` is real but Supabase-backed and only runs when `client_id` + `SUPABASE_URL` are set. It implements an internal cost table, client tiers (trial/standard/premium/enterprise), premium-if-AI-check charge logic, eligibility pre-check + credit deduction via Supabase RPCs, and low-balance/suspend alerts. Its docstring claims "monthly caps" but **no cap code exists here** — enforcement is a Supabase credit balance only.
- **Payments:** `payments.py` is **real Paystack** (live httpx calls, HMAC-SHA512 webhook verification, subscription events). **No Stripe.**
- **RIUs:** **NOT IMPLEMENTED anywhere in the backend.** No usage metering, no per-plan unit quota, no cap enforcement. RIU is purely a frontend pricing concept.
- **Foundations that exist:** org `plan` string + `subscriptions` table + `check_subscription` status gate; the `checks_run` list per submission (a natural basis for a usage meter); the tier rate table. **No counter/metering table exists.**

**Difficulty to migrate to Research Capacity / Impact / Potential.** *Moderate, mostly greenfield.* Because there is no entrenched RIU system to unwind, you can define these as first-class metering dimensions cleanly. Required: a usage-events table (per submission/report/analysis), an aggregation/quota service, and plan definitions expressing capacity in the new units. The billing/Paystack rails already exist to charge against them.

---

## 8. Ada

| Capability | Status |
|---|---|
| **Memory** (user/org/conversation/patterns) | **Works** — real SQLite (`ada_*` tables), recalled and injected into prompts. Persistence caveat (ephemeral `/data`). Cross-tenant **global**, not org-isolated. |
| **Conversation** | **Works** — real GPT-4o `/ada/chat`, history continuity server-side, tool-calling. `/ada/brief` and `/ada/pricing` real with fallbacks. |
| **Commands** | **Works (narrow)** — 3 tools (filter/highlight/navigate) → dispatched to SubmissionsPage + router nav. `SWITCH_PROJECT` declared but unhandled. |
| **Voice input** | **Works** — browser Web Speech API (`en-NG`). |
| **Voice output (TTS)** | **Not implemented.** `/ada/speak` + `/ada/listen` are 501 stubs. |
| **Navigation** | **Works** (router); the "fly between pages" animation is cosmetic. |
| **Notifications** | Real WhatsApp/email exist (`notifications.py`) but are **FieldScore ops alerts, not wired to Ada**. |
| **Industry adaptation** | **Not end-to-end.** Frontend vocab reskins labels, but the dock sends an **empty context** and the backend prompt is hardcoded to field-research framing — industry never reaches Ada's LLM. |

**Dead / decorative code:** `ada/commands.py` (stub, unused), `ada/events.py` (enum+dataclass, no bus, unused), `ada/context.py` (server-side edge math, unused), `ada/personality.py` (imported, never called), and the `AdaStateMachine` (only `force()` is used — the 13-state transition graph is bypassed; the global `_state` is not concurrency-safe).

**Real bugs to flag:** (1) **frontend history rehydration is broken** — `AdaDock` reads `res.data.messages` from `/ada/memory`, which returns `{user, org, patterns}` with no `messages` key, so the dock never repopulates prior conversation. (2) `useAdaGreeting` greetings are **hardcoded fiction** ("2 flagged entries from ENID0010"), not live data. (3) global `_state` collides across users.

**Alignment.** The core (LLM chat + memory + tool commands) is genuinely working and on-vision. The surrounding "intelligence layer" scaffolding is largely dead, and industry-awareness — a headline promise — does not actually reach the model.

---

## 9. Report Customization

Customer control today: **none** for Executive Summary (GPT-generated, no edit endpoint), **none** for colours/charts/logos/headers/footers/layouts (all hardcoded in `reporter.py`), **none** for PPT/Word layouts or Excel sheets. Logos are not even embedded.

**Recommended architecture.**
1. **BrandKit** entity (org-owned, client- and project-overridable): logo(s), colour palette, fonts, footer, cover.
2. **Template registry**: named `.docx`/`.pptx` templates uploaded per org, selectable per project; generators render *into* a template rather than drawing from scratch.
3. **Resolved deliverable context** — reuse the `platform/` resolver pattern: `(org → client → project) → ResolvedBrandKit + ResolvedTemplate`, passed into the InsightScore generators.
4. **Editable exec summary**: persist the report JSON as editable, regenerate the file from edited content.
5. **Asset store** (object storage) underpinning all of the above.

---

## 10. Project Model

**Two disjoint notions of "project":**
- **InsightScore project** — the *only* first-class project entity (id, name, submission_count, status, timestamps) with backend + UI. A project here = a bundle of interviews + one AI report. It carries **none** of: questionnaires, branding, integrations, capacity, timeline, clients, research-stage.
- **FieldScore "project"** — just a `project_id` **string** on a submission. No project list/detail, no project API. Submissions are org-global, filtered by verdict only.

The two never reference each other. "Projects" elsewhere are cosmetic (hardcoded lists in Workspace settings; a hardcoded label in ReportsPage; a toast-stub "save to project" in the questionnaire builder). `ResearchStage` is typed and plumbed but hardcoded `null`.

**What should become project-level objects:** questionnaires, submissions (FieldScore), InsightScore analyses, deliverables, integrations config, branding/BrandKit, capacity allocation, research stage, timeline, and client. Today essentially everything is org-global.

**Alignment.** A unified, first-class **Project** aggregate is missing and is a prerequisite for most of the platform vision (per-project branding, capacity, stage-aware experience).

---

## 11. Data Model (as-built)

**Real, backend-backed entities:** User, Organisation (id/plan/status, from auth), Submission (FieldScore, in Sheets), Enumerator, DashboardStats, InsightProject → InsightSubmission/InsightReport/InsightTheme (InsightScore SQLite), Kobo form schema (SQLite).

**Relationships that actually exist:** User→Org (JWT); Submission→Enumerator (shared `enumerator_id`); InsightProject→its submissions/report (project id); Submission↔InsightScore via the one-way bridge (open-ended text + transcript pushed on PASS).

**Entities with NO type / API / storage (mock-only):** Client, Project (unified), Questionnaire (persistent), Report (dashboard), Deliverable, Integration (as an entity), Settings, Branding, Template, Capacity, Role assignment, AuditEvent.

**Text ER sketch of reality:**
```
Organisation ──< User            (auth DB: SQLite or Supabase)
Organisation ··< Submission      (via Org_ID string in Google Sheets; weak, flag-gated)
Submission ──> Enumerator        (shared id string)
Submission ··> InsightProject    (one-way bridge, PASS only)
InsightProject ──< InsightSubmission ──> InsightReport   (InsightScore SQLite)
Ada memory / dedup / schema cache : global, NOT linked to Organisation
Billing/Client (Supabase) : keyed by client_id, NOT reconciled with JWT org
```
The dotted lines are the fragile joins; the whole model has **no single relational spine** — it's spread across Sheets, two SQLite DBs, and Supabase with string keys that don't reconcile.

---

## 12. Security

**Authentication.** Hand-rolled HS256 JWT (`auth.py`), **insecure hardcoded default secret** (`"fieldscore-dev-secret-change-in-production"`), **no hard failure** on default (only a log warning) — forgeable admin tokens. 24h expiry, **no refresh, no revocation** (logout is client-side).

**Passwords.** PBKDF2-HMAC-SHA256, 100k iterations, salted, constant-time verify — acceptable. **But admin `create-client` returns and logs the plaintext password.**

**Authorization.** `ROLE_PERMISSIONS`/`can()` exist but are **never called** — a `viewer` token is identical to `admin` at every endpoint. No endpoint role enforcement.

**File access / media proxy.** Unauthenticated when the multitenancy flag is off; `startswith` sid matching. **SSRF: `media.download_media` fetches any http(s) URL with no host allowlist**, and the URL originates from webhook payloads that are unauthenticated when `WEBHOOK_SECRET` is unset — a classic stored-SSRF path (e.g. cloud metadata endpoints).

**Organisation isolation.** Flag-gated, default off (see §6).

**Rate limiting.** Only login (5/60s) and questionnaire (20/60s), both **in-memory per-process** (ineffective across the 2 gunicorn workers and across restarts) and header-spoofable.

**API security / CORS.** Credentialed CORS with wildcard `https://*.vercel.app` — any Vercel subdomain can make credentialed calls. `/webhook`, `/batch`, `/detect` gated only by a non-constant-time `WEBHOOK_SECRET` compare, fully open when unset. `/health` exposes storage backend, DB path, and org/user counts unauthenticated.

**Prioritised concerns (most serious first):**
1. Default multitenancy OFF → all tenant data served unauthenticated.
2. Forgeable JWTs via hardcoded default secret with no hard-fail.
3. SSRF in the media proxy (no allowlist, attacker-influenceable stored URLs).
4. Webhooks/batch/detect open when `WEBHOOK_SECRET` unset; non-constant-time compare when set.
5. `submission_action` not org-scoped unless the flag is on.
6. Role permissions defined but never enforced.
7. Admin endpoint returns/logs plaintext passwords.
8. `startswith` submission-ID matching (enumeration/collision).
9. In-memory, spoofable rate limiting.
10. Credentialed wildcard CORS.
11. Ada memory + dedup store are cross-tenant global.

---

## 13. Enterprise Readiness (Ipsos / Kantar / NielsenIQ / WHO / UNICEF / World Bank)

If sold tomorrow, these would fail procurement/security review. Address in this order:

1. **Tenant isolation as a hard invariant, not a flag.** Enforce org scoping at the data layer for *every* surface (submissions, media, Ada, dedup, InsightScore, questionnaires). Remove the default-open path. *Blocker.*
2. **Secrets & auth hardening.** Fail-closed on missing/default `JWT_SECRET`; add refresh + revocation; enforce roles (`can()`); stop returning/logging plaintext passwords; constant-time secret compares. *Blocker.*
3. **Durable, relational persistence.** Move submissions off Google Sheets and auth/dedup/InsightScore off ephemeral SQLite to a managed Postgres with backups. Mount volumes immediately as a stopgap. *Blocker for data-retention/SLA commitments.*
4. **Object storage + data residency.** Real storage for media, deliverables, and brand assets; region controls (WHO/UNICEF/World Bank will demand residency + retention + deletion guarantees). Close the SSRF.
5. **Auditability & compliance.** A real (not mock) immutable audit log, access logging, DPA-grade data handling, SSO/SAML (typed but unbuilt).
6. **Multi-tenant Ada.** Partition memory/patterns by org; industry context actually reaching the model.
7. **Unified Project aggregate + branding/BrandKit** so agencies can deliver per-client branded outputs (a core requirement for Ipsos/Kantar/Nielsen agency use).
8. **Scale & resilience.** Shared caches/rate-limits (Redis), background job queue for imports/analysis (currently synchronous), pagination, quota metering.

---

## 14. Hidden Capabilities

Things already in the code that the product doesn't surface — often high-leverage:

- **The `platform/` resolver spine is built but ~90% inert.** `resolveExperience` already computes licensing (`requiredLicense` per capability), customer-type gating, permission gating, research-stage gating, dashboard cards, and a terminology `t()` — but only `navigation` is consumed. Supplying real context (org plan, role, stage) unlocks adaptive navigation, licensing, and role/stage dashboards **with no new engine work**.
- **Experience Packs (7 industries, full vocab)** exist and are wired to a `t()` function that no page calls yet. Industry-adaptive copy is a config change away.
- **Per-project config with zero-code extensibility** — `config_loader.py` reads a Google Sheet "Projects" tab into a typed `ProjectConfig` where unknown columns fall into `extras{}`. New per-project knobs can be added by adding a column, no deploy.
- **Full Paystack billing + subscription lifecycle** (`payments.py`, `billing.py`) is built and real, with **no UI** — the Billing settings tab is entirely mock. Monetisation rails already exist.
- **Real WhatsApp + email notifications** (`notifications.py`) are wired to scoring/billing but exposed nowhere in the UI and not connected to Ada — a ready alerting channel.
- **Unused but live backend endpoints:** `dashboardApi.getStats`, `insightScoreApi.createProject`, `adaApi.getState`, `adaApi.learn` (explicit "teach Ada" memory API) — all callable, no UI.
- **Perceptual image-dedup tolerance** — `hashes_are_similar()` (Hamming distance) exists but is never called; image dedup is exact-match only. Near-duplicate fraud detection is one wiring change away.
- **InsightScore native charts** (python-pptx column/bar charts) already render — richer report visuals are available without new libraries.
- **Kobo pull-import** (`/kobo/import`) is a working on-demand ingestion path, lightly surfaced.
- **AuthContext already holds the real Organisation object** (plan/status) that Settings ignores in favour of mock data — wiring real org data into Settings is trivial.

---

## Prioritised architectural improvements (before building new features)

**P0 — correctness & trust (do first):**
1. Enforce tenant isolation at the data layer everywhere; remove the default-open API path.
2. Fail-closed secrets, enforce roles, add token revocation, stop leaking plaintext passwords, close the media-proxy SSRF.
3. Mount persistent volumes now; plan the migration of submissions + auth/dedup/InsightScore to managed Postgres.

**P1 — the platform spine (highest leverage, partly built):**
4. Supply real context to `resolveExperience` (org plan → licensing, role, research stage) — activates adaptive nav, licensing, role/stage dashboards already coded.
5. Introduce the unified **Project** aggregate and make submissions/questionnaires/analyses/deliverables/branding project-scoped.
6. Persist questionnaires and settings (starting with Research Defaults) via real APIs with org/project inheritance.

**P2 — deliverables & brand (your stated goal):**
7. Client entity + BrandKit + template registry; make InsightScore generators consume resolved brand/template; object storage for assets and generated files.

**P3 — Ada & metering:**
8. Org-partition Ada memory; feed industry/context into the prompt; fix the history-rehydration bug; delete the dead scaffolding (`commands.py`, `events.py`, `context.py`, `personality.py`) or implement it.
9. Add a usage-metering table and define Research Capacity/Impact/Potential on top of the existing Paystack rails.

**Guardrail:** none of the above requires rewriting the working cores (scoring engines, InsightScore analysis, Ada chat/memory, Paystack). The work is isolation, persistence, and wiring the resolver — not re-engineering the engines.
