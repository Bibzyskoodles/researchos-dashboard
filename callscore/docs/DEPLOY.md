# Deploying the CallScore service on Railway

The CallScore agent-pipeline runs as its own Railway service **inside the
same Railway project as `fieldscore-backend`**, sharing that project's
Postgres plugin (decision 3.4, docs/RECONCILIATION.md). Everything below is
already wired in the repo — deploying is configuration, not code.

## 1. Create the service

In the Railway project that hosts `fieldscore-backend`:

1. **New → Service → GitHub repo**, pick the repo containing this code.
2. Set the service **root directory** to `callscore/backend` (it has its own
   `Dockerfile` and `railway.toml`; Railway will use the Dockerfile build).

## 2. Environment variables

| Variable | Value | Why |
|---|---|---|
| `DATABASE_URL` | Reference the project's existing Postgres plugin (`${{Postgres.DATABASE_URL}}`) | Shared database — CallScore extends `submissions` and adds its own tables. **Must be the same DB fieldscore-backend uses.** |
| `JWT_SECRET` | The **exact same value** as fieldscore-backend's `JWT_SECRET` | CallScore verifies the tokens FieldScore issues (`app/core/auth.py`). Different values = every request 401s. |
| `CORS_ORIGINS` | `https://<your-dashboard-domain>` (comma-separated for several) | Defaults to `https://researchos-dashboard.vercel.app,http://localhost:3000` if unset. |
| `TIMING_DISCREPANCY_THRESHOLD_SECONDS` | optional, default `90` | Late-start/early-stop flag threshold (Bible 6.5). |
| `DEEPGRAM_API_KEY` | Deepgram key | **Primary STT** — diarized (speaker-labelled) transcription, telephony-tuned. |
| `INTRON_API_KEY` | Intron key | **African-accent specialist STT** (Sahara v2: 500+ accents, 23 African languages; benchmarks above the global engines on African speech). Cross-check slot ahead of Spitch. Enterprise-provisioned — confirm endpoint with the key (`INTRON_API_URL` configurable). |
| `SPITCH_API_KEY` | Spitch key | **Nigerian-language specialist STT** (Yoruba/Igbo/Hausa/Nigerian English) — plus **translation** (local-language transcripts auto-translate to English for analysis, original stays the evidence) and **Ada TTS** (`POST /api/v1/ada/speak` — Ada literally speaks yo/ig/ha). Set `SPITCH_LANGUAGE` (en/yo/ig/ha); verify endpoints against docs.spitch.app on first use (`SPITCH_API_URL` configurable). |
| `ASSEMBLYAI_API_KEY` | AssemblyAI key | **Additional STT** — whichever two providers rank highest are used; every transcript is cross-checked and low agreement becomes a finding that routes the interview to human review. |
| `OPENAI_API_KEY` | OpenAI key | Tier 2 analysis judgments (gpt-4o-mini) + whisper-1 as STT fallback. **Without any keys the pipeline still runs** — interviews score deterministically with reduced confidence and route to human review (Bible 4.3). |
| `CONSENT_ENCRYPTION_KEY` | a strong random passphrase | Encrypts respondent phone numbers at rest (Bible Part 9). Respondent CSV import **refuses to run** without it. |
| `STORAGE_DIR` | optional, default `/data/callscore-evidence` | Where uploaded recordings live. **Attach a Railway Volume at `/data`** or recordings vanish on redeploy. |
| `SIMILARITY_THRESHOLD` | optional, default `0.7` | Tier 3 near-duplicate transcript threshold. |
| `VAPI_API_KEY` + `VAPI_PHONE_NUMBER_ID` | Vapi credentials | **AI back-check calls** — automated verification calls dispatched from the scorecard. Set `PUBLIC_BASE_URL` to this service's public URL and `VAPI_WEBHOOK_SECRET` so end-of-call reports land as evidence. |
| `AGENT_MODE_ENABLED` | `true` to enable | **Agent mode (Bible Part 12)** — optional AI-conducted interviews; needs the Vapi credentials above too. Off by default: unset = the Collect stage's 🤖 Agent tab explains it's disabled and nothing dispatches. The AI discloses itself, requires verbal consent (declined = nothing retained), and every interview is permanently labelled `collection_mode='agent'`. |
| `REDIS_URL` | leave unset | Only needed when the pipeline moves from inline to a Celery/RQ worker. |

Do **not** set `PORT` — Railway injects it and the Dockerfile honours it.
**Do attach a Volume** (service → Volumes → mount at `/data`) before real
interviews flow — evidence recordings must survive redeploys.

## 3. What happens on boot

The container runs `python -m app.db.migrate` before starting uvicorn:
every file in `backend/migrations/` is applied in order, and all of them
are idempotent (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`), so this is
safe on every deploy and safe against fieldscore-backend's own
`db.init_db()` having created the same columns first — whichever service
deploys first wins, the other no-ops.

Health check: `GET /health` (configured in `railway.toml`). Everything
else requires a FieldScore Bearer token.

## 4. Point the dashboard at it

In Vercel (researchos-dashboard project settings → Environment Variables):

```
REACT_APP_CALLSCORE_API_URL=https://<the-new-service>.up.railway.app
```

then redeploy the frontend. Until this is set, the frontend falls back to
`https://callscore-production.up.railway.app` (a placeholder — update it in
`src/services/api.ts` if your service gets a different name, or just set
the env var).

**If the service URL differs from the placeholder**, also add it to the
CSP `connect-src` in `public/index.html` — the browser blocks calls to
any host the CSP doesn't list, and that failure looks like a network
error, not a CSP error, unless you check the console.

## 5. Smoke test

```bash
# open endpoint
curl https://<service>.up.railway.app/health
#   -> {"status":"ok"}

# auth is enforced (expect 401)
curl -i https://<service>.up.railway.app/api/v1/scorecards/queue/PROJ-1

# with a real token from the dashboard (localStorage fs_token), expect 200
curl -H "Authorization: Bearer <fs_token>" \
  https://<service>.up.railway.app/api/v1/scorecards/queue/<project-id>
```

Then in the dashboard: open a project → Collect → Call tab (should show
"No call interviews yet" instead of a load error), and Verify → Call
Review Queue.

## Hardening (Wave 1.5) — on by default

| Variable | Default | What it does |
|---|---|---|
| `RATE_LIMIT_PER_MINUTE` | `240` | Per-IP request cap (0 disables; `/health` exempt). In-process — swap for Redis if the service ever runs multiple instances. |
| `PIPELINE_INLINE` | off | Scoring runs via the durable in-process worker (upload returns `queued`; the worker sweeps `synced` rows every `PIPELINE_SWEEP_SECONDS`, reclaims stale `processing` rows, marks crashes `failed`). Set `true` only for tests/tiny deployments. |
| `SENTRY_DSN` | unset | Error monitoring for both this service and fieldscore-backend (same variable name on each). Set `SENTRY_TRACES_SAMPLE_RATE` > 0 for performance tracing. |

## Backups & disaster recovery — do this before real data

1. **Postgres**: enable Railway's backups on the Postgres plugin, then —
   the part everyone skips — **test a restore** into a scratch database
   and run one query against it. An untested backup is a hope, not a
   backup. Re-test quarterly.
2. **Evidence volume** (`/data`): Railway volumes are not backed up by
   Railway. Recordings are legal evidence — schedule a copy to object
   storage (e.g. a nightly `tar` of `STORAGE_DIR` pushed to S3/GCS from a
   cron service, or Railway's volume snapshot feature if available on
   your plan). Until that exists, treat the volume as the single copy it
   is and say so honestly in any compliance conversation.
3. **Secrets**: keep `JWT_SECRET`, `CONSENT_ENCRYPTION_KEY`, and provider
   keys in a password manager as well as Railway — losing
   `CONSENT_ENCRYPTION_KEY` permanently orphans every encrypted phone
   number.

## The mobile apps

Both are Expo apps that talk to this service — no separate deployment,
they're distributed via Expo Go (pilots) or EAS builds (production):

- `callscore/mobile` — the enumerator app (Device 2): consent gate,
  Start/Stop capture, Glance-Confirm questionnaire, offline queue with
  recording upload.
- `callscore/link` — the Device 1 companion (cloud-relay MVP): pair by
  Link code, report call start/end, confirm call-screen fields.

Update `CALLSCORE_URL`/`FIELDSCORE_URL` in each app's `src/api` file (or
wire Expo env config) if your service URLs differ from the defaults.

## Known limits at this stage

- No STT provider is **validated** for Nigerian Pidgin / code-switched
  Yoruba/Igbo/Hausa-English (Bible Part 11 names this the top risk AND the
  moat) — the cross-provider agreement check surfaces trouble, but a
  dedicated evaluation benchmark (and possibly a specialised engine like
  Spitch/Intron) is required before production reliance.
- Voice fingerprinting (Tier 3) remains unimplemented — it needs an
  enrolment flow; the pipeline treats it as absent capability.
- Link's automatic call-state detection + BLE are V1 native work; MVP uses
  deliberate taps over the cloud relay (see `callscore/link/README.md`).
- The InsightScore handoff for call rows runs inside fieldscore-backend's
  drainer (PR #13), which must be merged/deployed for verified call
  interviews to flow onward.
