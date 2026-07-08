# Changelog

All notable changes to ResearchOS. Newest first. This grows forever.

## [Unreleased] — Platform foundation begins
- Established the source-of-truth documentation set (`/docs`).
- Phase 1 platform refactor planned — capability registry, experience-pack
  resolver, adaptive navigation, role experiences (see
  [ARCHITECTURE](04_ARCHITECTURE.md), [ROADMAP](03_ROADMAP.md)).

## [0.9.0] — Stabilise, extend, brand, harden
Large body of work bringing ResearchOS to a demoable, deployable state.

### Fixed
- **Scoring engine crash** — restored helper functions a prior cleanup deleted;
  `score_submission()` no longer raises `NameError` on every submission (this was
  the root cause of the blank dashboard).

### Added — verification & data
- Media evidence proxy (`/api/media/...`), report read-cache, sheet tab-name fix,
  GPS accuracy, zone status, `Detail_JSON` for the detail view.
- Multi-tenancy (org-scoped API, `MULTITENANCY_ENABLED`), `Org_ID` on submissions.
- Approve/Reject/Flag write endpoint + UI.
- Back-to-back interview detection.
- KoboToolbox pull/import (`/kobo/ping|preview|import`) + Integrations UI.
- Demo seed script.

### Added — analysis & delivery
- InsightScore PowerPoint + Excel report generation; unified `?format=` endpoint.
- Report download buttons (Word / PowerPoint / Excel).

### Added — product & platform
- Questionnaire Intelligence (endpoint + builder page).
- IndustryContext (7 sectors) — terminology + labels adapt.
- Topbar search / notifications / project switcher; 30s real-time polling.
- Billing & Capacity view; public pricing page.
- Ada: pulse ring, command bus, voice input (plus existing memory / nav-exit /
  guidance).
- Change Password, `aiConfig`, mobile fixes, `tokens.ts` + `components/ui/`.

### Added — reliability & security
- Durable auth backend option (Supabase, `AUTH_BACKEND`) + `/health` diagnostics.
- Security hardening: startup warnings, questionnaire auth + rate-limit, action
  auth. `SECURITY.md`, `PERSISTENCE.md`.

### Branding
- ResearchOS rebrand across the app; real logo; favicon from the "OS" globe.
