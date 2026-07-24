# CLAUDE.md — Instructions for Claude Code

You are picking up the CallScore repository at the scaffolding stage. Read this whole file before touching any code.

## Read first, in this order

1. `docs/ARCHITECTURE_BIBLE.md` — the single source of truth. Every decision below traces back to a specific part of this document. If you're unsure whether something is in scope or how it should behave, check here before guessing.
2. `backend/migrations/0001_init.sql` and `0002_ada_overrides.sql` — the actual schema. Don't invent new tables that duplicate what's here without checking first.
3. `backend/app/agents/` — every agent is stubbed with a `NotImplementedError` and a docstring citing the Bible section it implements. Implement them in the order given in "Build order" below, not randomly.

## ⚠️ Read this before writing a single line of code

**This repository is scaffolding for the Call capture engine, not a finished, mergeable product.** It was built as a standalone repo before a scope decision was made to fold it into the existing FieldScore application as a second capture mode (see Bible Part 1.3). That decision changes what "done" means here, and it means you cannot proceed on assumptions this repo makes about being its own product.

**You do not have FieldScore's actual codebase in front of you right now unless someone has explicitly given it to you** — as a second folder in this workspace, a second repo cloned alongside this one, or pasted context. Claude Code has no memory of other sessions or other repositories. If FieldScore's real code isn't visible to you in this working directory, **stop and ask the person to provide it** (repo path, zip, or `git clone` access) before building anything that assumes you know its structure. Do not guess at FieldScore's schema, routes, or frontend conventions from this document's description of them — the description here is secondhand and may be stale.

### What's known about FieldScore (secondhand, verify against the real repo before trusting it)

- Frontend: React/TypeScript, deployed on Vercel, repo name `researchos-dashboard`
- Backend: Python Flask, deployed on Railway, repo name `fieldscore-backend`
- A Supabase/Postgres schema exists for FieldScore but, as of the last check, the live dashboard was still running off Google Sheets rather than that schema — meaning the "existing schema" you find in the FieldScore repo may itself be partially unwired, not a settled ground truth. Confirm current state directly rather than assuming either this note or this repo's own schema is authoritative.

### Reconciliation, not replacement

Once you have both codebases visible:
1. **Read FieldScore's actual database schema first** (migrations, Supabase schema, or Google Sheets structure — whichever is actually live). Do **not** apply `backend/migrations/0001_init.sql` / `0002_ada_overrides.sql` from this repo as-is if FieldScore already has `enumerators`, `projects`, `interview_sessions`-equivalent tables under different names. Reconcile the two schemas into one — this repo's tables are a proposal for the Call-mode-specific additions (evidence_artifacts, agent_findings, scorecards, sync_queue, ada_overrides), not a parallel set of core tables.
2. **`enumerators` must be a single shared table.** If FieldScore already has an enumerator/user table, extend it (add whatever Call-mode-specific columns are needed) rather than creating a second one. This is the whole point of the unified trust record (Bible Part 4.6, 4A.5) — it breaks entirely if there end up being two enumerator identities to reconcile later.
3. **`projects` and `respondents` likewise** — Call mode is a capture option on an existing project/respondent, not a new project type. If FieldScore's project model doesn't yet have a concept of "collection mode per interview," add a `collection_mode` field (`'field' | 'call'`) to whatever FieldScore calls its interview/submission entity, rather than standing up a separate `interview_sessions` table that duplicates it.
4. **Frontend integration**: the mode selection (Field vs Call) belongs at the point where an enumerator currently starts an interview in the existing FieldScore UI — add it there as a choice, don't build a separate app shell. `SupervisorQueue.tsx` and `GlanceConfirm.tsx` in this repo are reference implementations of the *Call-mode-specific* screens; they should be added into FieldScore's existing frontend structure and conventions (component patterns, routing, state management) rather than dropped in as-is.
5. **Backend integration**: the Tier 0–4 agent pipeline (`backend/app/agents/`) and Ada voice layer (`backend/app/services/ada_voice.py`) are Call-mode-specific and can likely be added as a new module inside FieldScore's existing Flask backend (or its own service if FieldScore's backend is Flask and a separate Python service is cleaner for the queue-based agent pipeline — check what's actually easiest given FieldScore's real deployment setup before deciding).

If you reach a point where reconciling this repo's assumptions against FieldScore's real code requires a judgment call with real consequences (e.g., renaming a live production table, changing a schema Ipsos-facing work already depends on), **stop and ask rather than deciding unilaterally.** Get this wrong and it risks breaking a system that's already in active enterprise sales.

---

## Platform context — read this before anything else

CallScore is not a standalone product. It is one of three surfaces of a single Intelligency AI & Automation platform, alongside:

- **FieldScore** — verifies in-person/face-to-face fieldwork (already built, in active enterprise sales, separate repo)
- **InsightScore** — analyzes verified data (quantitative, qualitative, mixed-methods, report generation; separate repo, already deployed)

This matters concretely, not just narratively:
- The `enumerators` table in this repo is deliberately **global identity, not CallScore-specific** — it's designed to eventually be shared with FieldScore under one enumerator trust record (Bible Part 4.6, 4A.4–4A.5). Don't refactor it to be CallScore-scoped.
- Verified CallScore interviews are meant to flow into InsightScore automatically (Bible Part 11 integration notes) — when building export/handoff logic, assume InsightScore is the consumer, not a generic CSV export target.
- Naming, schema conventions, and evidence-format decisions in this repo should stay consistent with FieldScore's existing conventions where possible (React/TypeScript frontend, Python/Flask-or-FastAPI backend, Postgres/Supabase), since the long-term goal is one coherent platform, not three unrelated codebases that happen to share a company name.

Full positioning is in `docs/ARCHITECTURE_BIBLE.md` Part 1.3 — read it, don't just take this summary at face value.

## What this repo is

CallScore: an AI-powered remote research interview integrity platform. It is **communication-agnostic** (never integrates with WhatsApp/Zoom/phone APIs directly — Bible Part 3, Design Principle 4) and **offline-first** (Bible Part 6.4). It verifies interviews conducted over any remote channel by capturing room/companion audio with consent, running a multi-agent AI pipeline over it, and producing evidence-backed integrity scores — voiced through a persona called **Ada** (Bible Part 4A), the AI Chief Research Officer.

## Non-negotiable design principles (Bible Part 3) — do not violate these while building

1. No score without evidence — every AgentFinding must have something concrete behind it, or route to human review instead of guessing.
2. Consent is a hard gate in code, not a UI checkbox — enforced in `routes/interviews.py::create_interview_session`, already stubbed this way. Keep it that way.
3. Start/Stop Interview, consent capture, and screenshot attach stay manual, deliberate human actions. Do not "improve UX" by automating these away.
4. Never write code that depends on a specific calling platform's API or protocol.
5. Every feature must work fully offline before it's considered done. If you're implementing something that requires connectivity, check whether it belongs in the "sync when online" path instead.
6. Don't request broad OS permissions (e.g. notification listeners, Accessibility Service for screen capture) — see Bible Part 6.3 for what was explicitly rejected and why. Don't re-propose these.
7. **Ada's confidence language is generated from `confidence_level`, never freely authored.** `backend/app/services/ada_voice.py::register_for_confidence()` is the enforcement point — any LLM call that renders Ada's natural-language output must pass through `build_ada_utterance()` and respect `REGISTER_PROMPT_FRAMING`. Do not let a model choose its own hedging language.

## Build order (recommended)

Work bottom-up from the schema, not top-down from the UI:

1. **SQLAlchemy models** in `backend/app/models/` matching `0001_init.sql` and `0002_ada_overrides.sql` exactly. Nothing exists here yet — this unblocks everything else.
2. **Alembic setup** in `backend/migrations/` (currently raw SQL files — wire these into Alembic so future schema changes are versioned properly).
3. **`routes/projects.py::import_questionnaire`** — XLSForm parsing via `pyxform`, populating `questionnaire_items` including derived `is_required` and `skip_logic`. This unblocks the Tier 0 agent and the Question Compliance agent.
4. **Tier 0 agent** (`agents/questionnaire_design.py`) — runs against the parsed questionnaire, feeds the Research Manager at setup time. Not part of the per-interview pipeline.
5. **`routes/interviews.py`** — fill in the `TODO`s for session create/stop, including the late-start/early-stop discrepancy check (Bible Part 6.5) using `device1_call_started_at` / `device1_call_ended_at`.
6. **Tier 1 agents** (`audio_quality.py`, `transcription_diarization.py`) — these gate everything downstream. Get transcription/diarization working before building Tier 2, and treat language coverage (Nigerian Pidgin, code-switched Yoruba/Igbo/Hausa-English) as a first-class evaluation criterion, not an afterthought — see Bible Part 11.
7. **Tier 2 agents** — can be built in parallel with each other once Tier 1 output (a structured transcript) has a stable shape.
8. **Tier 3 agents** — these need `context['prior_interviews']`; build the query layer for enumerator/project interview history before these, since it's shared with the trust record work in step 10.
9. **Tier 4 agents + Ada Voice Layer** — wire `risk_recommendation.py` output through `ada_voice.py`. Do not let this step skip the register-enforcement rule above.
10. **Unified Enumerator Trust Record queries** — the `enumerators` table is already global (not per-project) specifically so this works. Build the cross-session history query now, at MVP, per Bible Part 4A.5 — this was originally deferred to V2 in the roadmap and that was corrected; don't defer it again.
11. **Frontend**: `SupervisorQueue.tsx` and `GlanceConfirm.tsx` are stubbed as the two most important screens (Bible Part 8.5, 8.6) — they live *inside* the Call module destination, not as a separate app. The top-level post-login navigation shell needs three destinations (Field, Call, InsightScore) per Bible Part 1.4, where InsightScore is always the downstream destination fed by whichever module captured data — never a peer users pick instead of capturing data. Build the module-selection landing screen and the API client before building anything deeper in either module.
12. **CallScore Link (companion app)** and **BLE pairing protocol** — this is a separate mobile codebase (not yet scaffolded here) implementing Bible Part 6.1–6.2. Ask before assuming a target platform/framework (React Native? Native Android+iOS separately?) if it isn't specified elsewhere in this repo by the time you reach this step.

## What NOT to build yet

- Real-time supervisor alerts (V2, Bible Part 10)
- Multi-platform plugin integrations beyond one (V1/V2 — MVP is standalone app only, Bible Part 2.4 Mode B)
- Cross-*product* (FieldScore+CallScore) trust record queries — the schema should support this, but the query layer is V2

## When you're unsure

Prefer checking `docs/ARCHITECTURE_BIBLE.md` over guessing. If something genuinely isn't decided there, say so explicitly rather than silently picking an approach — this repo has a track record (visible in the Bible's own revision notes, e.g. Part 4A.5) of catching and correcting scope decisions in writing, and that habit should continue in code review, not just in planning docs.
