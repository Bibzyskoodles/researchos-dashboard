"""Agent mode — AI-conducted interviews (Bible Part 12, Revision 2).

Optional and doubly gated (12.2). The webhook is the consent state
machine (12.3): consent_given must be affirmed in the end-of-call
analysis or nothing is retained or analyzed — the attempt is recorded
as declined and the transcript discarded.
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.agents import orchestrator
from app.core.auth import require_staff
from app.db import get_db
from app.services import ai_interviewer, backcheck_agent, pii

log = logging.getLogger(__name__)
router = APIRouter()


class AgentDispatchIn(BaseModel):
    respondent_id: str
    org_name: str = ""


@router.post("/{project_id}/dispatch")
def dispatch_agent_interview(
    project_id: str,
    payload: AgentDispatchIn,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    if not ai_interviewer.enabled():
        raise HTTPException(
            status_code=503,
            detail="Agent mode is not enabled (AGENT_MODE_ENABLED + voice-agent provider required).",
        )
    respondent = db.get(models.Respondent, payload.respondent_id)
    if respondent is None or respondent.project_id != project_id:
        raise HTTPException(status_code=404, detail="Unknown respondent for this project.")
    phone = pii.decrypt_pii(respondent.phone_number)
    if not phone or phone.startswith("••"):
        raise HTTPException(status_code=422, detail="No usable respondent phone number on file.")

    cfg = db.get(models.CallProjectConfig, project_id)
    if cfg is None or not cfg.consent_script.strip():
        raise HTTPException(
            status_code=422,
            detail="Project needs a consent script (call-config) before agent interviews.",
        )
    items = (
        db.query(models.QuestionnaireItem)
        .filter(models.QuestionnaireItem.project_id == project_id)
        .order_by(models.QuestionnaireItem.sort_order).all()
    )
    if not items:
        raise HTTPException(status_code=422, detail="Project has no questionnaire imported.")

    db.add(models.AccessLogEntry(
        accessed_by=auth.get("sub", "unknown"),
        resource_type="respondent_pii", resource_id=respondent.id,
        detail="agent interview dispatch",
    ))

    import uuid as _uuid
    submission_id = str(_uuid.uuid4())
    started = datetime.now(timezone.utc)
    db.add(models.Submission(
        submission_id=submission_id,
        org_id=respondent.org_id, project_id=project_id,
        enumerator_id=None,  # no enumerator — never touches a trust record (12.1)
        respondent_id=respondent.id,
        collection_mode="agent",
        started_at=started, consent_captured=False,  # flips ONLY on verbal consent
        sync_status="pending",
    ))

    language = cfg.stt_language or cfg.consent_language or "en"
    prompt = ai_interviewer.build_interview_prompt(
        org_name=payload.org_name, consent_script=cfg.consent_script,
        questions=[{"question_key": i.question_key, "question_text": i.question_text,
                    "is_required": i.is_required} for i in items],
        language=language,
    )
    first_message = (
        "Hello! I'm an AI assistant calling on behalf of "
        f"{payload.org_name or 'a research organisation'} about a research survey. "
        "Before anything else, I need to ask for your consent — is now an okay time?"
    )
    call = models.AgentInterviewCall(
        submission_id=submission_id, dispatched_by=auth.get("sub", "unknown"),
    )
    provider_call_id = ai_interviewer.dispatch_interview(
        phone, prompt, submission_id, first_message,
    )
    if provider_call_id:
        call.provider_call_id = provider_call_id
        call.status = "dispatched"
    else:
        call.status = "failed"
    db.add(call)
    db.commit()
    if call.status == "failed":
        raise HTTPException(status_code=502, detail="Voice-agent provider rejected the call.")
    return {"submission_id": submission_id, "status": call.status}


@router.get("/{project_id}")
def list_agent_interviews(
    project_id: str,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_staff),
):
    rows = db.execute(
        select(models.AgentInterviewCall, models.Submission)
        .join(models.Submission,
              models.AgentInterviewCall.submission_id == models.Submission.submission_id)
        .where(models.Submission.project_id == project_id)
        .order_by(models.AgentInterviewCall.created_at.desc())
        .limit(200)
    ).all()
    return {"agent_interviews": [
        {"submission_id": c.submission_id, "respondent_id": s.respondent_id,
         "status": c.status, "verdict": s.verdict, "grade": s.grade,
         "created_at": c.created_at, "completed_at": c.completed_at}
        for c, s in rows
    ]}


@router.post("/webhook")
async def provider_webhook(request: Request, db: Session = Depends(get_db)):
    """End-of-call report — the consent state machine. No affirmed consent
    => status consent_declined, transcript discarded, no analysis (12.3)."""
    if backcheck_agent.VAPI_WEBHOOK_SECRET:
        if request.headers.get("x-vapi-secret", "") != backcheck_agent.VAPI_WEBHOOK_SECRET:
            raise HTTPException(status_code=401, detail="Bad webhook secret.")
    payload = await request.json()
    message = payload.get("message", payload)
    if message.get("type") not in ("end-of-call-report", "call-ended", None):
        return {"ok": True}

    call_info = message.get("call", {})
    submission_id = (call_info.get("metadata") or message.get("metadata") or {}).get("submission_id")
    provider_call_id = call_info.get("id") or message.get("callId")

    row = None
    if provider_call_id:
        row = db.scalar(select(models.AgentInterviewCall).where(
            models.AgentInterviewCall.provider_call_id == str(provider_call_id)))
    if row is None and submission_id:
        row = db.scalar(select(models.AgentInterviewCall).where(
            models.AgentInterviewCall.submission_id == submission_id))
    if row is None:
        return {"ok": True}
    submission = db.get(models.Submission, row.submission_id)
    if submission is None:
        return {"ok": True}

    analysis = message.get("analysis") or {}
    structured = analysis.get("structuredData") or analysis.get("structured_data") or {}
    consent_raw = str(structured.get("consent_given", analysis.get("consent_given", ""))).lower()
    consent_given = consent_raw in ("yes", "true", "1")

    row.completed_at = datetime.now(timezone.utc)
    submission.stopped_at = row.completed_at

    if not consent_given:
        # Hard gate (12.3): retain only the fact of decline — no transcript,
        # no recording reference, no analysis, no scoring.
        row.status = "consent_declined"
        row.transcript = None
        row.recording_url = None
        row.result = {"consent_given": False}
        submission.sync_status = "failed"
        db.commit()
        return {"ok": True}

    row.status = "completed"
    row.transcript = message.get("transcript") or message.get("artifact", {}).get("transcript")
    row.recording_url = (message.get("recordingUrl")
                         or message.get("artifact", {}).get("recordingUrl"))
    row.result = analysis or None
    submission.consent_captured = True
    submission.sync_status = "synced"

    # Evidence: verbal consent is part of the recorded call itself.
    db.add(models.EvidenceArtifact(
        submission_id=row.submission_id, artifact_type="consent_recording",
        payload={"kind": "verbal_in_call", "recording_url": row.recording_url,
                 "consent_given": True},
    ))
    if row.recording_url:
        db.add(models.EvidenceArtifact(
            submission_id=row.submission_id, artifact_type="audio",
            storage_ref=row.recording_url,  # provider-hosted; mirrored later if needed
        ))
    answers = structured.get("answers") if isinstance(structured.get("answers"), dict) else None
    if answers:
        db.add(models.EvidenceArtifact(
            submission_id=row.submission_id, artifact_type="questionnaire_response",
            payload=answers,
        ))
    # Seed the transcript so the pipeline's Tier 2 agents can run without
    # re-transcribing provider audio.
    if row.transcript:
        db.add(models.AgentFindingRow(
            submission_id=row.submission_id,
            agent_name="transcription_diarization",
            finding_type="transcript",
            description="Transcript from voice-agent provider (agent mode).",
            confidence=0,
            raw_output={"text": row.transcript, "segments": [],
                        "provider": "vapi", "agreement": None},
        ))
    db.commit()

    try:
        orchestrator.run_pipeline(db, row.submission_id)
    except Exception:
        log.exception("agent-mode pipeline failed for %s", row.submission_id)
    return {"ok": True}
