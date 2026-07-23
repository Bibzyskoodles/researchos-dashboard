"""Scorecard + supervisor queue endpoints, plus the Ada override audit log.
See docs/ARCHITECTURE_BIBLE.md Part 8.6 - supervisor queue is push-ranked,
not a browsable dashboard. Every item needs a 'why now' evidence pointer.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from uuid import UUID

from app import models
from app.db import get_db
from app.services import ada_voice

router = APIRouter()

_RISK_ORDER = {"high": 0, "medium": 1, "low": 2}


def _top_finding(db: Session, session_id) -> models.AgentFindingRow | None:
    return db.scalar(
        select(models.AgentFindingRow)
        .where(models.AgentFindingRow.interview_session_id == session_id)
        .order_by(models.AgentFindingRow.confidence.desc().nulls_last())
        .limit(1)
    )


@router.get("/{session_id}")
def get_scorecard(session_id: UUID, db: Session = Depends(get_db)):
    card = db.scalar(
        select(models.Scorecard).where(models.Scorecard.interview_session_id == session_id)
    )
    if card is None:
        raise HTTPException(status_code=404, detail="No scorecard for this session yet.")

    findings = db.scalars(
        select(models.AgentFindingRow)
        .where(models.AgentFindingRow.interview_session_id == session_id)
        .order_by(models.AgentFindingRow.confidence.desc().nulls_last())
    ).all()

    top = findings[0] if findings else None
    summary = ada_voice.render_scorecard_summary(
        card.fraud_risk, card.confidence_level, card.recommended_action,
        top.description if top else None,
    )  # deterministic register enforcement (Bible 4A.3)

    return {
        "interview_id": str(session_id),
        "overall_quality_score": card.overall_quality_score,
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
def get_supervisor_queue(project_id: UUID, db: Session = Depends(get_db)):
    """
    Interviews ranked by fraud_risk then confidence, each with a one-line
    'why now' derived from the highest-confidence agent finding. Never a
    raw unranked list.
    """
    rows = db.execute(
        select(models.Scorecard, models.InterviewSession)
        .join(models.InterviewSession, models.Scorecard.interview_session_id == models.InterviewSession.id)
        .where(models.InterviewSession.project_id == project_id)
    ).all()

    items = []
    for card, session in rows:
        if card.recommended_action == "none":
            continue  # push what needs attention, not everything
        top = _top_finding(db, session.id)
        why_now = (
            top.description
            if top
            else f"flagged {card.fraud_risk}-risk with no single dominant finding — needs a human look"
        )
        items.append(
            {
                "interview_id": str(session.id),
                "enumerator_id": str(session.enumerator_id),
                "fraud_risk": card.fraud_risk,
                "confidence_level": card.confidence_level,
                "recommended_action": card.recommended_action,
                "why_now": why_now,
            }
        )

    items.sort(key=lambda i: (_RISK_ORDER.get(i["fraud_risk"], 3), -(i["confidence_level"] or 0)))
    return {"project_id": str(project_id), "queue": items}


class OverrideIn(BaseModel):
    human_action_taken: str  # approve | reject | backcheck | escalate
    overridden_by: UUID      # user id of the deciding human
    reason: str


@router.post("/{session_id}/override")
def record_override(session_id: UUID, payload: OverrideIn, db: Session = Depends(get_db)):
    """
    Bible 4A.6: any human decision against Ada's recommendation must be
    logged with who, when, and a required free-text reason.
    """
    if not payload.reason.strip():
        raise HTTPException(status_code=422, detail="A reason is required for an override.")
    card = db.scalar(
        select(models.Scorecard).where(models.Scorecard.interview_session_id == session_id)
    )
    if card is None:
        raise HTTPException(status_code=404, detail="No scorecard for this session.")

    override = models.AdaOverride(
        interview_session_id=session_id,
        scorecard_id=card.id,
        ada_recommended_action=card.recommended_action,
        human_action_taken=payload.human_action_taken,
        overridden_by=payload.overridden_by,
        reason=payload.reason.strip(),
    )
    db.add(override)
    db.commit()
    return {"id": str(override.id), "status": "logged"}
