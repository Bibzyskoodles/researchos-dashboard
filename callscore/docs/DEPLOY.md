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
| `OPENAI_API_KEY` | your OpenAI key | Powers transcription (whisper-1) and the Tier 2 analysis agents (gpt-4o-mini). **Without it the pipeline still runs** — interviews score through the deterministic path with reduced confidence and route to human review (Bible 4.3). |
| `CONSENT_ENCRYPTION_KEY` | a strong random passphrase | Encrypts respondent phone numbers at rest (Bible Part 9). Respondent CSV import **refuses to run** without it. |
| `STORAGE_DIR` | optional, default `/data/callscore-evidence` | Where uploaded recordings live. **Attach a Railway Volume at `/data`** or recordings vanish on redeploy. |
| `SIMILARITY_THRESHOLD` | optional, default `0.7` | Tier 3 near-duplicate transcript threshold. |
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

- Whisper is **not validated** for Nigerian Pidgin / code-switched
  Yoruba/Igbo/Hausa-English (Bible Part 11 names this the top risk AND the
  moat) — run a dedicated evaluation before production reliance.
- Voice fingerprinting (Tier 3) remains unimplemented — it needs an
  enrolment flow; the pipeline treats it as absent capability.
- Speaker diarization is time-aligned but unlabelled (enumerator vs
  respondent separation is V1).
- Link's automatic call-state detection + BLE are V1 native work; MVP uses
  deliberate taps over the cloud relay (see `callscore/link/README.md`).
- The InsightScore handoff for call rows runs inside fieldscore-backend's
  drainer (PR #13), which must be merged/deployed for verified call
  interviews to flow onward.
