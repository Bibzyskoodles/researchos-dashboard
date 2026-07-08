# ResearchOS — Architecture Decisions

Every major decision, and **why**. Future engineers must understand the reasoning,
not just the result — that is what stops the architecture from degrading over
years. Format: lightweight ADR. Newest at the bottom; never delete, only supersede.

Status: ✅ Accepted · 🔁 Superseded · 🤔 Proposed

---

### ADR-001 — `ResolvedExperience` is the heart of the platform ✅
**Decision.** Roles, permissions, experience packs, navigation, terminology, and
dashboards are not separate systems. They are outputs of one resolver:
`(Org → Workspace → Project → Research Stage → Role → Experience Pack → Licensed
Capabilities) → ResolvedExperience`. Every surface consumes it.
**Why.** Separate systems drift and duplicate. One resolver gives a single,
testable source of truth for "what this user sees right now," and every future
surface (search, pricing, Ada) plugs into it for free.

### ADR-002 — Metadata over hardcoding (the No-Hardcoding Rule) ✅
**Decision.** Navigation, roles, capabilities, settings, dashboard cards, packs,
terminology, integrations, reports, notifications, commands, and permissions must
become metadata. The UI describes itself.
**Why.** Enterprise scale means many capabilities × roles × industries × customer
types. Hardcoding that combinatorial space is impossible to maintain. Metadata
makes a new capability a registry entry plus its components.

### ADR-003 — Terminology is a function `t(key)` ✅
**Decision.** All industry vocabulary resolves through `t("respondent")` fed by the
active Experience Pack. `IndustryContext` (already live) is the seed.
**Why.** "Respondent/beneficiary/citizen/consumer" scattered across hundreds of
files is unmaintainable. One resolver = hundreds of hours saved and instant new
industries.

### ADR-004 — Ada is the Intelligence Layer, consuming `ResolvedExperience` ✅
**Decision.** Ada is not "an AI analyst." She receives the same context/resolved
experience as the UI; her language, suggestions, and commands follow from it.
**Why.** Otherwise Ada needs her own industry/role/permission/project/capability
contexts that must be kept in sync. Consuming the one resolver makes her correct
by construction and repositions her as a platform layer, not a sidecar.

### ADR-005 — Research Stage is part of the resolver ✅
**Decision.** Add `Research Stage` (Planning → Fieldwork → Cleaning → Analysis →
Reporting → Completed) to the context. Dashboards, navigation, recommendations,
and Ada are stage-aware.
**Why.** Research is a process, not a state. The platform should never suggest
generating a report before interviews exist. Stage-awareness is a core
differentiator and belongs in the spine, not bolted on.

### ADR-006 — Customer Type is a distinct axis from Experience Pack ✅
**Decision.** Model **Customer Type** (business model: Research Agency, NGO,
Corporate, University, Government) separately from **Experience Pack** (industry
terminology).
**Why.** Industry changes *terminology*; business model changes *workflows and
structure* (clients/billing vs donors/M&E vs ethics/publications). Conflating them
would force wrong workflows on the right vocabulary and vice-versa.

### ADR-007 — Platform Registry, not just a Capability Registry ✅
**Decision.** A family of registries — Capability, Dashboard, Command, Settings,
Integration, Report, Notification — with each capability self-declaring across
them. The homepage, sidebar, and command palette build themselves.
**Why.** Navigation was the visible tip; dashboards, commands, settings, reports,
and notifications were still implicit/hardcoded. Making everything declare itself
is the only way to honour the No-Hardcoding Rule end-to-end.

### ADR-008 — Seed only what's proven ✅
**Decision.** Seed the registry from working, proven routes. Do not migrate dead
code, experimental pages, or placeholders. Delete cruft rather than preserve it.
**Why.** A refactor is the cheapest time to simplify. Migrating dead code
launders it into "supported." Backward compatibility means preserving *behaviour
users rely on*, not every file that exists.

### ADR-009 — Research Capacity, never customer-facing AI/tokens ✅
**Decision.** Customer-facing language is Research Capacity / Impact / Potential.
Tokens/credits may exist internally but never reach the customer.
**Why.** We sell completed research work, not compute. Pricing on tokens teaches
customers to think about our costs instead of their outcomes.

### ADR-010 — Don't over-engineer before revenue ✅ (guardrail)
**Decision.** Each architectural layer must solve a **today** problem while making
tomorrow easier. Elegant-but-unearned layers are deferred and recorded as
Proposed, not built.
**Why.** Architecture serves the product. The registry/resolver earn their place
now by removing real hardcoding and enabling adaptivity we already need; layers
that don't clear that bar wait.

### ADR-011 — Resolve real license/role from auth; gate plans safely ✅
**Decision.** `PlatformProvider` feeds the resolver **real** context: the signed-in
user's `role` and the organisation's `plan`. Licensing is derived from `plan` via
`capabilitiesForPlan()` against each capability's `requiredLicense`. Two
backward-compatibility rules: (1) a missing/unknown plan and `trial` get **full
access**, so no existing session or trial loses features; (2) only the named
lower tiers are actually gated — in practice just `starter`, which correctly
does not include InsightScore or the Questionnaire builder per 07_PRICING.
Role-based *navigation* gating is deferred (`permissions: undefined`) so
managers/viewers keep today's nav; the real role is still plumbed for dashboard
cards and future gating.
**Why.** This makes the resolver reflect reality (the point of the platform spine)
while honouring the "don't break existing functionality" guardrail. Enforcement
of the risky axes (tenant isolation, role-hidden nav) stays deliberately off
until there is a coordinated, data-verified switch — consistent with ADR-008
(seed only proven) and ADR-010 (don't over-engineer before revenue).

---

*New decisions append here. When a decision changes, mark the old one 🔁
Superseded and reference the new ADR — never rewrite history.*
