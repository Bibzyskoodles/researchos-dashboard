"""
CallScore backend entrypoint.

Architecture reference: docs/ARCHITECTURE_BIBLE.md
Design Principle 1 (Part 3): no score without evidence — every route that
returns a scorecard must be able to trace back to agent_findings rows.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import interviews, projects, respondents, sync, scorecards

app = FastAPI(
    title="CallScore API",
    description="AI-powered remote interview integrity platform.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before production
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router, prefix="/api/v1/projects", tags=["projects"])
app.include_router(respondents.router, prefix="/api/v1/respondents", tags=["respondents"])
app.include_router(interviews.router, prefix="/api/v1/interviews", tags=["interviews"])
app.include_router(sync.router, prefix="/api/v1/sync", tags=["sync"])
app.include_router(scorecards.router, prefix="/api/v1/scorecards", tags=["scorecards"])


@app.get("/health")
def health():
    return {"status": "ok"}
