"""
Interview session lifecycle.

Matches docs/ARCHITECTURE_BIBLE.md Part 2.3 (Interview Session Lifecycle)
and Part 5.3 (Sync Queue Design).

interview_session_id is CLIENT-GENERATED (UUID) so that offline-created
sessions can sync later without server round-trips, and retried uploads
are idempotent — never insert a duplicate for the same id.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from uuid import UUID

from app import models
from app.db import get_db
from app.services import scoring

router = APIRouter()


class InterviewSessionCreate(BaseModel):
    id: UUID  # client-generated
    project_id: UUID
    enumerator_id: UUID
    respondent_id: UUID
    started_at: datetime
    consent_captured: bool
    integration_mode: str = "standalone"


class InterviewSessionStop(BaseModel):
    stopped_at: datetime
    device1_call_started_at: Optional[datetime] = None
    device1_call_ended_at: Optional[datetime] = None


@router.post("/")
def create_interview_session(payload: InterviewSessionCreate, db: Session = Depends(get_db)):
    """
    Start Interview. Design Principle 2 (Part 3): consent_captured must be
    true or this session cannot proceed to evidence upload / analysis.
    """
    if not payload.consent_captured:
        raise HTTPException(
            status_code=422,
            detail="Consent must be captured before an interview session can start.",
        )
    existing = db.get(models.InterviewSession, payload.id)
    if existing is not None:
        # Idempotent retry: same client-generated id, return existing state.
        return {"id": str(existing.id), "status": "started", "idempotent": True}

    session = models.InterviewSession(
        id=payload.id,
        project_id=payload.project_id,
        enumerator_id=payload.enumerator_id,
        respondent_id=payload.respondent_id,
        started_at=payload.started_at,
        consent_captured=payload.consent_captured,
        integration_mode=payload.integration_mode,
    )
    db.add(session)
    db.commit()
    return {"id": str(session.id), "status": "started"}


@router.post("/{session_id}/stop")
def stop_interview_session(
    session_id: UUID, payload: InterviewSessionStop, db: Session = Depends(get_db)
):
    """
    Stop Interview. Runs the late-start/early-stop discrepancy check against
    device1_call_started_at / device1_call_ended_at (Part 6.5). Flags are
    also recomputed at scoring time; surfacing them here lets the app show
    the enumerator immediately that the session will carry a timing flag.
    """
    session = db.get(models.InterviewSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown interview session.")

    session.stopped_at = payload.stopped_at
    session.device1_call_started_at = payload.device1_call_started_at
    session.device1_call_ended_at = payload.device1_call_ended_at
    db.commit()

    late_start, early_stop = scoring.detect_timing_flags(
        session.started_at,
        session.stopped_at,
        session.device1_call_started_at,
        session.device1_call_ended_at,
    )
    return {
        "id": str(session.id),
        "status": "stopped",
        "late_start_flag": late_start,
        "early_stop_flag": early_stop,
    }


@router.get("/{session_id}")
def get_interview_session(session_id: UUID, db: Session = Depends(get_db)):
    session = db.get(models.InterviewSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown interview session.")
    return {
        "id": str(session.id),
        "project_id": str(session.project_id),
        "enumerator_id": str(session.enumerator_id),
        "respondent_id": str(session.respondent_id),
        "started_at": session.started_at,
        "stopped_at": session.stopped_at,
        "consent_captured": session.consent_captured,
        "sync_status": session.sync_status,
        "evidence_artifacts": [
            {
                "id": str(a.id),
                "artifact_type": a.artifact_type,
                "storage_ref": a.storage_ref,
                "created_at": a.created_at,
            }
            for a in session.evidence_artifacts
        ],
        "scorecard_available": session.scorecard is not None,
    }
