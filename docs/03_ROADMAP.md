# ResearchOS Roadmap

Priorities, not dates. Each phase should leave the platform more capable and
every future feature easier to build. See [ARCHITECTURE](04_ARCHITECTURE.md) for
the platform spine that makes this possible.

## Phase 0 — Foundation (✅ done)
The core that had to work before anything else.
- Authentication, organisations, users, roles (JWT).
- FieldScore verification engine (GPS, timing, image, audio, duplicate, fraud).
- InsightScore qualitative analysis + report generation (Word / PowerPoint / Excel).
- Dashboard: Overview, Submissions, Detail, Enumerators, Map, Insights, Reports.
- Ada v0 (chat, memory, guidance) and the industry-aware groundwork.
- Kobo pull/import; durable-auth option; security hardening.

## Phase 1 — Platform refactor (⬜ next, in progress)
Turn the application into a platform. **Architecture over features.**
1. Platform foundation — Organization / Workspace / Project / Capability / Role /
   Experience Pack / Navigation / Configuration / Research Capacity as services.
2. Capability Registry — every capability describes itself; UI reads from it.
3. Adaptive navigation — nav generated from licensed capabilities + role + pack.
4. Role-based experiences — different home pages per role, not just hidden buttons.
5. Experience Packs — terminology + defaults per industry.
6. Settings refactor — Organization vs Project; "Research Configuration" with
   Org → Workspace → Project inheritance.
7. Global command palette (⌘K) — searches and (later) executes.
8. Ada 1.0 — intelligence-first; freeze advanced animation.
9. Research Capacity — replace customer-facing AI/token language.
10. Pricing foundation — reusable components, not the finished page.

## Phase 2 — Commercialisation
- Pricing experience assembled from Phase 1 components.
- Settings depth (Research Configuration, Permissions, Capacity, Integration Platform).
- Integrations breadth (more platforms, notifications).
- Permissions model matured across capabilities.
- Research Capacity metering surfaced to customers as Capacity / Impact / Potential.

## Phase 3 — Enterprise
- Enterprise administration, SSO, audit, SLAs.
- Public API + webhooks for customers.
- White-label / multi-brand.
- Research Lab (experimental capabilities, advanced Ada).

## Standing principle
> If there is a choice between a visible feature and better platform
> architecture, choose the architecture. It compounds.
