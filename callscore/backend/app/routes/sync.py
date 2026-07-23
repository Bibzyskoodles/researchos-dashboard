"""Offline evidence bundle sync endpoint.
See docs/ARCHITECTURE_BIBLE.md Part 5.3 - idempotent on interview_session_id,
Part 6.4 - evidence bundle uploads whenever connectivity returns.
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from uuid import UUID

from app import models
from app.agents import orchestrator
from app.db import get_db

router = APIRouter()


class EvidenceArtifactIn(BaseModel):
    artifact_type: str  # audio | consent_recording | ble_call_state_log | screenshot_extracted_fields | questionnaire_response
    storage_ref: Optional[str] = None
    payload: Optional[dict] = None
    timestamp_range_start: Optional[int] = None
    timestamp_range_end: Optional[int] = None


class EvidenceBundleIn(BaseModel):
    artifacts: list[EvidenceArtifactIn]


@router.post("/{session_id}/evidence-bundle")
def upload_evidence_bundle(
    session_id: UUID, bundle: EvidenceBundleIn, db: Session = Depends(get_db)
):
    """
    Accepts the full offline-captured bundle for one interview session.
    Idempotent: if this session_id was already fully uploaded, returns the
    existing status rather than reprocessing or duplicating.
    """
    session = db.get(models.InterviewSession, session_id)
    if session is None:
        raise HTTPException(status_code=404, detail="Unknown interview session.")

    entry = db.scalar(
        select(models.SyncQueueEntry).where(
            models.SyncQueueEntry.interview_session_id == session_id
        )
    )
    if entry is not None and entry.upload_status == "complete":
        return {"session_id": str(session_id), "status": session.sync_status, "idempotent": True}

    # Consent hard gate (Bible Part 7): the bundle must contain a consent
    # recording or the upload is rejected outright — no partial ingest.
    types = {a.artifact_type for a in bundle.artifacts}
    if "consent_recording" not in types:
        raise HTTPException(
            status_code=422,
            detail="Evidence bundle rejected: consent_recording artifact is required.",
        )

    if entry is None:
        entry = models.SyncQueueEntry(interview_session_id=session_id)
        db.add(entry)
    entry.upload_status = "uploading"
    entry.attempts += 1

    for a in bundle.artifacts:
        db.add(
            models.EvidenceArtifact(
                interview_session_id=session_id,
                artifact_type=a.artifact_type,
                storage_ref=a.storage_ref,
                payload=a.payload,
                timestamp_range_start=a.timestamp_range_start,
                timestamp_range_end=a.timestamp_range_end,
            )
        )
    session.sync_status = "synced"
    entry.upload_status = "complete"
    db.commit()

    # MVP: run the pipeline inline. Production: enqueue a Celery task here
    # and return immediately with status 'queued' (Bible 4.3).
    try:
        orchestrator.run_pipeline(db, str(session_id))
    except PermissionError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {"session_id": str(session_id), "status": "processed"}
