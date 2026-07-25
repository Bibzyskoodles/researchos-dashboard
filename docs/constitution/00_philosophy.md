# 00 — Philosophy

This is the foundation. Everything else traces back to here.

## Why we exist

Research is broken in a specific way: the people who fund it cannot
verify it. A government commissions a household survey. A pharmaceutical
company runs a clinical intake. A UN agency measures food security. In
every case, they receive a dataset and a report — and they have no
independent way to know whether the data behind that report is real.

We exist to close that gap.

Not to make research faster. Not to make it cheaper. To make it
**trustworthy** — so that the decisions built on top of research stand on
solid ground.

## The test

Every feature, every design choice, every line of code must answer one
question:

> Does this increase confidence in research?

If the answer is no, it doesn't belong. If the answer is "it's
convenient but doesn't increase confidence," it still doesn't belong.
Convenience without trust is how the industry got here.

## Core principles

### 1. Truth over convenience

Never manipulate data. Never hide uncertainty. Never fake confidence.

If a score is 68, show 68. If the confidence behind that score is low,
say so — in the score itself, not in a footnote. If the system cannot
determine whether an interview was genuine, it says "insufficient
evidence" and routes to human review. It does not guess and present the
guess as fact.

This applies to every layer: the AI agents that score interviews, the
dashboards that present results, the reports that reach clients, and the
API responses that feed downstream systems.

### 2. AI assists, humans decide

Ada recommends. Researchers approve.

No AI output in this system is self-executing. Ada can flag an interview
as suspicious, recommend a back-check, surface a pattern across an
enumerator's portfolio — but the action (reject, approve, escalate)
belongs to a human. The system is designed so that skipping human review
is harder than doing it, not the other way around.

This is not a philosophical position about AI. It is a practical one:
our clients are governments, multilateral organizations, and enterprises
whose decisions affect real people. They need to be able to say "a
qualified researcher reviewed this" — not "an algorithm decided."

### 3. Every score is explainable

No black boxes.

If the platform gives an interview a quality score of 68, Ada explains
*why*: which specific evidence drove the score down, what the confidence
level is, and what action she recommends. The explanation is not a
summary generated after the fact — it is the score. The score is a
compression of the evidence, not a number that exists independently
of it.

This means: every agent finding carries its evidence. Every scorecard
links to the findings that produced it. Every dashboard number can be
drilled into until you reach the raw evidence — the audio segment, the
GPS coordinate, the timestamp, the photograph.

### 4. Every action leaves evidence

Every edit. Every approval. Every rejection. Every AI recommendation.
Every override. Every export.

Auditability is sacred. When a supervisor overrides Ada's recommendation,
the system records who, when, why (mandatory reason), and what the
original recommendation was. When an admin changes a project
configuration, the change is logged. When a client views a report, the
access is recorded.

This is not surveillance. It is the mechanism by which the platform
earns trust. An enterprise client evaluating this system will ask: "Can
I prove to my board that this data was handled correctly?" The answer
must be yes, and the proof must be in the system, not in someone's
memory.

### 5. Enterprise is the floor, not the ceiling

The minimum standard for any feature is: would a compliance officer at
the World Bank, a procurement team at UNICEF, or an audit committee at a
Fortune 500 company accept this?

This means SOC 2, GDPR, NDPR, and ISO 27001 are not aspirations — they
are constraints that shape every architectural decision from day one.
Features that cannot be built within these constraints are redesigned
until they can, not shipped with a plan to "fix compliance later."

### 6. Offline is not a fallback

In the environments where this platform operates — rural Nigeria, remote
clinics, conflict zones — connectivity is the exception, not the rule.
Every feature that touches data collection must work fully offline. Not
"gracefully degraded." Fully functional.

This is a first-class architectural constraint, not a progressive
enhancement. The sync engine, the local database, the evidence capture
flow — all designed offline-first, tested offline-first, and never
allowed to regress into requiring connectivity for core operations.

### 7. Simplicity is the product

The researchers using this platform are not engineers. Many have never
used software more complex than WhatsApp and Excel. The interface must be
so clear that training is measured in minutes, not days.

This does not mean the system is simple — it means the complexity is
absorbed by the architecture, not pushed onto the user. Ada's role is
partly this: she is the layer that translates complex AI analysis into
clear, actionable language that a field supervisor understands.

## What we are not

- We are not a survey tool. We do not compete with KoboToolbox,
  SurveyCTO, or ODK. We integrate with them.
- We are not a communication platform. We do not compete with Zoom,
  WhatsApp, or phone carriers. We are agnostic to them.
- We are not a data visualization tool. We are not Tableau or Power BI.
  We produce insights from verified data — the visualization is a
  delivery mechanism, not the product.
- We are not a general-purpose AI assistant. Ada is a domain expert in
  research integrity, not a chatbot that happens to know about research.

## The long view

In five years, this platform should be the infrastructure that
organizations trust to verify any research, anywhere, in any mode of
collection. The architecture decisions made today — the shared identity
system, the evidence chain, the AI agent pipeline, the offline-first
sync — are designed to support that scale without requiring a rewrite.

Build for that future. But ship what works today.
