# CallScore

The AI operating layer for remote research interview integrity.

Part of the Intelligency AI & Automation platform, alongside FieldScore
(in-person fieldwork verification) and InsightScore (research analysis).

## Start here

**Read `docs/ARCHITECTURE_BIBLE.md` before writing any code.** It is the
single source of truth for product vision, design principles, data schema,
AI agent architecture, and roadmap. Every file in this repo references it.

## Repo structure

```
docs/                    Architecture Bible and reference docs
backend/
  app/
    agents/              Tier 1-4 AI pipeline (see Bible Part 4)
    routes/              FastAPI endpoints
    core/                Config
    models/, db/          (to be populated: SQLAlchemy models)
    services/            (to be populated: business logic)
  migrations/            Postgres schema (0001_init.sql matches Bible Part 5)
frontend/
  src/
    pages/               SupervisorQueue, GlanceConfirm - the two screens
                          the Bible identifies as most critical (Part 8.5, 8.6)
    types/                Shared TS types mirroring backend response shapes
```

## Local development

```bash
cp backend/.env.example backend/.env   # fill in secrets
docker-compose up
```

Backend runs at `localhost:8000`, API docs at `localhost:8000/docs`.

```bash
cd frontend && npm install && npm run dev
```

## Design principles (non-negotiable — see Bible Part 3)

1. No score without evidence.
2. Consent is a hard gate, not a checkbox.
3. Deliberate human action at trust-critical moments (Start/Stop, consent, screenshot attach).
4. Communication-agnostic, forever — no dependency on any calling platform's API.
5. Offline-first, not offline-tolerant.
6. Minimum viable permission on every device integration.
7. Enumerator cognitive load is a tracked metric.
8. Fraud-relevant signals stay undisclosed/rotating — never fully game-able.

## Status

Pre-MVP. Repository scaffolding + architecture spec complete. Agent
implementations, database models, and frontend logic are stubbed with
`TODO`s referencing the relevant Bible section.
