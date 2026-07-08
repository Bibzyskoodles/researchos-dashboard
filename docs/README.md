# ResearchOS — Source of Truth

This directory is the canonical documentation for ResearchOS by Intelligency AI.
Nothing gets built without aligning to it. If code and these documents disagree,
the documents are the intent and the code is the bug — fix one or the other,
deliberately.

## The documents

| # | Document | What it is | Audience |
|---|----------|-----------|----------|
| 00 | [MANIFESTO](00_MANIFESTO.md) | Why we exist. Read before writing a line of code. | Everyone |
| 01 | [PRODUCT_BIBLE](01_PRODUCT_BIBLE.md) | The constitution — vision, principles, architecture, all of it. | Everyone |
| 02 | [PRODUCT_STATUS](02_PRODUCT_STATUS.md) | What exists, what's partial, what's planned. Read first as an engineer. | Engineering |
| 03 | [ROADMAP](03_ROADMAP.md) | Phased priorities. | Product / Eng |
| 04 | [ARCHITECTURE](04_ARCHITECTURE.md) | Pure engineering — services, data, infra, the platform spine. | Engineering |
| 05 | [API_REFERENCE](05_API_REFERENCE.md) | Endpoints across the services. | Engineering |
| 06 | [SECURITY](06_SECURITY.md) | Security philosophy + operational checklist. | Engineering / Ops |
| 07 | [PRICING_AND_LICENSING](07_PRICING_AND_LICENSING.md) | Plans, capabilities, licensing model. | Product / Sales |
| 08 | [ADA_BIBLE](08_ADA_BIBLE.md) | The Intelligence Layer — what Ada is and isn't. | Everyone |
| 09 | [DESIGN_SYSTEM](09_DESIGN_SYSTEM.md) | Tokens, components, UX principles. | Design / Eng |
| 10 | [CHANGELOG](10_CHANGELOG.md) | Every release, forever. | Everyone |
| 11 | [DECISIONS](11_DECISIONS.md) | Every major architectural decision and **why**. | Engineering |
| 13 | [IMPLEMENTATION_AUDIT](13_IMPLEMENTATION_AUDIT.md) | As-built engineering review — exactly what the code does today, `file:line` grounded. | Engineering |
| 14 | [PHASE_2_BRIEF](14_PHASE_2_BRIEF.md) | The Phase 2 implementation brief — Engineering Mandate + 3-phase plan (Trust → Domain Model & Brand → Platform Experience). | Engineering / Product |

## Status legend (used throughout)
- ✅ **Live** — in production on `main`.
- 🟡 **Partial** — exists but incomplete or behind a flag.
- ⬜ **Planned** — designed, not built.

## Maturity note
The Manifesto, Status, Roadmap, Architecture, Ada Bible and Changelog are written
to be used today. The Product Bible and the deeper references (API, Pricing,
Design) are structured skeletons that grow with the product — each section is
real, and marked where it needs expansion. They are living documents, not a
one-time deliverable.
