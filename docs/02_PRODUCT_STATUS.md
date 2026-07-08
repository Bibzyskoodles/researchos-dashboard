# ResearchOS — Product Status

What exists today, what's partial, what's planned. Organised around **how
customers think** — the research lifecycle — not around our page structure.

```
Design → Collect → Verify → Analyse → Deliver → Manage
```

Legend: ✅ Live · 🟡 Partial · ⬜ Planned

---

## The platform is adaptive (this is the headline, not a footnote)
ResearchOS reshapes itself to the organisation:
- **Different industries** see different terminology, metrics, and defaults
  (respondents / beneficiaries / citizens / consumers / patients / students).
- **Different roles** (planned) get different home pages and dashboards.
- **Different capabilities** (planned) mean different navigation.

Same engine underneath; different experience on top. See
[ARCHITECTURE](04_ARCHITECTURE.md) for the resolution pipeline that powers this.
Today: industry adaptation is ✅ live (terminology + labels via Experience-Pack
groundwork). Role- and capability-driven adaptation is ⬜ the Phase 1 refactor.

---

## Design
- 🟡 **Questionnaire intelligence** — Ada drafts a structured survey from a brief
  (purpose, respondents, sector, length, method); questions are editable,
  reorderable, exportable (JSON today; XLSForm planned). *Live end-to-end; export
  breadth to grow.*

## Collect
- ✅ **Multi-platform intake** — KoboToolbox, SurveyCTO, ODK, CommCare, CSPro,
  generic; auto-detected and normalised.
- ✅ **Push** (a webhook per organisation) and ✅ **Pull** (fetch + score a Kobo
  form on demand, with a connection test).

## Verify — FieldScore
- ✅ **Per-submission scoring** across engines: GPS (valid, accuracy, assigned
  zone), timing (duration + impossible back-to-back), image (AI vision), audio
  (transcription + genuine-interview), duplicate (submission / image / audio).
- ✅ Weighted score → grade (A–F) → verdict (PASS/FLAG/REJECT) → recommended
  action, with plain-English flags.
- ✅ Evidence served through an authenticated media proxy.
- ✅ Supervisor **Approve / Reject / Flag** actions.

## Analyse — InsightScore
- ✅ Ingest verified submissions (or manual transcripts/audio), transcribe,
  analyse → themes, quotes, sentiment, cross-cutting patterns, recommendations.

## Deliver
- ✅ **Reports in three formats** — Word, PowerPoint, Excel.
- 🟡 Dashboards & real-time — Overview and Submissions refresh live; role-specific
  executive dashboards are ⬜ Phase 1.

## Manage
- ✅ **Organisations, users, roles** (JWT auth).
- 🟡 **Multi-tenancy** — org isolation on the API, behind a flag (`MULTITENANCY_ENABLED`).
- ✅ **Settings** (to be reorganised in Phase 1 → **Research Configuration**,
  **Permissions**, **Capacity**, **Integration Platform**; with
  Organization → Workspace → Project inheritance).
- ✅ **Billing & Capacity** view; ⬜ full pricing experience.
- ✅ Durable auth option (Supabase) + health/persistence diagnostics.
- ✅ Security hardening (auth on cost/write endpoints, startup warnings).

---

## The Intelligence Layer — Ada
Ada is **not** "an AI analyst." Ada is the **ResearchOS Intelligence Layer** — the
platform's context made conversational. See [ADA_BIBLE](08_ADA_BIBLE.md).
- ✅ Chat, voice input, cross-session memory, on-screen guidance.
- ✅ Commands that adjust the UI ("show only flagged", "go to reports").
- ✅ Industry-aware language.
- ⬜ Role-aware recommendations, research summaries, notification intelligence (Ada 1.0).

---

## Research Capacity (naming)
Customer-facing, there are **no RIUs, credits, or token counts**. Everything is
expressed as **Research Capacity**, **Research Impact**, and **Research
Potential**. Internally we may still meter tokens; that language never reaches the
customer. Migration of remaining "RIU" copy is ⬜ Phase 1.

---

## Known trade-offs (documented, not hidden)
- Media proxy is intentionally public (browsers can't auth `<img>`/`<audio>`);
  production fix is short-lived signed URLs.
- `/api/*` reads are public until `MULTITENANCY_ENABLED=true`.
- Auth storage is SQLite by default (ephemeral without a volume); Supabase is the
  durable option. See [SECURITY](06_SECURITY.md).
