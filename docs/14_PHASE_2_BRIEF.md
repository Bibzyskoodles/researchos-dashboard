# ResearchOS — Phase 2 Implementation Brief

**For:** Claude Code, acting as Lead Software Architect of ResearchOS.
**Baseline:** `docs/13_IMPLEMENTATION_AUDIT.md` (the as-built truth). Do **not** re-audit or re-summarize it. Treat it as the starting state.
**Also read first:** `docs/11_DECISIONS.md` (ADRs), `docs/04_ARCHITECTURE.md`, and the **"Already Done" ledger** in §2 below — so you do not rebuild work that exists.

---

## 0. Engineering Mandate (read this first)

You are not a contract developer executing tickets. You are the **Lead Software Architect and long-term technical co-founder** of ResearchOS. Your job is a platform that is still clean, scalable, secure and maintainable five years from now.

- **Challenge us.** Do not assume every idea in this brief is the best solution. If you see a more elegant, scalable, secure or maintainable approach that preserves the product vision, explain your reasoning and implement *that* instead. Constructive disagreement is expected. Surface trade-offs, risks, and technical debt *before* implementing.
- **Do not duplicate existing work.** Before building anything, check the codebase, the docs, and the audit to see whether it already exists fully or partially. Extend, refactor, and consolidate — do not create parallel APIs, services, components, or config systems. Remove obsolete code when you replace it.
- **Work in iterations.** Do not attempt the whole brief in one pass. For each phase: state what you'll build and why it's the right priority, name the architectural risks, implement, verify existing functionality still works, run the build, and fix every error/warning before moving on. Every phase must leave the platform production-ready.
- **Protect the platform.** Optimize for maintainability, extensibility, readability, performance, security, testability, enterprise scalability. Favor simple, well-designed abstractions over cleverness. Avoid short-term fixes that create long-term debt.
- **Product first.** If a requested implementation conflicts with the long-term direction, pause and explain why before proceeding. Optimize for a better product, not more code.
- **Success =** requested capability delivered · existing functionality intact · platform *simpler* than before · tech debt reduced · docs updated · CI green (zero warnings, zero errors) · architecture stronger than when you started.

When in doubt, prioritize architectural integrity over feature velocity.

---

## 1. What this phase is (and isn't)

We have proven **engines** — FieldScore scoring, InsightScore transcription + 4-pass analysis, report generation, questionnaire generation, Ada (GPT-4o chat/memory/tools), Paystack billing. They work. **This phase does not build more engines.** It builds the **platform** that lets them work together as one Research Operating System: identity, tenancy, the domain model (Client → Project), branding, configuration, storage, and enterprise-grade trust.

Backward compatibility is mandatory. CI must pass with zero errors at every phase boundary.

---

## 2. Already Done — do NOT redo (state as of 2026-07-08)

These shipped to `main` since the audit. Extend them; do not rebuild them.

**Security (P0):**
- **JWT fail-closed** — `auth.py` refuses to boot on the default secret (`ALLOW_INSECURE_JWT=true` is the local-dev escape hatch). A real `JWT_SECRET` is set in prod.
- **`/api/*` auth required** — `api.py` `_require_org` now demands a valid login on every read (401 otherwise). Org **filtering** is still decoupled behind `MULTITENANCY_ENABLED` (single-tenant today). Media proxy stays **soft-auth** by necessity (`<img>`/`<audio>` can't send a bearer token — this is the signed-URL gap, see Phase 2A).
- **Media-proxy SSRF partially closed** — `media.py` `_is_safe_url()` blocks non-http(s) and any host resolving to private/loopback/link-local/reserved IPs. *Still needed:* a positive host **allowlist** + MIME validation.
- **Constant-time secret compares** — webhook + admin secrets use `hmac.compare_digest`.
- **Admin create-client** does not log the password (it returns it to the admin who set it; leave or redesign as you see fit).

**Platform spine (P1):**
- **Resolver is live** — `src/platform/` (`resolveExperience`, Capability Registry, Experience Packs). The Sidebar renders **resolved** navigation (no hardcoded nav).
- **Plan-based licensing** — `PlatformProvider` feeds real `role` + `org.plan`; `capabilitiesForPlan()` gates by `requiredLicense` (trial/unknown/enterprise/professional = full; only `starter` gated). ADR-011.
- **Industry-adaptive terminology** — nav + Enumerators/Overview pages re-skin via the resolver `t()` / Experience Packs (Field Officers / Merchandisers / Health Workers …). `labelKey` mechanism on nav items.
- **Real org in Settings** — Organization section reads `AuthContext` (name + plan/status badges), not mock data.

**Infra (founder-side):** `/data` volumes mounted on both services (persistence fixed); `JWT_SECRET` set.

**Still dead/inert (safe to delete or wire, your call):** `ada/commands.py`, `ada/events.py`, `ada/context.py`, `ada/personality.py`, the `AdaStateMachine` transition graph (only `force()` used), `database.py` unused Supabase submission model, `gps_engine.py` stub, `hashes_are_similar()` (perceptual dedup tolerance, never called). The resolver's `dashboardCards` registry is empty (declared, unconsumed).

---

## 3. Architectural decisions to honor (founder + architect)

These override the audit's phrasing where they differ.

1. **Keep Google Sheets — as the transparency layer, not the source of truth.** Early customers (NGOs) live in Sheets; supervisors already understand it. **Move the system of record to Postgres, and treat Sheets as a projection.**
   - **Architect's refinement (challenge accepted):** make the sync **one-way — Postgres → Sheets (read-only projection/export)**, *not* bidirectional. Two-way sync between a DB and a spreadsheet is a well-known consistency nightmare (conflicting edits, ordering, deletes). If supervisors must act in the product, they act via the app (which writes Postgres, which projects to Sheets). If a customer genuinely needs to edit in Sheets, treat that as a separate, explicit import job — never an ambient two-way merge. Document this as an ADR.

2. **Add the `Client` entity.** Organization → **Client** → Project → Deliverable. Agencies (Ipsos) serve many clients (Nestlé). Without Client, branding and projects can't be organized. This is a first-class entity, org-scoped.

3. **Brand resolution is a hierarchy, resolved like the experience is:** `ResearchOS default → Organization brand → Client brand → Project overrides → Deliverable template`. Reuse the resolver *pattern* (a pure `resolveBrand(context) → ResolvedBrandKit`) — do not invent a second config system. Deliverable generators consume the resolved BrandKit; **no hardcoded branding** remains in `reporter.py`.

4. **Media/asset access needs signed URLs.** The `<img>`/`<audio>` bearer-token problem means true org-scoping of media requires short-lived signed URLs (or a token query param), not header auth. Design this in Phase 2A; it's the honest fix for the soft-auth media gap.

5. **Don't over-build Research Capacity before revenue (ADR-010).** Build the **metering + allocation data model and a read model**, not a full billing engine. Paystack rails already exist. Capacity/Impact/Potential are naming + aggregation on top of a usage-events table — keep it thin until it's earning.

6. **Defer InsightScore standalone enhancements** (ZIP/folder/batch/re-analysis) out of this sprint (founder's call). They should plug into first-class Projects, Brand Studio, and Configuration once those exist — building them first would mean rework. Note it in the roadmap; don't build it now.

---

## 4. The three phases

Ship in this order. Each is one coherent architectural milestone. Do **not** start the next until the current one is green and verified.

### Phase 2A — Trust & Data Integrity (the enterprise blockers)
*Nothing else matters if this isn't solid. This is what turns a pilot into a sale.*

- **Authorization:** wire the existing `ROLE_PERMISSIONS`/`can()` into every protected endpoint. Viewer / Manager / Admin (/ Super Admin) get genuinely different access. No endpoint should skip the check.
- **Sessions:** refresh tokens + revocation/blacklist; short-lived access tokens. (Access is currently a 24h non-revocable HS256.)
- **Tenant isolation — make it real, not a flag.** Put a durable `org_id` on every record (Postgres), backfill/reconcile the existing Sheet `Org_ID` ↔ JWT `org` mismatch the audit flagged, and org-scope **every** surface: API, Ada memory/patterns, InsightScore projects, media, reporting, configuration, dedup. Then flip isolation to mandatory. **Reconcile before you enforce**, or dashboards blank.
- **Signed media URLs** (see §3.4) so media can be org-scoped despite `<img>` tags.
- **SSRF:** upgrade the IP-range block to a positive **host allowlist** + MIME validation.
- **Rate limiting:** replace the in-memory dicts with shared storage (Redis) so it survives multiple workers/restarts and horizontal scale.
- **Data integrity:** stand up **Postgres as the system of record**, with the **one-way projection to Sheets** (§3.1). Migrate auth/orgs/users off ephemeral SQLite first (Supabase path already exists), then submissions. Keep the Sheets view identical for customers.
- **Object storage foundation** (S3/GCS/R2): the substrate Brand Studio and Deliverable Studio need. Signed URLs, retention/deletion policies, versioning. Wire media + generated deliverables to copy into it rather than hot-proxying source URLs.

### Phase 2B — The Domain Model & Brand Studio
*The structural spine. Client and Project are what everything else hangs off; Brand Studio is the first thing that consumes them.*

- **Client entity** — org-scoped; an org has many clients; a client has contact info + a brand.
- **First-class Projects** — a Project is an aggregate that *owns*: overview, timeline, **Research Stage** (Planning → Questionnaire → Pilot → Fieldwork → Verification → Analysis → Reporting → Presentation → Completed), questionnaire, FieldScore submissions, InsightScore analyses, deliverables, capacity allocation, team, activity, **branding**, **client**, **configuration**, audit. Migrate the existing InsightScore "project" and the FieldScore `project_id` string into this single model — do not leave two disjoint notions.
- **Research Configuration** (replaces "Research Defaults") — org-level settings (GPS, timing, dedup, image/audio rules, AI behavior, languages, retention, quality thresholds, fraud sensitivity) that **Projects inherit and can override**. This is the same inheritance shape as branding; build one inheritance primitive and reuse it.
- **Brand Studio** — the org→client→project→deliverable brand hierarchy (§3.3), backed by object storage: Organization brand (logo, colors, fonts, website, email footer), Client brand (logo, colors, fonts, brand guide, templates, cover, watermark, contacts), Project overrides. Deliverable generators (`reporter.py` Word/PPT/Excel) consume the resolved `BrandKit` — **remove all hardcoded Intelligency branding**.
- **AI brand-guide extraction** (delighter — build *last* in 2B, only after the hierarchy works): upload a brand PDF → Ada extracts colors/fonts/logo rules/spacing/presentation style → proposes a Brand Studio config the user confirms. Do not build the magic before the plumbing.

### Phase 2C — Platform Experience
*Once the model and trust exist, make the surfaces first-class.*

- **Deliverable Studio** — editable reports (exec summary, themes, recommendations, charts, tables, quotes, branding) with version history + templates, then export. Persist the report JSON as editable; regenerate files from edits.
- **Research Capacity** — metering + allocation data model (org/project/department), renewals, limits; Capacity/Impact/Potential as the customer-facing framing. Thin, per §3.5.
- **Integration Platform** — per-integration status/health/diagnostics/sync-history/logs/reconnect; Ada explains failures in business language. Consolidate the two inconsistent integrations lists into one real source.
- **Notification Center** — research/fraud/analysis/report/capacity/security/integration events; also surfaced through Ada. Wire to the existing `notifications.py`.
- **Activity Timeline** — org/project/user activity feed (imports, analysis, reports, approvals, logins, config changes, deliverables, capacity, integrations).
- **Settings reorg + global search** across all sections.
- **Expand the resolver** — consume `dashboardCards` (role/stage-aware home), extend terminology, wire research stage into Ada.
- **Ada 2.0** — richer project/client/branding/configuration/stage context in her prompt; org-partitioned memory; fix the history-rehydration path; delete or implement the dead Ada scaffolding.

*(InsightScore standalone ingestion — ZIP/folder/batch/re-analysis — is intentionally out of this sprint; schedule after 2B/2C.)*

---

## 5. Design principles (non-negotiable)

No hardcoded: branding · navigation · terminology · templates · reports · organizations · dashboards · experience packs. **Prefer configuration over code.** One inheritance primitive (org → client → project) reused for brand and configuration. One resolver pattern reused for experience and brand. One storage abstraction for all assets.

---

## 6. How to deliver

For the phase you're on: updated architecture notes + ADRs, DB migrations, backend, frontend, docs, migration notes, tests, **zero build errors, zero regression**. Verify existing functionality end-to-end before declaring a phase done. Keep the changelog current.

The platform should feel less like separate products and more like a unified **Research Operating System**.
