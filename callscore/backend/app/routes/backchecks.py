"""AI back-check dispatch + provider webhook.

Back-checks verify a HUMAN interview happened as recorded — the AI agent
never conducts primary interviews (Bible 8.4; scope guard restated in
services/backcheck_agent.py). Dispatch is a deliberate staff action from
the scorecard, not automatic — a human decides which recommendation to
act on (Ada advises, humans decide).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.core.auth import require_staff
from app.db import get_db
from app.services import backcheck_agent, pii

router = APIRouter()


@router.post("/{submission_id}/dispatch")
def dispatch_backcheck(
    submission_id: str,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    if not backcheck_agent.available():
        raise HTTPException(status_code=503, detail="No voice-agent provider configured.")
    submission = db.get(models.Submission, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Unknown submission.")
    respondent = db.get(models.Respondent, submission.respondent_id or "")
    phone = pii.decrypt_pii(respondent.phone_number) if respondent else None
    if not phone or phone.startswith("••"):
        raise HTTPException(status_code=422, detail="No usable respondent phone number on file.")

    # Accessing respondent PII to place the call — audit it (Bible Part 9).
    db.add(models.AccessLogEntry(
        accessed_by=auth.get("sub", "unknown"),
        resource_type="respondent_pii",
        resource_id=submission.respondent_id or "",
        detail="backcheck dispatch",
    ))

    cfg = db.get(models.CallProjectConfig, submission.project_id or "")
    items = (
        db.query(models.QuestionnaireItem)
        .filter(models.QuestionnaireItem.project_id == submission.project_id)
        .order_by(models.QuestionnaireItem.sort_order).limit(3).all()
    )
    prompt = backcheck_agent.build_backcheck_prompt(
        respondent_name=respondent.display_name if respondent else "",
        interview_date=(submission.started_at or submission.created_at).strftime("%d %B"),
        topic_hints=[i.question_text for i in items],
        language=(cfg.stt_language or cfg.consent_language) if cfg else "en",
    )

    call = models.BackcheckCall(
        submission_id=submission_id, dispatched_by=auth.get("sub", "unknown"),
    )
    provider_call_id = backcheck_agent.dispatch_call(phone, prompt, submission_id)
    if provider_call_id:
        call.provider_call_id = provider_call_id
        call.status = "dispatched"
    else:
        call.status = "failed"
    db.add(call)
    db.commit()
    if call.status == "failed":
        raise HTTPException(status_code=502, detail="Voice-agent provider rejected the call.")
    return {"id": str(call.id), "status": call.status}


@router.get("/{submission_id}")
def list_backchecks(
    submission_id: str,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    rows = db.scalars(
        select(models.BackcheckCall)
        .where(models.BackcheckCall.submission_id == submission_id)
        .order_by(models.BackcheckCall.created_at.desc())
    ).all()
    return {"backchecks": [
        {"id": str(r.id), "status": r.status, "summary": r.summary,
         "created_at": r.created_at, "completed_at": r.completed_at}
        for r in rows
    ]}


@router.post("/webhook")
async def provider_webhook(request: Request, db: Session = Depends(get_db)):
    """End-of-call report from the voice-agent provider. Secured by shared
    secret (VAPI_WEBHOOK_SECRET) rather than user auth — the provider is
    the caller. The transcript lands as evidence on the interview so the
    supervisor sees the back-check result next to the original findings."""
    if backcheck_agent.VAPI_WEBHOOK_SECRET:
        if request.headers.get("x-vapi-secret", "") != backcheck_agent.VAPI_WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Bad webhook secret.")
    payload = await request.json()
    message = payload.get("message", payload)
    if message.get("type") not in ("end-of-call-report", "call-ended", None):
        return {"ok": True}  # ignore mid-call events

    call_info = message.get("call", {})
    submission_id = (call_info.get("metadata") or message.get("metadata") or {}).get("submission_id")
    provider_call_id = call_info.get("id") or message.get("callId")

    row = None
    if provider_call_id:
        row = db.scalar(select(models.BackcheckCall).where(
            models.BackcheckCall.provider_call_id == str(provider_call_id)))
    if row is None and submission_id:
        row = db.scalar(
            select(models.BackcheckCall)
            .where(models.BackcheckCall.submission_id == submission_id,
                   models.BackcheckCall.status == "dispatched")
            .order_by(models.BackcheckCall.created_at.desc())
        )
    if row is None:
        return {"ok": True}  # unknown call — accept silently, never 500 a provider

    row.status = "completed"
    row.completed_at = datetime.now(timezone.utc)
    row.transcript = message.get("transcript") or message.get("artifact", {}).get("transcript")
    analysis = message.get("analysis") or {}
    row.summary = analysis.get("summary") or message.get("summary")
    row.result = analysis or None

    db.add(models.AgentFindingRow(
        submission_id=row.submission_id,
        agent_name="backcheck_agent",
        finding_type="backcheck_result",
        description=(row.summary or "Back-check call completed — transcript attached.")[:1000],
        confidence=0,  # informational: a human reads it; it never moves a score
        raw_output={"backcheck_call_id": str(row.id), "analysis": analysis},
    ))
    db.commit()
    return {"ok": True}
