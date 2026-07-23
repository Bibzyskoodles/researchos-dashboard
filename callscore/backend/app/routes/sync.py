"""Offline evidence bundle sync endpoint.
See docs/ARCHITECTURE_BIBLE.md Part 5.3 - idempotent on the client-generated
submission id, Part 6.4 - evidence bundle uploads whenever connectivity
returns. Reconciled onto FieldScore's submissions table (RECONCILIATION.md).
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

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


@router.post("/{submission_id}/evidence-bundle")
def upload_evidence_bundle(
    submission_id: str, bundle: EvidenceBundleIn, db: Session = Depends(get_db)
):
    """
    Accepts the full offline-captured bundle for one interview session.
    Idempotent: if this submission_id was already fully uploaded, returns
    the existing status rather than reprocessing or duplicating.
    """
    submission = db.get(models.Submission, submission_id)
    if submission is None or submission.collection_mode != "call":
        raise HTTPException(status_code=404, detail="Unknown call-mode interview session.")

    entry = db.scalar(
        select(models.SyncQueueEntry).where(
            models.SyncQueueEntry.submission_id == submission_id
        )
    )
    if entry is not None and entry.upload_status == "complete":
        return {"submission_id": submission_id, "status": submission.sync_status, "idempotent": True}

    # Consent hard gate (Bible Part 7): the bundle must contain a consent
    # recording or the upload is rejected outright — no partial ingest.
    types = {a.artifact_type for a in bundle.artifacts}
    if "consent_recording" not in types:
        raise HTTPException(
            status_code=422,
            detail="Evidence bundle rejected: consent_recording artifact is required.",
        )

    if entry is None:
        entry = models.SyncQueueEntry(submission_id=submission_id)
        db.add(entry)
    entry.upload_status = "uploading"
    entry.attempts += 1

    for a in bundle.artifacts:
        db.add(
            models.EvidenceArtifact(
                submission_id=submission_id,
                artifact_type=a.artifact_type,
                storage_ref=a.storage_ref,
                payload=a.payload,
                timestamp_range_start=a.timestamp_range_start,
                timestamp_range_end=a.timestamp_range_end,
            )
        )
    submission.sync_status = "synced"
    entry.upload_status = "complete"
    db.commit()

    # MVP: run the pipeline inline. Production: enqueue a Celery task here
    # and return immediately with status 'queued' (Bible 4.3). InsightScore
    # handoff then goes through fieldscore-backend's insightscore_outbox.
    try:
        orchestrator.run_pipeline(db, submission_id)
    except PermissionError as e:
        raise HTTPException(status_code=422, detail=str(e))

    return {"submission_id": submission_id, "status": "processed"}
