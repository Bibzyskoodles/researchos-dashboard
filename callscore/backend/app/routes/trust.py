"""Unified Enumerator Trust Record queries (Bible 4.6 / 4A.4 / 4A.5).

Cross-session history for one enumerator, across BOTH capture modes,
computed live from submissions — never cached (decision 3.1 in
docs/RECONCILIATION.md: the registry holds identity only; stats are always
derived from the rows, so they can't drift). This is Ada's institutional
memory: there is no separate "Ada memory" database.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.db import get_db

router = APIRouter()


@router.get("/{enumerator_ref}/history")
def enumerator_history(enumerator_ref: str, org_id: str = "", db: Session = Depends(get_db)):
    q = select(models.Submission).where(models.Submission.enumerator_id == enumerator_ref)
    if org_id:
        q = q.where(models.Submission.org_id == org_id)
    rows = db.scalars(q.order_by(models.Submission.created_at.desc()).limit(500)).all()

    call_ids = [s.submission_id for s in rows if s.collection_mode == "call"]
    cards = {
        c.submission_id: c
        for c in db.scalars(
            select(models.CallScorecard).where(models.CallScorecard.submission_id.in_(call_ids))
        ).all()
    } if call_ids else {}

    def bucket(mode: str) -> dict:
        subset = [s for s in rows if s.collection_mode == mode]
        scores = [s.overall_score for s in subset if s.overall_score is not None]
        return {
            "interviews": len(subset),
            "pass": sum(1 for s in subset if s.verdict == "PASS"),
            "flag": sum(1 for s in subset if s.verdict == "FLAG"),
            "reject": sum(1 for s in subset if s.verdict == "REJECT"),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
        }

    registry = db.scalar(
        select(models.Enumerator).where(models.Enumerator.enumerator_ref == enumerator_ref)
    )

    return {
        "enumerator_ref": enumerator_ref,
        "registered": registry is not None,
        "display_name": registry.display_name if registry else None,
        "field": bucket("field"),
        "call": bucket("call"),
        "recent": [
            {
                "submission_id": s.submission_id,
                "collection_mode": s.collection_mode,
                "project_id": s.project_id,
                "verdict": s.verdict,
                "grade": s.grade,
                "overall_score": s.overall_score,
                "fraud_risk": cards[s.submission_id].fraud_risk
                if s.submission_id in cards else None,
                "at": s.started_at or s.created_at,
            }
            for s in rows[:50]
        ],
    }
