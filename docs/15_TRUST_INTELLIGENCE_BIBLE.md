# 15 — The FieldScore Trust Intelligence Bible

**The constitutional document of the FieldScore Trust Intelligence Engine (FTIE)**

> Version 1.0 · July 2026
> Status: **RATIFIED** — implemented in `src/services/trustEngine.ts`, verified by `src/services/trustEngine.test.ts`
> Supersedes: the ad-hoc weighted-average scoring described in earlier drafts of `01_PRODUCT_BIBLE.md`

---

## 0. Philosophy

FieldScore does not score interviews. **FieldScore estimates trust.**

The objective is not to determine whether an image is sharp, whether audio is clear, or whether
GPS is accurate. Those are measurements. The objective is to answer one question:

> **"How much confidence should this organization place in this submission?"**

Everything in this document exists to answer that question.

### The constitutional laws

1. **Evidence over scores.** Every engine contributes structured evidence, not just numbers.
   The Trust Engine reasons over evidence; it never blindly averages numbers.
2. **Absence is information.** A missing photograph is not a neutral event to be ignored —
   it is evidence about the submission. Systems that silently redistribute the weight of
   missing evidence reward enumerators for submitting less. FTIE never does this.
3. **Nothing is punished twice.** Every deduction has exactly one cause. If missing evidence
   is scored as zero, it is not additionally capped, gated, or penalized elsewhere.
4. **Every point is explainable.** For any Trust Index, the engine can reconstruct the complete
   chain of evidence and arithmetic that produced it. "GPT says so" is never an explanation.
5. **Determinism.** The same submission and the same configuration always produce the same
   Trust Index, on any machine, at any time. No randomness, no network calls, no hidden state.
6. **Faults are attributed.** An enumerator who submitted no photo is treated differently
   from an enumerator whose photo the system failed to analyze. The first loses points;
   the second does not.
7. **Trust is the product. Scores are outputs.** If a customer asks "why did this submission
   receive this Trust Index?", the platform must reconstruct the answer, point by point.

### What makes FieldScore different

Every competing system asks: *Was the image blurry? Was the GPS correct? Was the interview
long enough?* FieldScore asks:

> **"Does the entire submission tell a coherent and believable story?"**

That single idea drives the Consistency Engine (§8), the eligibility model (§5), and the
evidence-completeness contract (§7).

---

## 1. Vocabulary

| Term | Definition |
|---|---|
| **Trust Index** | The single 0–100 number expressing how much confidence the organization should place in a submission. The only headline number shown anywhere in the product. |
| **Evidence Provider** (engine) | A subsystem that examines one channel of evidence: GPS, Duration, Image, Audio, Duplicate, AI-Text. |
| **Evidence Record** | The structured output of one provider for one submission: presence, score, confidence, provenance, notes. |
| **Primary evidence** | Evidence the *enumerator* supplies: GPS, Duration, Image, Audio. Its absence is attributable to the enumerator. |
| **Derived analysis** | Evidence the *system* computes: Duplicate similarity, AI-text detection. Its absence is attributable to the platform, never the enumerator. |
| **Requirement level** | Per-engine, per-project policy: `DISABLED`, `OPTIONAL`, `REQUIRED`, `HARD_REQUIRED` (§4). |
| **Eligibility** | Whether a submission qualifies to receive a Trust Index at all (§5). |
| **Evidence Completeness** | The weight-share of expected evidence that actually arrived (§7). |
| **Consistency finding** | A cross-engine corroboration or contradiction detected by deterministic reasoning rules (§8). |
| **Hard gate** | A condition that forces REJECT regardless of arithmetic (§9). |
| **Audit trail** | The ordered, human-readable list of every decision the engine made for one submission (§10). |

---

## 2. Architecture

```
Submission (backend-scored: checks, flags, media refs, metadata)
        │
        ▼
┌─ L1 VALIDATION ────────────────────────────────────────────┐
│  Is there enough data to evaluate at all?                  │
│  → UNVERIFIED (legacy passthrough) | proceed               │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ L2 EVIDENCE ASSEMBLY ─────────────────────────────────────┐
│  One Evidence Record per engine: presence, raw score,      │
│  flag overrides, confidence, provenance                    │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ L3 ELIGIBILITY ───────────────────────────────────────────┐
│  HARD_REQUIRED evidence missing? → INELIGIBLE (Trust 0)    │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ L4 TRUST SYNTHESIS ───────────────────────────────────────┐
│  Confidence-shrunk, requirement-aware weighted synthesis   │
│  (the mathematics of §6)                                   │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ L5 CONSISTENCY ENGINE ────────────────────────────────────┐
│  Cross-engine corroboration / contradiction rules          │
│  bounded adjustment ∈ [−10, +3]                            │
└────────────────────────────────────────────────────────────┘
        │
        ▼
┌─ L6 RISK & RECOMMENDATION ─────────────────────────────────┐
│  Trust Index → risk level → recommendation → verdict       │
└────────────────────────────────────────────────────────────┘
        │
        ▼
Trust Result: index, verdict, risk, recommendation, eligibility,
completeness, confidence, per-engine breakdown, consistency
findings, full audit trail, backend reconciliation
```

The engine is a **pure function**: `computeTrustIndex(submission, config) → TrustResult`.
No I/O, no clock, no randomness. This is what makes principle 5 (determinism) and the
scenario test suite (§13) possible.

### Where the client AI Fraud Scan fits

The submission detail page runs an interactive AI Fraud Scan (metadata/C2PA, GPT-4o vision,
download fingerprinting, transcript analysis). In v1 this is a **parallel investigative
instrument**, not an input to the Trust Index, because its results are asynchronous and
per-viewer — feeding them in would make the same submission show different numbers on
different screens, violating determinism. Phase 2 persists scan results server-side, at
which point they enter L2 as ordinary Evidence Records with their own confidence, and the
`aiHighPenalty` / `aiMediumPenalty` configuration applies at the `text_ai` / `image`
provider level. The architecture requires **zero changes** to absorb this — a new provider
just emits Evidence Records.

---

## 3. The Evidence Providers

| Engine | Key | Class | Default weight | Default requirement | Evidence presence test |
|---|---|---|---|---|---|
| GPS Location | `gps` | Primary | 0.25 | **REQUIRED** | usable lat/lon, or accuracy_m, or positive backend check score; `NO_GPS`/`GPS_PARSE_ERROR` ⇒ absent |
| Duration | `duration` | Primary | 0.22 | **REQUIRED** | `duration_mins` present, or backend check score, or a duration flag |
| Image | `image` | Primary | 0.20 | **REQUIRED** | `image_url` present, or backend check score, or an image flag |
| Audio | `audio` | Primary | 0.13 | OPTIONAL | `audio_url` present, or backend check score; `AUDIO_EMPTY` ⇒ absent |
| Duplicate | `duplicate` | Derived | 0.10 | OPTIONAL | backend check score or a duplicate flag |
| AI-Text | `text_ai` | Derived | 0.10 | OPTIONAL | backend check score or an AI flag |

Weights are raw values normalized at synthesis time; only their ratios matter.

**Why GPS, Duration, Image are REQUIRED by default:** they are the three channels an
enumerator physically controls at the point of interview, and the three hardest to
retroactively fabricate. A field submission with no location, no timing, and no photograph
is an unsupported claim.

**Why Derived engines can never zero an enumerator:** if the duplicate checker didn't run,
that is a platform failure. Principle 6 (fault attribution) forbids converting platform
failures into enumerator penalties. Derived engines that did not run are excluded from
synthesis with an audit note, regardless of requirement level.

---

## 4. Requirement levels

Each engine has exactly one of four states per project. **Never a boolean.**

| Level | Evidence present | Evidence missing |
|---|---|---|
| `DISABLED` | Ignored entirely | Ignored entirely |
| `OPTIONAL` | Scored at weight | Excluded; weight renormalized over the remaining engines; **no penalty** |
| `REQUIRED` | Scored at weight | **Scored 0 at full weight** — the maximum attainable Trust Index drops by exactly that engine's weight share |
| `HARD_REQUIRED` | Scored at weight | **INELIGIBLE** — Trust Index 0, verdict REJECT, reason recorded |

### The arithmetic of REQUIRED-missing (the completeness cap)

With default weights, an enumerator who omits a required photo faces:

```
max attainable = 100 × (1 − w_image / Σw) = 100 × (1 − 0.20) = 80
```

The cap **emerges from the zero**, it is not applied twice (principle 3). Evidence
Completeness (§7) reports the same fact as a transparency metric but never re-penalizes it.

### Present-but-unmeasured (the fault-attribution rule)

If the media exists (`image_url` present) but the backend produced no score for it, the
enumerator did their job and the platform didn't. The engine is **excluded** from synthesis
(like OPTIONAL-missing), completeness credits it at 50%, and the audit trail records
`"image submitted but not yet analyzed — excluded from synthesis, no penalty"`.

---

## 5. Eligibility

Evaluated before any arithmetic:

1. For every `HARD_REQUIRED` engine whose evidence is **absent** → `INELIGIBLE`.
2. An INELIGIBLE submission receives Trust Index **0**, risk `CRITICAL`,
   recommendation `REJECT`, and an explicit reason per missing channel.
3. Eligibility failures are terminal: no synthesis, no consistency analysis. The breakdown
   still lists every engine so the UI can show *what* was missing.

INELIGIBLE is deliberately distinct from "scored very low." A low score means *the evidence
was weak*. Ineligible means *the submission does not qualify to be assessed*. Supervisors
treat these differently: the first is judged, the second is returned.

### Validation (L1) — the legacy escape hatch

If a submission carries **no per-engine data at all** — no checks, no flags, no media
references, no GPS, no duration — the engine cannot reason about evidence. It returns
status `UNVERIFIED` with the backend's `overall_score` passed through unchanged,
confidence 0.30, and an audit note. This protects historical data scored by earlier
pipelines from being mass-zeroed by rules they never knew about. UNVERIFIED is visible in
the UI; it is never silently disguised as a measured Trust Index.

---

## 6. Trust Synthesis — the mathematics

### 6.1 Per-engine effective score

For each engine *i*, with backend raw score `raw_i` (0–100 or absent) and the worst
applicable flag override `ovr_i` (table in §6.5):

```
effective_i = min(raw_i, ovr_i)        if both exist
            = ovr_i                     if only the override exists
            = raw_i                     if only the raw score exists
            = 0                         if REQUIRED/HARD_REQUIRED primary evidence is absent
```

`min` — never replacement — because a flag can only make evidence *less* trustworthy,
never more.

### 6.2 Confidence and shrinkage

Every Evidence Record carries a confidence `c_i ∈ [0,1]` describing **measurement
provenance** — how sure we are the score means what it says:

| Provenance | Confidence |
|---|---|
| Deterministic flag override (a rule fired) | 1.00 |
| Backend pipeline measurement (`checks[engine].score`) | 1.00 |
| Derived GPS score from `accuracy_m` fallback formula | 0.70 |
| Required-missing forced zero (absence is certain) | 1.00 |
| Legacy passthrough (UNVERIFIED) | 0.30 |

Uncertain evidence is **shrunk toward the neutral prior** (50) before weighting — the
standard Bayesian treatment of a noisy measurement against an uninformative prior:

```
s_i = c_i · effective_i + (1 − c_i) · 50
```

A fully-confident measurement passes through unchanged (`c=1 ⇒ s=effective`), so
fully-measured submissions under default configuration remain numerically identical to the
plain weighted average — continuity with historical scores is preserved by construction.
A GPS score of 90 derived only from the accuracy formula (c = 0.70) contributes
`0.7·90 + 0.3·50 = 78` — strong, but not allowed to claim certainty it doesn't have.

**GPS fallback formula** (when no backend check score exists but `accuracy_m` does):

```
gps_derived = max(0, round(100 − log10(max(1, accuracy_m)) × 40))
```

1 m → 100 · 10 m → 60 · 50 m → 32 · 100 m → 20 · 1 km → 0. Logarithmic, because GPS error
grows multiplicatively, not linearly.

### 6.3 Inclusion set and weight normalization

Engine *i* enters synthesis iff:

```
requirement_i ≠ DISABLED
AND NOT gated_i                     (upstream-reject gating, §6.6)
AND (   measured_i                  (raw score or flag override exists)
     OR (primary_i AND requirement_i ∈ {REQUIRED, HARD_REQUIRED} AND absent_i))
```

The last clause is the heart of the system: **required primary absence is included, as a
zero.** Weights renormalize over the inclusion set *S*:

```
ŵ_i = w_i / Σ_{j∈S} w_j
```

### 6.4 Base quality

```
Q = Σ_{i∈S} ŵ_i · s_i
```

### 6.5 Flag → engine override table

Worst (lowest) override wins per engine. Deterministic, auditable, versioned here.

| Flag | Engine | Forced score | Severity |
|---|---|---|---|
| `NO_GPS` | gps | 0 | high |
| `GPS_PARSE_ERROR` | gps | 5 | high |
| `GPS_OUTSIDE_NIGERIA` | gps | 10 | **hard gate** |
| `OUTSIDE_ASSIGNED_ZONE` | gps | 15 | **hard gate** |
| `LOW_GPS_ACCURACY` / `GPS_POOR_ACCURACY` | gps | 35 | medium |
| `DURATION_NEGATIVE` | duration | 0 | **hard gate** |
| `BACK_TO_BACK` | duration | 5 | **hard gate** |
| `DURATION_PARSE_ERROR` | duration | 5 | medium |
| `DURATION_TOO_SHORT` | duration | 10 | medium |
| `DURATION_TOO_LONG` | duration | 20 | medium |
| `DURATION_NOT_CALCULABLE` | duration | 20 | medium |
| `DUPLICATE_SUBMISSION` | duplicate | 0 | **hard gate** |
| `DUPLICATE_IMAGE` | duplicate | 5 | **hard gate** |
| `DUPLICATE_AUDIO` | duplicate | 5 | **hard gate** |
| `AUDIO_EMPTY` | audio | 0 | **hard gate** |
| `AUDIO_QUALITY_ISSUE` | audio | 25 | medium |
| `IMAGE_QUALITY_ISSUE` | image | 25 | medium |

### 6.6 Gating

Configured per project: when an upstream engine hard-fails, listed downstream engines are
skipped (`gated`) — excluded from synthesis and marked in the breakdown. Purpose: cost
saving and principle 3 (a submission already disqualified by GPS fraud is not additionally
dragged through image penalties for the same root cause). Defaults: no gating.

---

## 7. Evidence Completeness

A transparency metric — **reported, never used as a second multiplier** (principle 3):

```
completeness = Σ w_i · p_i / Σ w_i        over non-DISABLED engines
p_i = 1.0  evidence present and measured
    = 0.5  evidence present but unmeasured (platform fault)
    = 0.0  evidence absent
```

Displayed as a percentage on every submission. A 95-Trust submission at 60% completeness
tells a supervisor something a bare "95" never could.

**Overall confidence** is reported alongside:

```
confidence = Σ_{i∈S} ŵ_i · c_i
```

---

## 8. The Consistency Engine

Cross-engine reasoning, v1: five deterministic rules over flags and scores. Each finding is
CORROBORATION or CONTRADICTION with a bounded trust delta; the total is clamped to
**[−10, +3]** so consistency can tip a decision but never dominate the evidence itself.

| Rule | Trigger | Δ | Reading |
|---|---|---|---|
| R1 Rushed + silent | (`DURATION_TOO_SHORT` or `BACK_TO_BACK`) AND (`AUDIO_EMPTY` or audio < 30) | −5 | An impossibly fast interview *and* no usable audio corroborate fabrication |
| R2 Recycled content | any `DUPLICATE_*` AND (duration < min or `DURATION_TOO_SHORT`) | −5 | Copied content submitted quickly — a recycling pattern |
| R3 Evidence blackout | ≥ 2 **required** primary channels absent | −5 | Multiple independent required evidence channels missing is itself a pattern (optional absence never counts — principle 3) |
| R4 Unsupported AI text | text_ai ≤ 40 AND (audio absent or `AUDIO_EMPTY`) | −5 | AI-suspect answers with no audio to verify against |
| R5 Full corroboration | all included primary engines ≥ 80 AND zero flags | +3 | Every channel independently agrees — the story coheres |

```
T = clamp(round(Q + Δ_consistency), 0, 100)
```

Every fired rule appears verbatim in the audit trail. Rules are additive to this table
only through a version bump of this document.

---

## 9. Risk and Recommendation

Hard gates first, arithmetic second:

| Condition (first match wins) | Risk | Recommendation | Verdict (UI) |
|---|---|---|---|
| INELIGIBLE | CRITICAL | REJECT | REJECT |
| Any hard-gate flag (§6.5) | CRITICAL | REJECT | REJECT |
| T < 50 | CRITICAL | REJECT | REJECT |
| 50 ≤ T < passThreshold (70) | HIGH | REVIEW | FLAG |
| T ≥ passThreshold, flags present | MEDIUM | REVIEW | FLAG |
| T ≥ passThreshold, no flags | LOW | APPROVE | PASS |
| T ≥ 85, no flags, completeness ≥ 90% | VERY_LOW | APPROVE | PASS |

**A deliberate departure from the legacy engine:** scores in the 50–69 band are now REVIEW,
not REJECT. Sub-threshold evidence is a reason for a human to look, not proof of fraud;
automatic rejection is reserved for critical-risk conditions. This is the correct
false-rejection / false-approval asymmetry for paid field work: a wrongly-rejected honest
enumerator is a person unpaid for real work, while a wrongly-passed submission still faces
supervisor review.

---

## 10. The Explainability Contract

Every `TrustResult` carries:

- **breakdown[]** — per engine: requirement, class, presence, raw score, override + flag,
  effective score, confidence, shrunk score, normalized weight, contribution in points,
  gated status, notes.
- **consistency[]** — every fired rule with its delta and reading.
- **audit[]** — the ordered plain-language log of every decision: inclusion/exclusion,
  every override, every shrinkage, every zero, the synthesis sum, the consistency clamp,
  the risk classification.
- **backendScore / backendVerdict / delta** — reconciliation against the raw pipeline
  number, so any difference is itself explained, never mysterious.

The UI must be able to render, for any submission: *"Trust Index 61 = GPS 18.4 pts (of 25)
+ Duration 20.1 pts (of 22) + Image 0 pts (of 20 — required photo missing) + … − 5 pts
(rushed + silent pattern)"*. If the UI cannot produce that sentence from the result object,
the result object is wrong.

---

## 11. Configuration reference

All per-project, persisted in engine config (`fs_engine_config_v1`), applied identically on
every surface:

| Key | Default | Governs |
|---|---|---|
| `weights.{engine}` | §3 table | Relative influence (auto-normalized) |
| `requirements.{engine}` | §3 table | DISABLED / OPTIONAL / REQUIRED / HARD_REQUIRED |
| `passScoreThreshold` | 70 | APPROVE/REVIEW boundary |
| `gpsToleranceMeters` | 50 | Backend flagging (zone tolerance) |
| `minDurationMins` / `maxDurationMins` | 8 / 120 | Backend flagging + R2 |
| `duplicateThresholdPct` | 85 | Backend duplicate flagging |
| `gating.*_reject_skips` | empty | §6.6 |
| `aiHighPenalty` / `aiMediumPenalty` / `aiMediumFlag` | 55 / 20 / true | Phase-2 AI evidence provider |

The legacy boolean `enabled` map is preserved for backward compatibility and derived from
`requirements` (`enabled = requirement ≠ DISABLED`). Stored configs from before
requirements existed are migrated on load: `enabled: false → DISABLED`,
`enabled: true → the §3 default level`.

---

## 12. Edge-case ledger

Every case below has defined behavior and (where marked ✓) a scenario test.

| # | Case | Behavior |
|---|---|---|
| E1 ✓ | Required image missing entirely | Image = 0 at full weight; max attainable drops by image's weight share |
| E2 ✓ | Optional audio missing | Excluded, weights renormalize, no penalty |
| E3 ✓ | HARD_REQUIRED GPS missing | INELIGIBLE, Trust 0, reason recorded |
| E4 ✓ | Image submitted but backend never scored it | Excluded, 50% completeness credit, audit note, no penalty |
| E5 ✓ | All evidence present, default config, no flags | Trust Index = plain weighted average = backend score (continuity) |
| E6 ✓ | GPS score only derivable from accuracy_m | Derived score, confidence 0.70, shrunk toward 50 |
| E7 ✓ | Flag override + raw score both exist | min() wins — flags never raise a score |
| E8 ✓ | Two flags hit the same engine | Worst (lowest) override wins |
| E9 ✓ | DUPLICATE_SUBMISSION with perfect other engines | Hard gate → CRITICAL / REJECT regardless of arithmetic |
| E10 ✓ | Legacy submission (no checks, flags, or media data) | UNVERIFIED passthrough of backend score, confidence 0.30 |
| E11 ✓ | No evidence AND no backend score | Trust 0, UNVERIFIED |
| E12 ✓ | Rushed interview + empty audio | R1 fires, −5, audit records the pattern |
| E13 ✓ | Perfect submission across every channel | R5 fires, +3, capped at 100 |
| E14 ✓ | Everything disabled except one engine | That engine's shrunk score = Trust Index |
| E15 ✓ | Gating: GPS reject skips image/audio | Skipped engines marked gated, excluded, shown in breakdown |
| E16 ✓ | Score in 50–69 band, no hard gates | HIGH risk, REVIEW — not auto-REJECT |
| E17 ✓ | Derived engine (duplicate) unmeasured while REQUIRED | Excluded with audit note — derived absence never zeros an enumerator |
| E18 ✓ | AUDIO_EMPTY when audio is HARD_REQUIRED | Empty audio counts as absent → INELIGIBLE |
| E19 | Corrupted/unreadable media | Backend flags it (quality flag → override) or leaves it unscored (E4 path) |
| E20 | Multiple images where one expected | Backend concern; the image Evidence Record scores what was analyzed |
| E21 | Clock tampering / future timestamps | Phase 2 metadata provider; enters as ordinary Evidence Records |
| E22 | GPS spoofing beyond flag detection | Phase 2 (velocity checks, device attestation) — same provider interface |
| E23 ✓ | Weights that don't sum to 1 | Normalization makes only ratios matter |
| E24 ✓ | Consistency delta would exceed bounds | Clamped to [−10, +3] before application |

---

## 13. Canonical scenario table

The contract between this document and the code. Implemented one-to-one in
`src/services/trustEngine.test.ts`; a change to either side without the other is a
build-breaking event.

Selected core scenarios (full set in the test file):

| Scenario | Setup | Expected |
|---|---|---|
| S1 Full house | All six engines measured 90/85/88/92/95/90, no flags, defaults | T = weighted mean (±1), PASS, VERY_LOW or LOW risk, completeness 100% |
| S2 The missing photo | gps 90, duration 85, audio 92, **no image anywhere**, image REQUIRED | Image row: 0 pts of its full weight share; T ≤ 80-equivalent cap; audit says "required evidence missing" |
| S3 The hard wall | Same as S2 but image HARD_REQUIRED | INELIGIBLE, T = 0, REJECT |
| S4 Platform's fault | image_url present, no image check score | Image excluded, no penalty, completeness credits 50% |
| S5 The duplicate | All engines 90+, `DUPLICATE_SUBMISSION` flag | CRITICAL, REJECT, duplicate row shows 0 with flag attribution |
| S6 Rushed & silent | `DURATION_TOO_SHORT` + `AUDIO_EMPTY` | Overrides force both engines down; R1 fires −5; audit shows the pattern |
| S7 Legacy row | Only `overall_score: 77` on the record | UNVERIFIED, T = 77, confidence 0.30 |
| S8 The gray zone | Measured evidence averaging ≈ 60, no hard flags | FLAG / REVIEW / HIGH risk — never auto-REJECT |

---

## 14. Future evidence providers

New providers (video analysis, device attestation, satellite cross-reference, biometric
verification, the persisted AI Fraud Scan) plug into L2 by emitting Evidence Records —
`{presence, score, confidence, provenance, notes}` — and automatically participate in
synthesis, completeness, and consistency. **No provider may bypass the Evidence Record
interface**, because everything downstream (shrinkage, audit, explainability) depends on it.

Enumerator Reputation (Bayesian trust across submissions, recency-weighted, slow to earn
and fast to lose) and Project Intelligence (coverage, regional risk, supervisor quality)
consume Trust Results; they never feed back into a submission's own Trust Index — a
submission is judged on its evidence, not its author's history. Reputation gates *workflow*
(sampling rates, auto-approval eligibility), not *scores*.

---

## 15. Final principle

FieldScore must never become an AI scoring tool. It must become the most trusted reasoning
engine for field research. Scores are outputs. **Trust is the product.** Every architectural
decision must strengthen the system's ability to explain, defend, and continuously improve
its assessment of research quality.

If a customer asks *"Why did this submission receive this Trust Index?"*, the platform must
be able to reconstruct the complete chain of evidence and reasoning that led to that
conclusion — and with this engine, it can.
