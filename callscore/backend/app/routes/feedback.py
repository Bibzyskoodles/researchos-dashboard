"""Feedback loops.

1. Finding feedback (staff): supervisors confirm/reject individual AI
   findings on a scorecard. This is the calibration signal — per-agent
   precision computed live from it tells the team which agents to trust,
   which thresholds to tune, and (eventually) feeds automated weight
   adjustment. Append-only, like every judgment trail in this system.
2. App feedback (any authenticated user): field problems from the
   enumerator app / Link / dashboard reach the team as structured rows.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models
from app.core.auth import require_auth, require_staff
from app.db import get_db

router = APIRouter()


class FindingFeedbackIn(BaseModel):
    verdict: str  # correct | incorrect | unsure
    note: str | None = None


@router.post("/findings/{finding_id}")
def give_finding_feedback(
    finding_id: str,
    payload: FindingFeedbackIn,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    if payload.verdict not in ("correct", "incorrect", "unsure"):
        raise HTTPException(status_code=422, detail="verdict must be correct, incorrect or unsure.")
    finding = db.get(models.AgentFindingRow, finding_id)
    if finding is None:
        raise HTTPException(status_code=404, detail="Unknown finding.")
    entry = models.FindingFeedback(
        finding_id=finding.id,
        submission_id=finding.submission_id,
        agent_name=finding.agent_name,
        verdict=payload.verdict,
        note=(payload.note or "").strip() or None,
        given_by=auth.get("sub", "unknown"),
    )
    db.add(entry)
    db.commit()
    return {"id": entry.id, "status": "recorded"}


@router.get("/agent-stats")
def agent_stats(db: Session = Depends(get_db), auth: dict = Depends(require_staff)):
    """Live per-agent precision from supervisor feedback — which agents
    earn trust, which need tuning. Computed from rows, never cached (same
    no-drift stance as the trust record)."""
    rows = db.execute(
        select(
            models.FindingFeedback.agent_name,
            models.FindingFeedback.verdict,
            func.count(),
        ).group_by(models.FindingFeedback.agent_name, models.FindingFeedback.verdict)
    ).all()
    agents: dict[str, dict] = {}
    for agent_name, verdict, count in rows:
        a = agents.setdefault(agent_name, {"correct": 0, "incorrect": 0, "unsure": 0})
        a[verdict] = count
    out = []
    for name, counts in sorted(agents.items()):
        judged = counts["correct"] + counts["incorrect"]
        out.append({
            "agent_name": name,
            **counts,
            "precision": round(counts["correct"] / judged, 3) if judged else None,
            "sample_size": judged + counts["unsure"],
        })
    return {"agents": out}


class AppFeedbackIn(BaseModel):
    source: str  # mobile | link | dashboard
    message: str
    category: str | None = None


@router.post("")
def submit_app_feedback(
    payload: AppFeedbackIn,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    if payload.source not in ("mobile", "link", "dashboard"):
        raise HTTPException(status_code=422, detail="source must be mobile, link or dashboard.")
    if not payload.message.strip():
        raise HTTPException(status_code=422, detail="message cannot be empty.")
    entry = models.AppFeedback(
        source=payload.source,
        category=(payload.category or "").strip() or None,
        message=payload.message.strip()[:4000],
        submitted_by=auth.get("sub", "unknown"),
    )
    db.add(entry)
    db.commit()
    return {"id": entry.id, "status": "received"}


@router.get("")
def list_app_feedback(
    limit: int = 100,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    rows = db.scalars(
        select(models.AppFeedback).order_by(models.AppFeedback.created_at.desc())
        .limit(min(limit, 500))
    ).all()
    return {"feedback": [
        {"id": r.id, "source": r.source, "category": r.category,
         "message": r.message, "submitted_by": r.submitted_by, "at": r.created_at}
        for r in rows
    ]}
