"""Scorecard + supervisor queue endpoints, plus the shared override audit log.
See docs/ARCHITECTURE_BIBLE.md Part 8.6 - supervisor queue is push-ranked,
not a browsable dashboard. Every item needs a 'why now' evidence pointer.
Reconciled onto FieldScore's submissions table (docs/RECONCILIATION.md).
"""
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.services import ada_voice, storage

_EVIDENCE_MEDIA_TYPES = {
    ".webm": "audio/webm", ".wav": "audio/wav", ".m4a": "audio/mp4",
    ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".amr": "audio/amr",
    ".mp4": "audio/mp4", ".png": "image/png", ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}

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

    # The "answers heard" section must read top-to-bottom like the
    # questionnaire — confidence order (right for risk evidence) makes
    # extracted answers appear shuffled. Reorder just those findings by
    # the questionnaire's sort_order; everything else keeps its ranking.
    question_order: dict[str, int] = {}
    if submission and submission.project_id:
        keys = db.scalars(
            select(models.QuestionnaireItem.question_key)
            .where(models.QuestionnaireItem.project_id == submission.project_id)
            .order_by(models.QuestionnaireItem.sort_order)
        ).all()
        question_order = {k: i for i, k in enumerate(keys)}

    def _question_pos(f: models.AgentFindingRow) -> int:
        key = (f.raw_output or {}).get("question_key")
        return question_order.get(key, len(question_order))

    extracted = sorted(
        (f for f in findings if f.finding_type == "extracted_answer"), key=_question_pos
    )
    findings = [f for f in findings if f.finding_type != "extracted_answer"] + extracted

    top = findings[0] if findings else None
    summary = ada_voice.render_scorecard_summary(
        card.fraud_risk, card.confidence_level, card.recommended_action,
        top.description if top else None,
    )  # deterministic register enforcement (Bible 4A.3)

    # Identity header — a scorecard must say WHICH interview it judges.
    respondent = db.get(models.Respondent, submission.respondent_id) if submission and submission.respondent_id else None
    duration_seconds = None
    if submission and submission.started_at and submission.stopped_at:
        delta = (submission.stopped_at - submission.started_at).total_seconds()
        if delta > 0:
            duration_seconds = int(delta)

    return {
        "interview_id": submission_id,
        "interview": {
            "respondent_name": respondent.display_name if respondent else None,
            "enumerator_id": submission.enumerator_id if submission else None,
            "started_at": submission.started_at.isoformat() if submission and submission.started_at else None,
            "duration_seconds": duration_seconds,
        },
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
        # Evidence files a supervisor can open directly from the scorecard —
        # "review the recording" must come with a play button, not a chase.
        "recordings": sorted(storage.list_saved_files(submission_id).keys()),
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

    # One query for every queue item's top finding (was an N+1 — one
    # lookup per row — before Wave 1.5 hardening).
    actionable = [(c, s) for c, s in rows if c.recommended_action != "none"]
    top_by_submission: dict[str, models.AgentFindingRow] = {}
    if actionable:
        for f in db.scalars(
            select(models.AgentFindingRow)
            .where(models.AgentFindingRow.submission_id.in_(
                [c.submission_id for c, _ in actionable]))
            .order_by(models.AgentFindingRow.confidence.desc().nulls_last())
        ):
            top_by_submission.setdefault(f.submission_id, f)

    # Batch respondent-name lookup (avoids a per-row query).
    respondent_names: dict[str, str | None] = {}
    rids = [s.respondent_id for _, s in actionable if s.respondent_id]
    if rids:
        for r in db.scalars(select(models.Respondent).where(models.Respondent.id.in_(rids))):
            respondent_names[r.id] = r.display_name

    items = []
    for card, submission in actionable:
        top = top_by_submission.get(card.submission_id)
        why_now = (
            top.description
            if top
            else f"flagged {card.fraud_risk}-risk with no single dominant finding — needs a human look"
        )
        items.append(
            {
                "interview_id": card.submission_id,
                "enumerator_id": submission.enumerator_id,
                "respondent_name": respondent_names.get(submission.respondent_id),
                "started_at": submission.started_at.isoformat() if submission.started_at else None,
                "fraud_risk": card.fraud_risk,
                "confidence_level": card.confidence_level,
                "recommended_action": card.recommended_action,
                "why_now": why_now,
            }
        )

    # Newest first, so "which one just came in" is always the top card;
    # risk stays visible on the badge rather than driving the sort.
    items.sort(key=lambda i: i["started_at"] or "", reverse=True)
    return {"project_id": project_id, "queue": items}


@router.get("/{submission_id}/evidence-file/{kind}")
def get_evidence_file(submission_id: str, kind: str):
    """Stream a stored evidence file (call audio, consent recording, call
    screenshot) to an authenticated staff user. No public URLs exist for
    evidence (Bible Part 9) — access always passes through router auth."""
    files = storage.list_saved_files(submission_id)
    ref = files.get(kind)
    path = storage.resolve_storage_ref(ref) if ref else None
    if path is None:
        raise HTTPException(status_code=404, detail="No such evidence file for this interview.")
    return FileResponse(
        path,
        media_type=_EVIDENCE_MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream"),
        filename=path.name,
    )


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
