# Deployment Configurator — spec

Replaces the traditional pricing page with an Ada-guided consultation.
**Status: v1 in build.**

## The idea

Not a pricing page. The experience a world-class solutions consultant would
create if they had 90 seconds to recommend the right FieldScore deployment.

The user answers ~6 business questions. Ada infers everything technical
(submission volume, AI usage, storage, engines, support tier). The output is a
*recommended configuration* the buyer feels was designed for them — with the
investment appearing as part of the recommendation, not as the page's purpose.

## Decisions taken (with the founder, before build)

**1. It does NOT quote a fixed price.** Shows an *indicative range* and routes to
a human. The published self-serve plans (Starter/Professional/Enterprise, in
Settings → Billing with working Paystack checkout) remain the self-serve path
for small customers. Two audiences, two paths, no contradiction — and no
quoting a precise number that could kill a deal before sales can frame it.

**2. Ends with the recommendation, then email capture.** The user sees the full
configuration and value first (earns it), then "Email me this proposal". Sales
receives every answer. No PDF in v1.

**3. No ROI/savings calculator in v1.** Deferred until there's real customer data
behind a number. See "Why no savings section" below.

## Non-negotiable: Ada must not fabricate

The original spec had Ada say *"Based on similar organisations, that's
approximately 54,000 interviews annually."* We have no such dataset. That is a
fabricated evidence claim, and it breaks this repo's own rule — *"Never
fabricate data. Never fake confidence."*

It matters more here than almost anywhere else: **our product is "we detect when
research data is invented."** A prospect who senses our own estimator invents
numbers has been handed a reason to distrust the thing we sell.

So every inferred number is **visible and editable**:

> "I'm assuming ~250 interviews per project — typical for agencies. **Adjust →**"

Transparent, one click to correct, and more accurate than our guess. Ada states
assumptions, never claims evidence she doesn't have.

**Why no savings section in v1:** "reduces manual QA workload by ~65%" is a
commercial representation, not a UI element — an NGO or government buyer may
treat it as a written claim in a procurement file. When it ships, it must use
*their* inputs and *their* arithmetic, clearly labelled as their own estimate,
never a FieldScore-asserted percentage.

## The flow (6 questions, ~90 seconds)

Every slider is **pre-positioned at the median for the chosen org type**, so a
user can simply press Next. Inference as a visible default, not a hidden guess —
this is what removes friction, not removing the sliders.

1. **Organisation type** — cards: Research Agency / NGO / Government / University / Enterprise / Other. Sets every downstream default.
2. **Field team size** — slider, pre-set by org type.
3. **Projects per year** — slider, pre-set by org type. Ada now shows the inferred annual interview volume *with its assumption exposed and editable*.
4. **Evidence collected** — GPS / Photos / Audio / Video / Documents. Pre-checked by org type. Drives which verification engines are recommended.
5. **How important is field quality** — Helpful / Important / Mission Critical → maps internally to support tier.
6. **Setup help** — none / configuration / configuration + training.

Ada speaks on **threshold crossings only** — when the recommendation genuinely
changes. Commenting on every slider tick reads as noise within about ten seconds.

## Live recommendation panel

Builds as they answer: deployment, verification engines enabled, support level,
onboarding, pilot. Then "Why this configuration?" in plain English. Then
"What you'll gain" (without/with — factual, not a strawman). Then the
**indicative range**. Then email capture.

## Build shape

- `ConfiguratorPage.tsx` — the flow. Pure client-side recommendation logic in a
  separate `configuratorEngine.ts` so it's unit-testable without the UI.
- `POST /api/leads/deployment-plan` — public, rate-limited, validated. Emails the
  founder every answer; sends the visitor a confirmation.
- Route it at `/configure` (and point the existing unrouted `PricingPage` at it).

## Open items

- **Mobile**: the two-panel layout is a desktop pattern. v1 stacks — recommendation
  becomes a sticky summary bar that expands. Needs real-device checking.
- **Currency**: ₦ primary; international donors think in USD. Decide before launch.
- **Implementation/training/support pricing** doesn't exist yet — the range must be
  derived from the plan prices we do have until those numbers are set.
- **Reuse at signup**: the same six answers could pre-configure a new workspace.
  Strong follow-up — makes this onboarding, not just marketing.
