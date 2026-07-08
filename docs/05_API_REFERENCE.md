# ResearchOS — API Reference

A working index of the HTTP surface. *(To expand: request/response schemas per
endpoint.)*

## FieldScore — `fieldscore-backend` (Flask, Railway)
Base: `https://web-production-f5bab.up.railway.app`

**Health / auth**
- `GET  /` — health + storage/security posture (server logs carry `[SECURITY]` warnings)
- `POST /auth/login`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/change-password`

**Intake**
- `POST /webhook/<org_id>` — platform webhook (push)
- `POST /batch` — batch scoring
- `GET  /kobo/ping` — verify token + list forms
- `GET  /kobo/forms/<uid>/preview` — normalised sample, no scoring
- `POST /kobo/import` — fetch + score a Kobo form (pull)

**Dashboard data** (`/api`, org-scoped when `MULTITENANCY_ENABLED`)
- `GET  /api/dashboard`, `/api/submissions`, `/api/submissions/<id>`,
  `/api/enumerators`, `/api/stats`
- `POST /api/submissions/<id>/action` — approve / reject / flag (auth required)
- `GET  /api/media/<id>/<image|audio>` — evidence proxy

**Intelligence**
- `POST /questionnaire/generate` — AI questionnaire (auth + rate-limited)

**Admin** (`X-Admin-Secret`)
- `POST /admin/create-client`, `/admin/reset-password`, `/admin/suspend-client`, `GET /admin/...`

## InsightScore — `insightscore` (FastAPI, Railway)
Base: `https://insightscore-production.up.railway.app`
- `POST /projects`, `POST /projects/{id}/upload`, `POST /projects/{id}/ingest`
- `GET  /projects/{id}/submissions`, `POST /projects/{id}/analyse`, `GET /projects/{id}/status`
- `GET  /projects/{id}/report` — JSON, or `?format=docx|pptx|xlsx` for a file

## Auth
JWT (HS256) in `Authorization: Bearer <token>` or the `fs_token` cookie. Payload
carries `{ sub, org, role, exp }`. Server-to-server endpoints accept the webhook
or admin secret.
