# ResearchOS — Security

## Philosophy
Secure by configuration; honest about trade-offs; fail loud, not silent. The
backend logs `[SECURITY]` warnings at startup for anything unsafe — visible in
deploy logs, never exposed on a public endpoint.

The authoritative operational checklist lives in the backend repo
(`fieldscore-backend/SECURITY.md`). Summary:

## Required in production
| Env var | Why |
|---|---|
| `JWT_SECRET` | **Critical** — default = forgeable tokens. |
| `MULTITENANCY_ENABLED=true` | Without it, `/api/*` reads return all orgs' data. |
| `WEBHOOK_SECRET` | Locks down webhook / batch / kobo / questionnaire. |
| `ADMIN_SECRET` | Protects `/admin/*`. |
| `KOBO_API_TOKEN` | Kobo pull/import + attachment fetch. |

## Hardened
- Auth + rate-limit on the OpenAI-calling questionnaire endpoint.
- Auth required on submission write actions (approve/reject/flag).
- Org isolation on the dashboard API when multi-tenancy is on.
- Startup insecure-config warnings.

## Known, accepted trade-offs (revisit for enterprise)
- **Media proxy is public** — browsers can't auth `<img>`/`<audio>`. Fix:
  short-lived signed URLs.
- **`/api/*` reads public** until multi-tenancy is enabled.
- **Auth store** is SQLite by default (ephemeral without a volume); Supabase is
  the durable option (`AUTH_BACKEND=supabase`).

*(To expand: threat model, data residency, PII handling, pen-test results.)*
