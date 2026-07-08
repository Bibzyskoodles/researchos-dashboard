# ResearchOS — Pricing & Licensing

## Principle
We price **completed research work**, not compute. Customer-facing language is
**Research Capacity / Research Impact / Research Potential** — never credits,
tokens, or compute units. (Internally we may still meter tokens; that never
reaches the customer.)

## Licensing model
**Capability-based.** A plan unlocks capabilities (FieldScore, InsightScore,
Questionnaire, Reports, …); the [Capability Registry](04_ARCHITECTURE.md) marks
each with a `requiredLicense`, and navigation adapts to what's licensed. A
FieldScore-only customer never sees InsightScore in the sidebar.

## Plans (current shape — to finalise)
| Plan | For |
|------|-----|
| Starter | Small teams, focused studies |
| Professional | Active teams, multiple projects (most popular) |
| Enterprise | Large-scale / continuous research; SSO, SLA, API, white-label |

Capacity per plan is expressed as completed work (verifications, interviews
analysed, reports, presentations, questionnaires) — not units of AI.

## Pricing experience (Phase 1 → 2)
Phase 1 builds **reusable components**, not the finished page: organization
selector, capability selector, research-volume sliders, live recommendation
engine, capacity preview cards, ROI calculator, and an Ada recommendation panel.
Phase 2 assembles them into the pricing experience.

*(To expand: final price points, currency handling, billing operations,
contracts, and the customer-facing capacity/impact/potential definitions.)*
