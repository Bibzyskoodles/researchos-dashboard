# The ResearchOS Bible

The constitution. Nothing gets built without aligning to it. This is a **living
document** — each section below is real intent; several are outlines to be
expanded as the platform matures. When in doubt, the [MANIFESTO](00_MANIFESTO.md)
wins.

---

## 1. Vision
ResearchOS is an **Operating System for Research**: one platform that takes an
organisation from research design, through collection and verification, to
analysis and delivery — adapting to who they are at every step. The engine is
shared; the experience is theirs.

## 2. Philosophy
- We sell **completed research work**, not compute.
- We measure **impact**, not usage.
- We adapt to organisations; they never adapt to us.
- We speak the **language of researchers**, never of infrastructure.
- The Intelligence Layer (Ada) makes researchers better, never replaces them.

## 3. Product Principles
1. Every feature answers: *does this help someone produce better research?*
2. Architecture over features when they conflict.
3. Metadata over hardcoding — navigation, terminology, roles, pages.
4. Backward compatible — working things keep working.
5. Adaptive by default — industry, role, capability.
6. Strongly typed, reusable, enterprise-scalable.

## 4. Platform Architecture
The spine: one resolver — `(Org → Workspace → Project → Role → ExperiencePack →
LicensedCapabilities) → ResolvedExperience` — feeding navigation, dashboards,
terminology, and Ada. Full spec in [ARCHITECTURE](04_ARCHITECTURE.md).

## 5. The Intelligence Layer (Ada)
Ada is the platform's context made conversational. Principles and the Ada 1.0
scope are in the [ADA_BIBLE](08_ADA_BIBLE.md).

## 6. UX Principles
- Customers think in the **research lifecycle** (Design → Collect → Verify →
  Analyse → Deliver → Manage); the product is organised that way.
- Adaptive, not cluttered — show a role only what it needs.
- Calm, premium, trustworthy. Evidence over decoration.
- Every screen should read as if built for this specific organisation.

## 7. Design Language
Tokens, colour system, cards, typography, motion. See
[DESIGN_SYSTEM](09_DESIGN_SYSTEM.md). One system, no per-page reinvention.

## 8. Licensing & Pricing
Capability-based licensing; plans unlock capabilities. Customer-facing language is
**Research Capacity / Impact / Potential** — never credits or tokens. See
[PRICING_AND_LICENSING](07_PRICING_AND_LICENSING.md).

## 9. Research Capacity
The unit of value is completed research work (verifications, interviews analysed,
reports, questionnaires). Internally metered; externally expressed as capacity,
impact, and potential.

## 10. Roles & Permissions
Roles resolve to **experiences** (home page + dashboards), not just hidden
buttons. CEO, Research Director, Project Manager, Analyst, Field Supervisor, Admin
each get a purpose-built landing. Permissions are capability-scoped. *(To expand:
the full permission matrix.)*

## 11. Experience Packs
Industry lenses over the same engine: Research Agency, NGO, Government,
Healthcare, Education, Retail/FMCG. Each supplies terminology, default metrics,
and configuration defaults. *(To expand: per-pack metric and copy tables.)*

## 12. Module Specifications
FieldScore (verification), InsightScore (qualitative analysis), Questionnaire
Intelligence, Reports, Integrations, Billing. Each is a **Capability** in the
registry. *(To expand: one spec section per module.)*

## 13. Enterprise Strategy
SSO, audit, SLAs, public API, white-label, Research Lab. See
[ROADMAP](03_ROADMAP.md) Phase 3. *(To expand.)*

## 14. Security Philosophy
Secure by configuration, honest about trade-offs, fail loud not silent. See
[SECURITY](06_SECURITY.md).

## 15. Data Architecture
Submissions in Google Sheets (durable); auth in SQLite or Supabase; media via
authenticated proxy; analysis in InsightScore. Detail in
[ARCHITECTURE](04_ARCHITECTURE.md). *(To expand: retention, PII, residency.)*

## 16. Roadmap
See [ROADMAP](03_ROADMAP.md).

---

*Expansion targets are marked "(To expand)". Treat this Bible as the place all
other documents defer to.*
