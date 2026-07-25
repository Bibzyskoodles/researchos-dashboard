# Intelligency Platform Constitution

This is the governing document set for the platform. Every engineering
decision, design choice, and product direction traces back to something
in these documents.

## Structure

| # | Document | Status | Purpose |
|---|----------|--------|---------|
| 00 | [Philosophy](./00_philosophy.md) | **Live** | Why we exist. Core principles. The test every feature must pass. |
| 01 | [Product Architecture](./01_product_architecture.md) | **Live** | One platform, three engines. Collection modes, shared systems, data flow. |
| 02 | Design System | Planned | Typography, spacing, color, components, animations, dark mode. |
| 03 | Brand Standards | Planned | Voice, tone, naming conventions, visual identity. |
| 04 | [Ada](./04_ada.md) | **Live** | Ada's character, registers, confidence language, visual identity, implementation rules. |
| 05 | Security | Planned | Zero trust, encryption, PII handling, audit trail, compliance (GDPR, NDPR, SOC 2). |
| 06 | Engineering Standards | Planned | Code standards, repository structure, testing, CI/CD, review process. |
| 07 | API Standards | Planned | Versioning, authentication, error handling, rate limiting, pagination. |
| 08 | Database Standards | Planned | Schema conventions, migrations, multi-tenancy, data residency. |
| 09 | AI Standards | Planned | Confidence model, agent pipeline, hallucination prevention, evidence requirements. |
| 10 | Performance | Planned | Bundle budgets, render budgets, API latency targets, caching strategy. |
| 11 | Accessibility | Planned | WCAG targets, keyboard navigation, screen reader support, color contrast. |
| 12 | Quality Assurance | Planned | Testing strategy, verification workflow, release process. |
| 13 | Deployment | Planned | Infrastructure, environments, monitoring, incident response. |

## How this grows

Documents move from Planned to Live when they contain at least one
real decision that has been implemented. Empty aspirational documents
are worse than no documents — they create the illusion of governance
without the substance.

Each document earns its content from real engineering decisions. When
a choice is made (e.g., "button radius is 12px, permanently"), it gets
recorded in the relevant document. Over time, each document becomes
the accumulated wisdom of every decision in its domain.

## For Claude Code

CLAUDE.md at the repository root is the entry point. It points here.
Every Claude Code session should consult the relevant constitution
documents before making architectural decisions. If a requested
implementation conflicts with a principle documented here, the conflict
should be surfaced before proceeding.
