"""Scorecard + supervisor queue endpoints, plus the shared override audit log.
See docs/ARCHITECTURE_BIBLE.md Part 8.6 - supervisor queue is push-ranked,
not a browsable dashboard. Every item needs a 'why now' evidence pointer.
Reconciled onto FieldScore's submissions table (docs/RECONCILIATION.md).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.services import ada_voice

router = APIRouter()

_RISK_ORDER = {"high": 0, "medium": 1, "low": 2}


def _top_finding(db: Session, submission_id: str) -> models.AgentFindingRow | None:
    return db.scalar(
        select(models.AgentFindingRow)
        .where(models.AgentFindingRow.submission_id == submission_id)
        .order_by(models.AgentFindingRow.confidence.desc().nulls_last())
        .limit(1)
    )


@router.get("/{submission_id}")
def get_scorecard(submission_id: str, db: Session = Depends(get_db)):
    card = db.get(models.CallScorecard, submission_id)
    if card is None:
        raise HTTPException(status_code=404, detail="No scorecard for this session yet.")
    submission = db.get(models.Submission, submission_id)

    findings = db.scalars(
        select(models.AgentFindingRow)
        .where(models.AgentFindingRow.submission_id == submission_id)
        .order_by(models.AgentFindingRow.confidence.desc().nulls_last())
    ).all()

    top = findings[0] if findings else None
    summary = ada_voice.render_scorecard_summary(
        card.fraud_risk, card.confidence_level, card.recommended_action,
        top.description if top else None,
    )  # deterministic register enforcement (Bible 4A.3)

    return {
        "interview_id": submission_id,
        # Headline shared vocabulary (lives on submissions):
        "overall_quality_score": submission.overall_score if submission else None,
        "verdict": submission.verdict if submission else None,
        "grade": submission.grade if submission else None,
        # Call-specific sub-scores:
        "authenticity_score": card.authenticity_score,
        "compliance_score": card.compliance_score,
        "behaviour_score": card.behaviour_score,
        "fraud_risk": card.fraud_risk,
        "confidence_level": card.confidence_level,
        "recommended_action": card.recommended_action,
        "late_start_flag": card.late_start_flag,
        "early_stop_flag": card.early_stop_flag,
        "ada_summary": {"register": summary["register"], "text": summary["text"]},
        "evidence": [
            {
                "id": str(f.id),
                "agent": f.agent_name,
                "type": f.finding_type,
                "description": f.description,
                "timestamp_range": [f.timestamp_range_start, f.timestamp_range_end],
                "confidence": f.confidence,
            }
            for f in findings
        ],
    }


@router.get("/queue/{project_id}")
def get_supervisor_queue(project_id: str, db: Session = Depends(get_db)):
    """
    Call-mode interviews ranked by fraud_risk then confidence, each with a
    one-line 'why now' derived from the highest-confidence agent finding.
    Never a raw unranked list.
    """
    rows = db.execute(
        select(models.CallScorecard, models.Submission)
        .join(models.Submission, models.CallScorecard.submission_id == models.Submission.submission_id)
        .where(models.Submission.project_id == project_id)
    ).all()

    items = []
    for card, submission in rows:
        if card.recommended_action == "none":
            continue  # push what needs attention, not everything
        top = _top_finding(db, card.submission_id)
        why_now = (
            top.description
            if top
            else f"flagged {card.fraud_risk}-risk with no single dominant finding — needs a human look"
        )
        items.append(
            {
                "interview_id": card.submission_id,
                "enumerator_id": submission.enumerator_id,
                "fraud_risk": card.fraud_risk,
                "confidence_level": card.confidence_level,
                "recommended_action": card.recommended_action,
                "why_now": why_now,
            }
        )

    items.sort(key=lambda i: (_RISK_ORDER.get(i["fraud_risk"], 3), -(i["confidence_level"] or 0)))
    return {"project_id": project_id, "queue": items}


class OverrideIn(BaseModel):
    human_action: str    # approve | reject | backcheck | escalate
    overridden_by: str   # FieldScore user id
    reason: str


@router.post("/{submission_id}/override")
def record_override(submission_id: str, payload: OverrideIn, db: Session = Depends(get_db)):
    """
    Shared append-only override audit (decision 3.3, Bible 4A.6): any human
    decision against the system's recommendation is logged with who, when,
    and a required free-text reason. This endpoint covers call mode;
    fieldscore-backend's override path appends field-mode entries.
    """
    if not payload.reason.strip():
        raise HTTPException(status_code=422, detail="A reason is required for an override.")
    card = db.get(models.CallScorecard, submission_id)
    if card is None:
        raise HTTPException(status_code=404, detail="No scorecard for this session.")
    submission = db.get(models.Submission, submission_id)

    entry = models.OverrideLogEntry(
        submission_id=submission_id,
        source_mode="call",
        recommended_action=card.recommended_action,
        previous_verdict=submission.verdict if submission else None,
        human_action=payload.human_action,
        overridden_by=payload.overridden_by,
        reason=payload.reason.strip(),
    )
    db.add(entry)
    db.commit()
    return {"id": str(entry.id), "status": "logged"}
