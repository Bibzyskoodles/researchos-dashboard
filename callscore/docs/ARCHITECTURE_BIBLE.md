# CallScore Architecture Bible
### The AI Operating Layer for Remote Research Interview Integrity

**Version:** 1.0 — Founding Specification
**Owner:** Intelligency AI & Automation
**Governing principle:** *Design for Version 10. Build Version 1.*

This document is the single source of truth for what CallScore is, why it exists, and how it is built. Every engineering decision should be traceable back to a section in this Bible. If a decision isn't here, it isn't settled — raise it before building around it.

---

## PART 1 — VISION & POSITIONING

### 1.1 Mission

CallScore reviews 100% of remote research interviews for integrity, compliance, and quality — a task human supervisors can currently only sample. It is the AI supervisor sitting beside every enumerator, on every call, regardless of what platform the call happens on.

### 1.2 What CallScore Is Not

- Not a calling app. It never places, manages, or intercepts calls.
- Not a WhatsApp/VoIP integration. It is communication-agnostic by design — Zoom, Teams, GSM, WhatsApp, Signal, Telegram, or anything invented later all work identically because CallScore never depends on any of them.
- Not a call recorder. Recording is a means; verified integrity is the product.
- Not a CATI platform. It doesn't manage sampling, dialing, or respondent databases — it verifies the interviews that happen, however they're conducted.

### 1.3 Platform Positioning — One App, Two Capture Modes

**Revision:** FieldScore and CallScore are not two products a user chooses between at the account level. They are **two capture modes inside one application.** The enumerator opens one app, selects a respondent, and picks **Field** or **Call** as the mode for that specific interview. One login, one project, one enumerator identity, one interview history — the mode is a per-interview choice, not a separate product boundary.

This matters concretely, not just narratively:
- **Shared shell:** project setup, respondent lists, enumerator assignment, supervisor dashboards, and the enumerator trust record are one system, not two synced systems.
- **Different capture engines underneath:** Field mode uses GPS/image/in-person audio capture; Call mode uses the two-device/companion-app/BLE architecture (Part 6). These stay cleanly separated as distinct engines — this is "one app, two capture engines," not one flow that awkwardly branches to handle both.
- **One InsightScore handoff:** verified interviews from either mode flow into InsightScore identically. InsightScore doesn't know or care which mode produced the data — only that it passed verification.

| Layer | Field mode | Call mode | Shared |
|---|---|---|---|
| Capture | GPS, images, in-person audio | Companion app, BLE call-state, screenshot OCR | — |
| Consent | In-person consent capture | Remote consent capture (Part 7) | Same consent evidence schema |
| AI agents | FieldScore's existing fraud/quality agents | CallScore's Tier 0–4 agents (Part 4, 4A) | Same evidence/scorecard shape |
| Identity | — | — | One `enumerators` table, one trust record |
| Output | — | — | One InsightScore handoff format |

### 1.4 Platform Entry Flow

The user-facing shape of the "one app, two capture modes" idea (1.3) is a signup/navigation flow, not just a backend data model:

1. **Sign up / log in** — one account, one organization, regardless of which module(s) they'll use.
2. **Choose a module** — Field or Call — as the entry point into the work. This is presented as a top-level choice (e.g., a landing screen after login: "Field" / "Call"), not buried inside project setup. A user working a single project may use both over time; the choice is about which module they're entering *right now*, not a permanent account-level setting.
3. **Work inside that module** — the Field or Call capture flow proceeds exactly as specified in Part 2 (workflow) and Part 6 (device/connectivity architecture) for that mode.
4. **Verified data flows to InsightScore automatically** — once interviews are captured and scored in either module, the user can move into InsightScore to analyze the now-verified dataset. This should feel like a natural next step in one product ("your data's ready — see what it tells you"), not a handoff to a separate tool requiring a new login or export step.

**Design implication:** the top-level navigation shell (post-login) has three destinations — Field, Call, InsightScore — but only two of them are data *capture* entry points. InsightScore is always the downstream destination, never a peer users "choose" instead of capturing data. Don't design a symmetric three-way switcher that implies InsightScore is an alternative to Field/Call; it's what both feed into.

This flow is the reference for both the FieldScore reconciliation work (see `CLAUDE.md`) and any Call-mode-specific frontend routing built in this repo — the Call module's own screens (`SupervisorQueue.tsx`, `GlanceConfirm.tsx`) sit *inside* the Call destination, not as a separate app with its own top-level login.

### 1.5 Competitive Position

The nearest existing capability is SurveyCTO's "audio audit" feature — randomly-sampled recording clips, reviewed manually. No incumbent runs native, end-to-end AI analysis over 100% of remote interview audio. Real-world teams are already duct-taping this together with SurveyCTO + WhatsApp + Gmail + AssemblyAI + Gemini scripts (observed in the wild). CallScore's job is to be the native, defensible, offline-first version of what people are currently hacking together.

Online-panel fraud tools (Zamplia, Kantar Qubed, ReDem, Research Defender) are **not competitors** — they solve bot/click-farm detection for self-administered online surveys, an entirely different problem from human-conducted phone/WhatsApp interviews.

### 1.6 One-Line Pitch

**"CallScore is the AI supervisor sitting beside every remote interview — reviewing 100% of the work a human team could only ever sample."**

---

## PART 2 — THE OPERATING WORKFLOW

### 2.1 Roles

- **Research Manager** — creates projects, imports respondents and questionnaires, assigns interviews
- **Enumerator** — conducts interviews, operates CallScore during the call
- **Supervisor** — reviews the risk-ranked queue, performs back-checks, acts on flags
- **QA Officer** — monitors project-wide quality, trains enumerators
- **Country Director / Admin** — portfolio-level visibility across projects

### 2.2 The Two-Device Model

| Device | Role | Runs |
|---|---|---|
| **Device 1** | Places the call (WhatsApp, GSM, Zoom, etc.) | CallScore Link (companion app) |
| **Device 2** | Questionnaire + AI copilot | CallScore (main app) |

A single-device mode also exists for platforms with native plugin integration (Section 2.4) where no companion app is needed at all.

### 2.3 Interview Session Lifecycle

1. Enumerator opens CallScore on Device 2, selects the assigned respondent.
2. Enumerator reads the consent script verbatim (localized). Consent is recorded as its own standalone evidence artifact.
3. Enumerator presses **Start Interview** — a deliberate, non-automated action. This is the anchor timestamp for the entire evidence chain.
4. CallScore begins: audio capture, questionnaire display, AI copilot listening, compliance monitoring.
5. Enumerator places the actual call on Device 1, using whatever platform is normal for them.
6. Device 1's companion app (or native OS call-state APIs) detects call-in-progress and reports state to Device 2 over BLE.
7. Enumerator takes a screenshot of the call screen (showing respondent number/name) and attaches it via the companion app.
8. AI copilot listens throughout: pre-fills answers from speech, flags skipped questions, surfaces gentle clarification nudges.
9. Enumerator presses **Stop Interview** — second deliberate anchor timestamp.
10. CallScore packages the full evidence bundle (audio, consent recording, BLE call-state log, screenshot-derived fields, questionnaire responses) under one interview session ID.
11. If online: bundle uploads immediately, AI agent pipeline runs, scores generate. If offline: bundle queues locally, marked "Pending sync," uploads and processes once connectivity returns.
12. Verified interview data flows automatically into InsightScore for analysis.

### 2.4 Two Integration Modes

**Mode A — Embedded plugin (preferred long-term):** CallScore ships as an SDK inside KoboToolbox, SurveyCTO, ODK, CommCare. Audio/consent capture triggers automatically when the form session opens. No separate app on Device 2.

**Mode B — Standalone app (MVP default, universal fallback):** Full CallScore app on Device 2 for organizations without plugin support, or using custom in-house tools.

Both modes write to the identical backend schema and produce the identical evidence format.

---

## PART 3 — CORE DESIGN PRINCIPLES (Non-Negotiable)

These are the rules every engineering decision must respect. If a feature request conflicts with one of these, the Bible wins until formally revised.

1. **No score without evidence.** Every conclusion the AI reaches must point to a specific, timestamped piece of evidence. If Evidence Generation can't cite something concrete, the output routes to human review — it never guesses and presents a bare number.
2. **Consent is a hard gate, not a checkbox.** No consent capture, no analysis. This is enforced in code, not policy.
3. **Deliberate human action at trust-critical moments.** Start/Stop Interview, consent recording, and screenshot attachment are never automated away — they are the anchors that make the audit trail defensible to an auditor or ethics board.
4. **Communication-agnostic, forever.** No code path may depend on a specific calling platform's API, protocol, or behavior. If WhatsApp disappears tomorrow, CallScore requires zero architectural changes.
5. **Offline-first, not offline-tolerant.** The full interview flow — start, capture, track, stop, evidence bundle — must work with zero connectivity. Sync and AI processing happen whenever connectivity returns, never as a requirement of conducting the interview.
6. **Minimum viable permission.** Every OS-level permission requested must have a specific, named justification in this document. No notification-listener-style broad permissions, ever — the trust and Play-Store/App-Store risk isn't worth what they'd save.
7. **Enumerator cognitive load is a metric, not an afterthought.** Every new feature must be evaluated against: does this add a manual step, or remove one?
8. **Undisclosed signal rotation for fraud-relevant scoring.** Enumerators should never be able to fully reverse-engineer what triggers a fraud flag — pair automated detection with randomized human back-checks so gaming the AI isn't a viable strategy.

---

## PART 4 — AI ARCHITECTURE

### 4.1 Why Multiple Agents, Not One Prompt

A single large prompt trying to do transcription, compliance, fraud detection, and scoring in one pass is unauditable and impossible to improve incrementally. Each agent below is an independently versioned service with a narrow job and a structured, evidence-bearing output.

### 4.2 Agent Roster

**Tier 1 — Perception** (operate directly on raw audio)
| Agent | Job | Output |
|---|---|---|
| Transcription & Diarization | Speech-to-text, separates enumerator vs respondent, handles code-switching | Timestamped transcript with speaker labels |
| Audio Quality | Flags noise, cross-talk, unusable segments before downstream processing | Quality score + flagged time ranges |

**Tier 2 — Analysis** (operate on transcript + questionnaire)
| Agent | Job | Output |
|---|---|---|
| Question Compliance | Confirms every required question was asked, in substance | Per-question asked/not-asked + evidence timestamp |
| Answer Consistency | Compares spoken answers to submitted questionnaire values | Match/mismatch per field + evidence |
| Behaviour Analysis | Pacing, interviewer dominance, rushed segments | Behaviour score + flagged segments |
| Respondent Engagement | Hesitation, confusion, coaching indicators, third-party voices | Engagement score + flagged segments |
| Conversation Naturalness | Scripted/rehearsed vs genuine exchange | Naturalness score |

**Tier 3 — Cross-Interview** (operate across an enumerator's or project's full dataset)
| Agent | Job | Output |
|---|---|---|
| Similarity & Fabrication | Near-duplicate transcript detection across interviews | Similarity score vs. flagged prior interviews |
| Pattern Fraud | Benford's-law numeric checks, response-time clustering, timing anomalies across an enumerator's portfolio | Portfolio-level risk flags |
| Enumerator Voice Fingerprint | Confirms assigned enumerator conducted the interview | Match/mismatch + confidence |

**Tier 4 — Synthesis**
| Agent | Job | Output |
|---|---|---|
| Evidence Generation | Compiles all upstream flags into one human-readable evidence packet | Structured evidence bundle |
| Risk & Recommendation | Produces final scores + specific supervisor action | Final interview scorecard |

**Rule:** Synthesis agents never introduce a conclusion not sourced from an upstream agent. This keeps "explainable AI" literally true rather than a marketing claim.

### 4.3 Orchestration

- Each agent is a versioned microservice (or versioned function within a queue-based worker), never a single monolithic prompt.
- Pipeline runs as an async job queue: audio ingestion → Tier 1 → Tier 2 (parallel where possible) → Tier 3 (batched, run against interview history) → Tier 4.
- Failure isolation: if one Tier 2 agent fails, others still complete; the interview routes to "partial analysis — needs review" rather than silently dropping.

### 4.4 Scoring Output (per interview)

```json
{
  "interview_id": "uuid",
  "overall_quality_score": 0-100,
  "authenticity_score": 0-100,
  "compliance_score": 0-100,
  "behaviour_score": 0-100,
  "fraud_risk": "low | medium | high",
  "confidence_level": 0-100,
  "evidence": [
    {
      "type": "missing_question | answer_mismatch | pacing | similarity | device_state_discrepancy | respondent_mismatch",
      "description": "string",
      "timestamp_range": ["00:12:03", "00:12:45"],
      "confidence": 0-100
    }
  ],
  "recommended_action": "none | review_recording | conduct_backcheck | escalate"
}
```

### 4.5 Real-Time Signals (during the interview, not post-hoc)

Surfaced only to the enumerator, framed as coaching, never fraud-adjacent:
- Question skipped or answered before being asked
- Pace significantly faster than project median
- Prolonged respondent silence
- Audio quality degrading below usable threshold

Fraud-relevant signals are never surfaced live to the enumerator — supervisor-side only, and partially undisclosed/rotating per Design Principle 8.

### 4.6 Unified Enumerator Trust Record (Long-Term Moat)

A single enumerator identity schema shared across FieldScore and CallScore from day one — not bolted on later. Each interview (in-person or remote) contributes to one portfolio-level trust signal per enumerator. This is the seed of a portable "enumerator passport" queryable across projects and eventually across employers. Architect the `enumerator_id` and evidence schema in Part 5 to support this from the first migration, even though the cross-product query layer itself is a V2+ feature.

---

## PART 5 — DATA ARCHITECTURE

### 5.1 Core Entities (ERD in prose)

- **Organization** → has many **Projects**
- **Project** → has one **Questionnaire** (imported XLSForm), many **Respondents**, many **Enumerators** (assigned)
- **Enumerator** → global identity shared with FieldScore, has many **InterviewSessions** across both products
- **Respondent** → belongs to a Project, has contact info (number/name — sensitive, encrypted at rest)
- **InterviewSession** → the core unit: one Start/Stop cycle, one evidence bundle, one scorecard
- **EvidenceArtifact** → audio file, consent recording, BLE call-state log, screenshot-derived fields (never the raw screenshot) — all tagged to one InterviewSession
- **Scorecard** → the Tier 4 output, one per InterviewSession
- **AgentFinding** → individual structured outputs from each Tier 1-3 agent, the raw material Evidence Generation compiles from

### 5.2 Schema Sketch (Postgres)

See `backend/migrations/0001_init.sql` for the runnable version. Key tables:

```
organizations, projects, questionnaires, respondents,
enumerators, interview_sessions, evidence_artifacts,
agent_findings, scorecards, sync_queue
```

### 5.3 Sync Queue Design

`sync_queue` table exists specifically for offline-first operation: every InterviewSession created offline is written locally (SQLite on-device) and mirrored into a `sync_queue` row on the backend only once uploaded. Upload is idempotent — keyed on `interview_session_id` (client-generated UUID), so retried/interrupted uploads never duplicate a session.

### 5.4 Data Residency

Schema and deployment must support per-country hosting configuration from the outset (Postgres instance selection by `organization.region`). Retrofitting this later is expensive and a World Bank/UNICEF procurement blocker if absent.

---

## PART 6 — DEVICE & CONNECTIVITY ARCHITECTURE

### 6.1 Device 1 — CallScore Link (Companion App)

Single-purpose, minimal-permission app:
- **Call-state detection:** iOS uses `CXCallObserver` (CallKit); Android combines `AudioManager.getMode() == MODE_IN_COMMUNICATION` (catches VoIP apps generically) with `TelephonyManager` call state (catches native GSM calls specifically).
- **Screenshot attach:** manual, one-tap — enumerator screenshots the call screen themselves, then attaches via the companion app's photo picker. Never automated screen capture (Accessibility Service / ReplayKit are both explicitly rejected — see 6.3).
- **On-device OCR:** Apple Vision / Android ML Kit, template-matched to known call-screen layouts (WhatsApp, native Phone UI) to auto-crop to just the relevant banner region.
- **Immediate discard:** only extracted structured fields (number, name, duration) are kept or transmitted. The raw screenshot image is deleted from memory immediately after extraction — never stored, never uploaded.

### 6.2 Device 1 → Device 2 Communication

Priority order:
1. **Bluetooth Low Energy (BLE)** — default. Paired once at project setup. Works fully offline. Only small structured messages pass over it (call start/end timestamps, number-match result, duration).
2. **Local WiFi** — fallback when BLE pairing/range is unreliable.
3. **Cloud relay (shared session ID)** — last resort for devices not physically co-located; requires both devices to have their own connectivity, which defeats the offline-first goal, so this is explicitly the weakest supported path.

### 6.3 Explicitly Rejected Approaches (and why — don't re-litigate without new information)

- **Android Accessibility Service for automated screen capture** — against Play Store policy for non-accessibility use, flagged as spyware-like by mobile security tooling. Rejected.
- **iOS ReplayKit for automated screen recording** — shows a persistent, unremovable red recording indicator; not actually stealthy, and still requires manual start. Not worth the complexity over a manual screenshot. Rejected.
- **Direct WhatsApp/VoIP call interception** — technically unreliable, and violates the communication-agnostic principle outright. Rejected at the outset of this project.
- **Notification-listener-based call detection (Android)** — requires a broad permission that reads all device notifications, not just calls. Privacy cost too high for the marginal signal gained. Rejected.

### 6.4 Offline Operation

Full interview flow works with zero connectivity:
- Device 2: local audio capture, local questionnaire, local session timestamps, local consent recording — all functional offline.
- Device 1: call-state detection and OCR both run fully on-device.
- BLE pairing requires no internet by design.
- **Transcription/AI analysis is deferred, not attempted on-device** for the MVP — audio and all evidence artifacts are captured and stored locally in full; the interview shows as "Pending analysis" until connectivity returns and the evidence bundle uploads.
- Local storage cap warnings surface to the enumerator ("storage getting full, prioritize syncing soon") rather than silently failing.

### 6.5 The Late-Start / Early-Stop Edge Case

If an enumerator begins the actual conversation before pressing Start, or the call continues after Stop is pressed, this must be a named, designed state — not an undocumented gap:
- Compare BLE-reported call-state timestamps against CallScore's own Start/Stop timestamps.
- Discrepancy beyond a defined threshold → **"Late-start" or "Early-stop" flag**, routed to supervisor review with a partial-trust scorecard rather than a full or null score.

---

## PART 7 — CONSENT & COMPLIANCE

- Consent script is localized per country/language and read verbatim by the enumerator, displayed in-app so wording can't drift.
- Consent is recorded as its own standalone, independently reviewable evidence artifact — separate from the interview recording itself.
- Consent capture is a hard technical gate: no consent artifact, no downstream processing occurs. Enforced in the session state machine, not by policy alone.
- Jurisdictional consent flow configuration (e.g., Nigeria's NDPR and equivalents elsewhere) lives in project configuration, not hardcoded.
- Optional respondent-facing plain-language disclosure statement, generated per project, for organizations needing extra IRB-facing defensibility.

---

## PART 8 — USER EXPERIENCE PHILOSOPHY

### 8.1 First Principles

If AI had existed from the start of remote interviewing, the enumerator's job would not be "ask, then type." It would be "have the conversation; the software listens and fills itself in." Data entry as a distinct task should disappear.

### 8.2 What's Fully Automated
Question-tracking, answer pre-fill from speech, evidence compilation, scoring, review-queue ranking, report generation.

### 8.3 What's AI-Assisted, Never Fully Automated
Clarification nudges (quiet, glanceable, never interrupting), real-time pace/tone coaching signals, anything touching sensitive/judgment-laden answers (AI drafts, human confirms).

### 8.4 What Stays Deliberately Human
The conversation itself. The consent moment. The Start/Stop action. These are the trust anchors — automating them away would blur exactly the boundary the whole evidence model depends on.

### 8.5 The Glance-Confirm Screen (Most Important Screen in the Product)

When CallScore pre-fills an answer from speech, the confirm/edit view must be near-instant (sub-second render) or enumerators will stop trusting it and revert to manual typing, defeating the entire value proposition. Confidence must be visually distinguished: clearly-heard answers show settled/filled; uncertain or ambiguous ones are visually flagged "please confirm" rather than silently guessed. Silent wrong guesses are the single worst failure mode for a product whose entire pitch is trustworthy data.

### 8.6 Supervisor Experience — Push, Not Pull

Supervisors receive a ranked daily list ("here's what needs you today"), not a dashboard to browse. Every pushed item includes a one-line "why now" (e.g., "40% shorter than this enumerator's average") so the queue is immediately actionable, not just a list of numbers.

### 8.7 Setup Experience

Manager imports an XLSForm questionnaire; CallScore auto-derives compliance rules (required questions, skip logic) from the form structure itself. Setup should feel like uploading a file, not configuring software.

---

## PART 9 — SECURITY & PRIVACY

- Audio and evidence artifacts encrypted at rest and in transit.
- Raw screenshots never leave Device 1 and are never stored server-side — only OCR-extracted structured fields sync.
- Respondent PII (phone numbers, names) encrypted at rest, access-scoped by project role.
- Minimum viable permissions on both apps, each justified against Design Principle 6 (Part 3).
- Data residency configurable per organization/region (Part 5.4).
- Audit logging on every access to raw audio or respondent PII — who viewed what, when.

---

## PART 10 — ROADMAP

**MVP (Mode B — standalone, single integration)**
- Standalone Device 2 app, single-language transcription, core compliance + consistency agents.
- Basic risk-ranked review queue.
- Manual screenshot attach + OCR, no companion app yet — enumerator attaches screenshot directly within the main CallScore app as an interim step.
- Cloud-only processing (offline queuing exists, but companion-app/BLE pairing ships in V1).

**V1**
- CallScore Link companion app + BLE pairing.
- Full offline-first flow (Part 6.4).
- Fraud pattern agents (Tier 3).
- Single-product enumerator trust score.
- One platform plugin integration (KoboToolbox first).

**V2**
- Multi-platform plugin integrations (SurveyCTO, ODK, CommCare).
- Unified enumerator trust record across FieldScore + CallScore.
- Real-time supervisor alerts.

**V3**
- Enumerator passport as a standalone, queryable cross-organization product.

---

## PART 4A — ADA: THE AI CHIEF RESEARCH OFFICER

### 4A.1 What Ada Is

Ada is not a 13th pipeline agent. She is the **interface layer sitting on top of the entire agent pipeline** — the consistent voice, memory, and communication style through which Tier 0/2/3/4 outputs reach humans. Where Part 4's agents produce structured findings, Ada is how those findings are *experienced*: as a colleague, not a dashboard.

Concretely, Ada is composed of:
- **Tier 0 — Questionnaire Design Agent** (new — see 4A.2)
- **Tiers 1–3** — unchanged, exactly as specified in Part 4.2
- **Tier 4 (Synthesis)** — unchanged in function, but its output is rendered through the Ada Voice Layer (4A.3) rather than as a bare JSON scorecard
- **The Unified Enumerator Trust Record** — Ada's institutional memory (4A.4), which the roadmap must pull forward (see 4A.5)

### 4A.2 Tier 0 — Questionnaire Design Agent (New)

Runs before fieldwork begins, against the imported XLSForm. Flags:
- Ambiguous wording, double-barrelled questions, leading questions
- Inconsistent skip logic
- Missing or incomplete consent language
- Translation concerns
- Questionnaire fatigue risk (length, repetition)

Output feeds the Research Manager during project setup (Part 8.7), before a single interview happens. This agent has no fraud/scoring role — it's a design-quality reviewer, and its findings never touch an interview's scorecard.

### 4A.3 The Ada Voice Layer — Confidence Language Is Generated, Not Authored

**This is a hard rule, not a style guideline.** Ada's signature communication trait — distinguishing "I know" / "I suspect" / "I recommend checking" — must be mechanically derived from `confidence_level` and `fraud_risk` on the scorecard (Part 4.4), never freely written by a language model and merely hoped to match the underlying evidence strength.

```
confidence_level >= 90        -> "I know" register (direct, declarative)
confidence_level 60-89        -> "I suspect" register (hedged, names the evidence)
confidence_level < 60          -> "I recommend checking" register (never asserts, only flags)
```

A prompting instruction alone is not sufficient enforcement — this mapping must be implemented as a deterministic function the voice layer calls, so a confident-sounding sentence can never be generated from weak evidence. See `backend/app/services/ada_voice.py`.

### 4A.4 Ada's Memory — Same Schema as the Unified Trust Record

Ada's "I noticed this last month" / "this enumerator has improved" capability is not a new memory system — it *is* the Unified Enumerator Trust Record from Part 4.6, queried and surfaced conversationally. There is no separate "Ada memory" database. Institutional memory means: querying `enumerators`, `interview_sessions`, and `scorecards` across time and across both FieldScore and CallScore, through one identity schema.

### 4A.5 Roadmap Correction

Part 10 originally deferred the Unified Enumerator Trust Record to V2. **Revise: the shared `enumerator_id` schema and cross-session history query must exist from MVP**, even if the cross-*product* (FieldScore+CallScore) query layer stays a V2 feature. Ada's core personality promise — memory, noticing patterns over time — doesn't work at all if enumerator history isn't queryable from day one. This is a schema decision, not a feature decision, and it's already reflected in `backend/migrations/0001_init.sql` (the `enumerators` table is deliberately global, not per-project).

### 4A.6 Accountability & Audit Logging (Blind Spot Fix)

"Ada advises, humans decide" is the correct accountability model, but it is incomplete without an explicit audit trail: **every time a human approves an interview against a supervisor-facing recommendation to escalate or back-check, or rejects one Ada scored as low-risk, that override must be logged** — who, when, and why (free-text reason required, not optional). Without this, an organization cannot answer "why was this fraudulent interview approved" during an external audit. See `backend/migrations/0002_ada_overrides.sql`.

### 4A.7 Ada's Presence

Ambient, not persistent chrome. During an active interview she is silent unless a real-time signal (Part 4.5) warrants a coaching nudge. Post-interview and in supervisor/manager contexts, she speaks in the register defined by 4A.3, at whatever length the finding warrants — one sentence for a clean interview, a full evidence narrative for a high-risk one. Never a fixed-length report template.

---

## PART 11 — KNOWN RISKS (Track Honestly, Don't Hide)

- Room/companion-audio quality (echo, cross-talk) is a real, unsolved engineering problem, not assumed-solved.
- Transcription accuracy on Nigerian Pidgin and code-switched Yoruba/Igbo/Hausa-English is a named technical risk *and* the platform's best available moat — deserves dedicated evaluation, not default Whisper.
- Two-app-install onboarding cost is real friction in low-connectivity field conditions; the architecture is correct but adoption still has to be earned in practice.
- Plugin integration timelines depend on cooperation from KoboToolbox/SurveyCTO/ODK teams — not fully within Intelligency's control.
- Real-time enumerator-facing signals must stay coaching-only; anything fraud-adjacent shown live risks an adversarial dynamic (Design Principle 8 exists specifically to guard against this).

---

*This Bible is a living document. Revisions must be explicit — if a design principle in Part 3 needs to change, say so directly rather than drifting around it in code.*
