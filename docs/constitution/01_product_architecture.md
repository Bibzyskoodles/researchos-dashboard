# 01 — Product Architecture

## One platform, not three products

FieldScore, CallScore, and InsightScore are not three products that
happen to share a database. They are three engines inside one platform.

To customers, the product is one thing: the system they use to collect
data, verify it, and understand it. The engine names (FieldScore,
CallScore, InsightScore) are branded capabilities — marketing handles
for what are, architecturally, modules of a single system sharing
identity, evidence, scoring vocabulary, and reporting infrastructure.

This distinction matters because it determines how we build. Three
products would have three user models, three permission systems, three
ways of representing "an interview." One platform has one of each, with
collection mode as a parameter — not a product boundary.

## System map

```
                    Intelligency Platform
                           |
            +--------------+--------------+
            |              |              |
        Collect         Verify        Understand
            |              |              |
    +-------+-------+     |              |
    |       |       |     |              |
  Field   Call   Hybrid   |              |
  Engine  Engine  Mode    |              |
    |       |       |     |              |
    +-------+-------+     |              |
            |              |              |
     Evidence Store -------+              |
            |                             |
     Verification Engine                  |
     (Fraud + Quality + Timing)           |
            |                             |
     Scoring Engine                       |
     (Scorecards + Verdicts)              |
            |                             |
            +-----------------------------+
            |
     Insight Engine (InsightScore)
     (Analysis + Themes + Reports)
            |
     Ada (everywhere)
```

## Collection modes

A project has exactly one collection mode, chosen at creation:

| Mode       | What it means |
|------------|---------------|
| `field`    | In-person, face-to-face. GPS, photos, enumerator presence, timing verification. |
| `call`     | Remote interviews over any channel. Companion audio, transcription, AI agent scoring. |
| `hybrid`   | Both field and call interviews in the same project, same dashboard, same reports. |

Hybrid is not a third engine. It is an orchestration mode that routes
each interview to the appropriate verification pipeline based on its
collection method, then merges the results into a unified project view.

```typescript
type CollectionMode = 'field' | 'call' | 'hybrid';
```

Nothing else. No `'survey'`, no `'panel'`, no `'online'`. If a new
collection method emerges (e.g., AI-conducted interviews), it becomes a
sub-mode of an existing engine or a new engine — never a new value in
this enum unless it requires a fundamentally different verification
pipeline.

## Shared systems

These systems are shared across all engines. They are not duplicated
per mode.

### Identity

One user. One login. One role. One trust record.

An enumerator who conducts field interviews in Project A and call
interviews in Project B has one trust score that reflects both. The
trust record is the mechanism by which patterns become visible across
collection modes — an enumerator whose field interviews are consistently
flagged for GPS anomalies and whose call interviews show transcript
irregularities is one problem, not two unrelated signals.

### Evidence store

Every piece of evidence — audio recordings, GPS coordinates,
photographs, timestamps, transcripts, consent artifacts, screenshots —
lives in one evidence store, keyed by submission ID. The store is
mode-agnostic: it accepts evidence artifacts with a type tag and a
storage reference. The verification engine reads from it; the collection
engines write to it.

### Scoring vocabulary

Both engines produce the same output shape:

```
verdict:         PASS | FLAG | REJECT
grade:           A | B | C | D | F
overall_score:   0-100
confidence:      0-100
fraud_risk:      low | medium | high
```

This shared vocabulary is what makes unified dashboards, cross-mode
reports, and portfolio-level trust records possible. If field mode
produces a verdict and call mode produces a different data structure,
every downstream consumer breaks.

### Reporting

InsightScore consumes verified data from both engines. It does not know
or care whether an interview was conducted face-to-face or over the
phone. It receives submissions with verdicts, scores, and evidence
chains. Its analysis — themes, patterns, anomalies, recommendations —
operates on the unified dataset.

## What each engine owns

### Field Engine (FieldScore)

Responsible for verifying in-person data collection:

- GPS verification (location vs. expected coordinates)
- Photo analysis (timestamps, metadata, content)
- Timing analysis (duration vs. expected range)
- Enumerator device telemetry (offline periods, app usage)
- Submission-level quality scoring
- Duplicate detection (same respondent, same location)

### Call Engine (CallScore)

Responsible for verifying remote interviews:

- Audio capture (companion/room recording, with consent)
- Speech-to-text (multi-provider ensemble: Deepgram, Whisper, regional)
- Transcript analysis (question compliance, answer consistency)
- Behavioural analysis (engagement, naturalness, scripted detection)
- Cross-interview pattern detection (similarity, voice fingerprint)
- Call timing verification (Device 1 state vs. recording timeline)

### Insight Engine (InsightScore)

Responsible for turning verified data into understanding:

- Quantitative analysis (statistical summaries, cross-tabulations)
- Qualitative analysis (theme extraction, sentiment, coding)
- Mixed-methods synthesis
- Report generation (automated narrative + visualizations)
- Trend detection across waves/rounds
- Methodology recommendations

### Ada

Ada is not an engine. She is the intelligence layer that sits across all
of them. She:

- Guides project setup (any mode)
- Explains scores and findings (any engine)
- Recommends actions (verify, review, escalate)
- Generates reports (from any data source)
- Teaches users (contextual, not generic)
- Coaches interviewers (future: real-time, with consent)

Ada is described fully in [04 — Ada](./04_ada.md).

## Navigation architecture

The platform navigation reflects the research lifecycle, not the
engine boundaries:

```
Sidebar (project mode):

  1. Design     — questionnaire, framework, methodology
  2. Collect    — field / call / hybrid (adapts to project mode)
  3. Verify     — quality review, fraud detection, scorecards
  4. Analyse    — InsightScore: themes, statistics, patterns
  5. Report     — dashboards, exports, shared reports
```

A user never "switches to CallScore." They create a project, choose a
collection mode, and the entire lifecycle adapts. The mode badge in the
sidebar (Field / Call / Hybrid) is a reminder, not a navigation
element.

## Data flow

```
Collection (any mode)
  → Evidence artifacts stored
  → Sync status tracked (offline-first)
  → Evidence bundle assembled
  → Verification pipeline triggered

Verification
  → Tier 1: Audio/media quality + transcription (call) or GPS/photo (field)
  → Tier 2: Content analysis (parallel agents)
  → Tier 3: Cross-interview pattern detection
  → Tier 4: Synthesis → scorecard + Ada summary

Analysis
  → Verified submissions flow to InsightScore
  → Unverified/flagged submissions excluded or marked
  → Analysis operates on trusted data only

Reporting
  → Reports cite verification status
  → Confidence levels propagate to report language
  → Evidence chain is traceable from any claim
```

## Scale constraints

The architecture must support:

- 10,000+ submissions per project (large national surveys)
- 500+ concurrent enumerators per organization
- 50+ organizations on the platform
- Offline-first with sync bursts (20 enumerators syncing at 6pm)
- Multi-region data residency (Africa, EU, US — per organization)
- Real-time dashboards during active collection periods

These are not future requirements. They are the conditions under which
the platform's first enterprise clients will operate.
