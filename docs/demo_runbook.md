# Demo runbook

**For:** running a live demo of the platform.
**Written:** 4 August 2026, ahead of the 5 August demo.

This is what to click, in what order, and what to avoid. It also records
which parts are real and which are honestly labelled as not built — so nothing
gets claimed on stage that cannot be shown.

---

## Before you start (10 minutes, not on stage)

1. **Log in and load every screen you plan to show, once.** A container that
   has been idle is cold, and the first request pays for that. Warming the path
   removes the only pause an audience reads as "it's broken".

2. **Issue a fresh certificate on the project you will demo.** This matters
   more than it sounds. Certificates now state the scoring rules they were
   issued under — but a certificate issued *before* today says "this
   certificate was issued before FieldScore recorded scoring criteria", which
   is honest and unimpressive. Click **Issue new certificate** so the one on
   screen carries the criteria block.

3. **Check the project you will demo has a photo brief and a zone set**
   (Settings → scoring). Without them the certificate correctly reports those
   checks as *not configured*, which is the right behaviour and the wrong
   slide.

4. **Re-score the project you will demo** (Project → re-score, or per submission).
   Rejected submissions used to be stored with a score of **0** — not just a
   REJECT verdict, the number itself was erased. That is why a project whose
   submissions individually showed 63–67 read an **average trust score of 6**:
   the average was counting how many rows got rejected, not measuring quality.
   A rejected submission now keeps its measured score, capped at 30. **Stored
   scores do not change until a submission is re-scored**, so a project you
   demo without re-scoring will still show the old zeros and the old average.

5. **Have the Project Summary in view before the questionnaire.** It reads
   "what this project collects and what will actually check it" — it is the
   single clearest statement of what the product does.

---

## The path that works end to end

Each step below is real and currently working.

| # | Step | Where | Notes |
|---|------|-------|-------|
| 1 | Create a project | Projects → New | Industry + study type drive the rest |
| 2 | Ada writes the questionnaire | Questionnaire | AI call — allow a few seconds |
| 3 | Ada proposes the verification config | Questionnaire, below the draft | Ada proposes, **you accept**. Say this out loud; it is the governance story |
| 4 | Project summary | Same screen | Shows checks that will *not* run and why — lead with this, not past it |
| 5 | Set the collection zone | Settings | Search a road or an area by name; circle / corridor / polygon |
| 6 | Deploy to KoboToolbox | Questionnaire → Export | Also JSON / ODK XLSForm download. **Deploy a fresh form** — see the note below |
| 7 | Submissions arrive and are scored | Submissions | Per-engine breakdown per submission |
| 8 | Fraud catches | Submissions / Verify | Duplicate photo, out-of-zone, rushed interview |
| 9 | Change history | Settings → Change history | Who changed the scoring rules, and when |
| 10 | Issue the certificate | Project → Data Integrity | Criteria block + QR + `/verify/<id>` |
| 11 | Verify publicly | `/verify/<cert_id>` | Open in a private window, or scan the QR on the certificate. No login. This is the moment |

**Interview times need a freshly deployed form.** Forms built before 4 August
carry no `start`/`end` metadata, so KoboToolbox never recorded interview length
for them and duration still reads "not calculable" on submissions collected
through an old form. Redeploy the questionnaire and collect at least one new
submission if you want to show duration being verified rather than skipped.
Submissions already in the project cannot be repaired — the times were never
captured.

**The strongest 90 seconds** is 10 → 11: issue a certificate, then scan its QR
code with a phone — or open the verify link in a private window — and show that
a third party with no account gets a clean verification page confirming it is
genuine, showing how strictly the data was checked, and stating whether the
rules moved mid-project.

Until 4 August that link answered a browser with raw JSON, which is what a
phone camera would have shown the room. It now renders a proper page; the JSON
is still there for API callers at `?format=json`.

---

## What to get data in with

The import modal (Projects → Connect a data source) now shows this honestly:

- **KoboToolbox** — full inline flow, right there in the modal.
- **ODK Central** — real. Set up under Integrations (the modal takes you there).
- **CSV / Excel** — real, including large files: scoring runs on a durable
  background queue with live progress, so a big import cannot stall.
- **SurveyCTO** — genuinely not built. Labelled "talk to us if you need it".

Until today this screen said "Coming soon" for ODK **and** CSV, both of which
work. If you demoed data import off that screen you were understating what you
can do by two sources out of three.

---

## Safe ground if the network is bad

`/demo` is a fully scripted public demo — 48 submissions, a fictional Lagos
retail audit, **no API calls and no login**. Everything renders from a fixture,
including the duplicate-photo fraud catch (the recycled photo is literally the
same image, so the comparison is exact).

Nothing in the app links to it, so type the URL directly. Use it if the backend
is slow, the venue wifi is bad, or you want a guaranteed-identical run.

---

## Do not go here on stage

Honestly labelled, but there is nothing to show:

- **Integrations → Google Sheets, Power BI, Zapier, Teams, Slack** — all marked
  Coming Soon. Slack has partial backend support; the rest have none.
- **Settings → two Coming Soon panels.**
- **SurveyCTO / CommCare / CSPro.**

If asked directly, the honest answer is the one already on screen: not
connected yet, and we will build it if you need it. That answer has been
costing nothing; claiming otherwise would.

---

## Questions you will get, and the true answers

**"Can I see how it decided that?"**
Yes — every submission shows a per-engine breakdown, and the scoring is
rule-plus-model, never a black-box number.

**"What if I change the rules halfway through?"**
The change is recorded with who and when, and any certificate covering that
period says on its face that the figures span more than one set of criteria.
You are told at the moment you issue it, not after a client asks.

**"Can my client verify this without an account?"**
Yes. `/verify/<cert_id>`, public, no login. It shows whether the signature is
intact and how strictly the data was checked.

**"Does the certificate show my photo brief / my zone?"**
No, deliberately. It shows *which* checks ran and the score thresholds, not the
parameters — publishing the brief would tell someone exactly what photograph
would have been accepted, and the zone would tell them where to stand. Your own
full settings are visible to you in Settings.

**"Is the AI making the decisions?"**
No. Ada proposes; a person accepts. Nothing Ada suggests takes effect without a
human clicking, and the record shows which of the two it was.

---

## Known rough edges (not blockers)

- **First request after idle is slow.** Cold start, not concurrency — the
  deployment runs `gunicorn --workers 2 --threads 4 --worker-class gthread`, so
  it serves up to eight concurrent requests, and the work is I/O-bound waiting
  on OpenAI and the database. Warm it first (step 1 above).
- **A large CSV import shows progress but takes real time** — it is scoring
  each row with a model call. Start it before you need it, or use a small file.
- **Ada's questionnaires are good, not yet excellent.** An external review put
  them at 6.5/10; the substance of the critique was that Ada designs a
  questionnaire when she should be designing a FieldScore project. Steps 3 and
  4 above are the first half of the answer to that, and are worth showing for
  exactly that reason.
