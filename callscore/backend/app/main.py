"""
CallScore backend entrypoint.

Architecture reference: docs/ARCHITECTURE_BIBLE.md
Design Principle 1 (Part 3): no score without evidence — every route that
returns a scorecard must be able to trace back to agent_findings rows.
"""

import os

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.auth import require_auth, require_staff
from app.routes import interviews, projects, respondents, sync, scorecards, trust

app = FastAPI(
    title="CallScore API",
    description="AI-powered remote interview integrity platform.",
    version="0.1.0",
)

# Comma-separated list of allowed origins; defaults to the production
# dashboard plus localhost dev. Override with CORS_ORIGINS in Railway.
_cors_origins = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "https://researchos-dashboard.vercel.app,http://localhost:3000",
    ).split(",")
    if o.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routes require a valid FieldScore Bearer token (shared JWT_SECRET —
# see app/core/auth.py). Scorecards/queue/overrides and respondent PII are
# enumerator-identifying, so the external client role is blocked there too;
# interview capture routes only need any authenticated user (enumerators
# create sessions and upload bundles).
app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"],
                   dependencies=[Depends(require_staff)])
app.include_router(respondents.router, prefix="/api/v1/respondents", tags=["respondents"],
                   dependencies=[Depends(require_staff)])
app.include_router(interviews.router, prefix="/api/v1/interviews", tags=["interviews"],
                   dependencies=[Depends(require_auth)])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"],
                   dependencies=[Depends(require_auth)])
app.include_router(scorecards.router, prefix="/api/v1/scorecards", tags=["scorecards"],
                   dependencies=[Depends(require_staff)])
app.include_router(trust.router, prefix="/api/v1/enumerators", tags=["trust-record"],
                   dependencies=[Depends(require_staff)])


@app.get("/health")
def health():
    """Open probe. Reports which optional capabilities are configured so a
    deploy can be verified at a glance — names only, never key material."""
    from app.core import config
    from app.services import pii, stt

    return {
        "status": "ok",
        "capabilities": {
            "database": bool(config.DATABASE_URL),
            "auth": bool(os.getenv("JWT_SECRET")),
            "pii_encryption": pii.encryption_available(),
            "stt_providers": stt.configured_providers(),
            "llm_judgments": bool(config.OPENAI_API_KEY),
        },
    }
