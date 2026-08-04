# Ada configures the project, not just the questionnaire

**Status:** all three phases built and merged. Every decision this document
raised is recorded below with the reasoning that settled it.

**Date:** 2026-08-04

---

## The gap

Ada finishes designing a questionnaire and stops. The user is handed a form.

But a form containing a GPS question, a photograph and an audio recording is a
statement about how the fieldwork will be verified — and Ada says nothing about
it. The user then goes to Settings and configures, by hand, the things her own
questionnaire already implied.

Every one of those settings exists and works today. None of them are proposed.

That is the difference between *"an AI wrote me a form"* and *"an AI set up my
fieldwork"*, and it is the only part of this that is genuinely hard for a
competitor to copy: Kobo and SurveyCTO have questionnaire designers. Neither has
a verification engine on the other side of one.

## What Ada already knows when the questionnaire is done

Everything below is present in the questionnaire or the consultation that
produced it. None of it requires new data collection.

| Evidence Ada already has | What it implies |
|---|---|
| a `gps` question exists | location is being captured, so it can be verified |
| an `image` question, and its wording | photos are evidence; the wording says what they should show |
| an `audio` question, and its wording | audio is evidence; the wording says what it should capture |
| how many image/audio questions | whether duplicate-media detection is worth the cost |
| the consultation's target duration | a plausible interview length |
| the consultation's decision + audience | what "relevant to this study" means to the AI checks |
| the question count and types | a rough expected interview length to sanity-check against |

## What she proposes

One card, at the end of the design phase, with each line carrying its own
evidence — the questionnaire is on screen next to it, so every claim is
checkable in one glance.

```
Your questionnaire implies a verification setup. I can apply it.

  Photo checks          REQUIRED
                        Q5 asks for a photograph of a landmark.
  What the photo
  should show           "An outdoor landmark — a road, building or permanent
                        structure, at the location of the interview."
                        From Q5's own wording and your study context.

  Audio checks          REQUIRED
                        Q6 asks for an ambient audio sample.
  What the audio
  should capture        "Ambient environmental sound at the interview
                        location. One speaker or none."
                        From Q6's wording. Confirm the speaker count —
                        it decides whether impersonation checks apply.

  Interview length      6-25 minutes
                        You told me to target 15. This allows for a fast
                        interview and a slow one without flagging either.

  Duplicate detection   ON
                        Two media questions means the same photo could be
                        submitted twice. Worth catching.

  Location zone         NOT SET — I need you to tell me where.
                        Q3 captures GPS, so location can be verified. I
                        don't know where your enumerators are working and
                        I will not guess.

                                          [ Apply ]   [ Not now ]
```

## The rules this must not break

**Ada never guesses a geofence.** This is the hard line in the whole feature.
She has no idea where the fieldwork is. A fabricated zone rejects honest
enumerators and withholds their pay, and it would arrive wearing the authority
of a recommendation. She reports that GPS is capturable and asks. This is the
same call made on 4 August about single-speaker audio: the platform was
deliberately not made to infer it from vague wording, because guessing wrong
silently disables — or in this case silently arms — a fraud control on a project
that never asked for it.

**Ada does not choose thresholds.** `pass_threshold` and `flag_threshold` encode
how strict a client wants to be with their own enumerators. That is a commercial
and ethical decision belonging to whoever pays for the work, and nothing in a
questionnaire implies it. The platform default stands until a human changes it.

**Nothing is self-executing.** `AI_SECURITY.md`: tool call → confirmation card →
explicit user click → independent server-side re-verification. The existing
`propose_delete_project` / `propose_erasure` / `propose_workspace_limit` shape,
followed exactly. Ada says she has *asked*, never that it is *done*.

**Confidence is generated, not authored.** Per the Ada Bible §, every utterance
goes through `build_ada_utterance()` with a numeric level. A proposal Ada is
unsure of must read as unsure — "I recommend checking whether…" — not as a
recommendation with a hedge stapled on.

**Every line carries its evidence.** A proposal a supervisor cannot check is a
proposal they have to take on faith, and the whole platform is an argument
against taking research on faith.

## How it works

### Backend

- `ada/project_config_proposal.py` — **pure**, no model call. Takes a
  questionnaire dict plus the consultation, returns a list of proposed settings,
  each with `{key, value, evidence, confidence, question_ids}`. Pure because the
  derivation rules are the product: they must be testable without a network, and
  a supervisor asking "why did it suggest that?" deserves an answer that is the
  same every time.

  The prose in `evidence` and the `image_context`/`audio_context` values are the
  one part that benefits from the model — but they are generated from the
  question's own text, and the *structure* of the proposal is not.

- New Ada tool `propose_project_configuration(project_id)`. Emits
  `CONFIRM_PROJECT_CONFIG` with the proposal.

- `POST /api/projects/<id>/apply-config-proposal` — admin/manager only,
  org-scoped, **re-derives the proposal server-side from the stored
  questionnaire** rather than trusting the card's contents, then writes through
  the existing `PUT /scoring-config` validation (which already refuses a zone it
  could not enforce). A card is a client-side object; a caller could edit it.

### Frontend

- `CONFIRM_PROJECT_CONFIG` case in `AppShell.tsx`, matching the three that
  already exist.
- A proposal card component: one row per setting, evidence beneath, question
  chips that scroll the questionnaire to the question being cited.
- After Apply: the "Project Summary" this makes possible — questionnaire *and*
  configuration in one view, which is what the user actually built.

## Phases

**Phase 1 — the derivation and the card.** Contexts, engine requirements,
duration bounds, duplicate detection. Everything above except the zone. This is
the bulk of the value and carries no new risk: every setting is one a user can
already set by hand, and each is reversible in Settings.

**Phase 2 — the zone conversation.** Ada asks where the work is happening and
turns an answer into a zone. Now genuinely useful because zones can be roads and
areas (Trust Bible §6.7), so "we're working along Kusenla Road" has a real
shape to become. Needs care: the answer is free text and becoming coordinates
means geocoding it, which means Ada could geocode the wrong place. Probably
"here are the three places I found, pick one" rather than a silent lookup.

**Phase 3 — the project summary.** One screen: questionnaire, verification
configuration, estimated interview time, what each engine will check. The thing
a user shows their client to explain what they bought.

## Deliberately not in scope

- **Auto-applying anything.** Even the safe settings. A configuration that
  appeared without a click is one nobody remembers agreeing to.
- **Ada inferring speaker count from wording.** Refused on 4 August for the
  impersonation check and refused again here, for the same reason.
- **Ada setting thresholds.** See above.
- **Enumerator instructions and supervisor checklists** (both suggested in the
  external review). Good ideas, separate features, no dependency on this one.

## A gap this surfaces

**Project scoring-config changes are not audited.** `security_audit.py` covers
changes to *who can do what* — its `AUDITED_ACTIONS` whitelist is deliberately
closed — and a scoring-policy change is not that, so today there is no record of
who changed a project's pass threshold, image context or zone, or when.

That is already a real gap: `certificate.py` issues a signed attestation about
submissions scored under a policy that can be changed afterwards with no trace.
It becomes more pointed if Ada can change the policy too — "Ada suggested it" is
not an audit trail.

Not part of this feature, but it should be decided before Phase 1 ships rather
than after. The likely answer is a `project_config_history` table, not an
addition to `security_audit` (different question, different retention, different
audience).

## Decisions taken (2026-08-04)

**Ada offers it automatically, when the questionnaire is finished.** Not on
request. The reasoning that decided it: the people who most need the
configuration are exactly the ones who would not know to ask for it, and a first
project running on defaults is the case this feature exists to prevent.

The cost is being presumptuous on the tenth project, so the card must be
dismissible and must not reappear for a questionnaire that has already been
configured or explicitly declined. "Not now" means not now, not "ask me again
on the next save".

**Apply is all-or-nothing, one click.** No per-line checkboxes. Every setting
proposed is one a user can already change by hand and every one is reversible,
so the card carries a plain line pointing at Settings rather than reproducing
Settings inside a chat card. A per-line approval would slow down every use —
including the majority of uses where the answer is "yes, all of it".

This raises the bar on the card itself rather than lowering it: if one click
accepts everything, every line has to be individually defensible on sight, with
its evidence next to it. A line the user cannot check in a glance does not
belong on a card they approve in one action.

## The remaining two questions, decided (2026-08-04)

**When the questionnaire changes, Ada re-offers — but only when it would
actually change something.**

Delete the photo question a week later and the image description still tells
the AI check to look for a landmark nobody is photographing. Never re-offering
leaves that in place silently; re-offering on every save is noise people learn
to click past, which matters more than usual here because one click applies
everything.

So the comparison is against the settings that were actually applied, held in
`project_config_history`. Freshly derive, diff against what was applied, and
offer again only on a real difference — carrying `questionnaire_changed` and
the list of keys that moved, so the card can say what changed rather than
appearing again with no explanation. Nothing changed, nothing to say.

**It is not a paid-plan feature, and should not become one.**

The argument for gating is that it is the strongest differentiator in the
product. That argument is exactly backwards. The users most likely to
misconfigure a project — new, evaluating, on a free workspace — are the ones a
gate would leave running on platform defaults, which is the specific failure
this feature exists to prevent. A first project that produces meaningless
verification is not a customer who upgrades later; it is a customer who
concludes the platform does not work.

It is also the thing that demonstrates what the platform is *for*. Hiding it
until after purchase means nobody experiences the differentiator before
deciding whether to buy.

Volume is the right thing to charge for, and `usage_limits.allowance()` already
does it. Configuration quality is not.

## Phase 3 — the project summary (built 2026-08-04)

`project_summary.py` + `ProjectSummary.tsx`. One panel under the questionnaire:
what this project collects, and what will actually check it.

The design constraint that shaped it: **it must be as willing to say "will not
run, and here is why" as it is to say "will run".** Whether a check runs depends
on the questionnaire *and* the configuration — an image check with no
description does nothing useful, a zone rule does nothing without a zone — and
no screen in the platform said so. The 3rd of August went into a setting that
had silently failed to save, and this is the screen that would have caught it in
a glance.

So gaps render first, in amber, each with the specific fix. Checks that cannot
run because the questionnaire does not collect that evidence are a quiet
footnote rather than a complaint — a text-only questionnaire has no photo
description to be missing.

Every judgement is made server-side. The component renders and decides nothing:
a second opinion about whether a check will run is precisely how the dashboard
came to show a flat 15 for a submission the engine had scored 94.

## Effort

Phase 1 is roughly a day: the derivation module and its tests are most of it,
the card and the route are small, and the pattern it follows already exists
three times over. Phase 2 is a day and carries the geocoding judgement above.
Phase 3 is presentation over data that will by then all exist.

The derivation rules are the part worth spending real time on, and the part
worth arguing about — they are the product opinion. Everything else is wiring.
