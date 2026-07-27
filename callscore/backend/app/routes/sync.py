"""Offline evidence bundle sync endpoint.
See docs/ARCHITECTURE_BIBLE.md Part 5.3 - idempotent on the client-generated
submission id, Part 6.4 - evidence bundle uploads whenever connectivity
returns. Reconciled onto FieldScore's submissions table (RECONCILIATION.md).
"""
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.agents import orchestrator
from app.db import get_db
from app.services import storage

router = APIRouter()


@router.post("/{submission_id}/upload-recording")
async def upload_recording(
    submission_id: str,
    kind: str = Form(...),  # 'audio' | 'consent_recording'
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """
    Raw recording bytes for one session (audio or the standalone consent
    recording — Bible Part 7). Called by the enumerator app BEFORE the
    evidence-bundle JSON, so the bundle can reference the stored file.
    Idempotent: re-uploading the same kind overwrites the same path.
    """
    submission = db.get(models.Submission, submission_id)
    if submission is None or submission.collection_mode != "call":
        raise HTTPException(status_code=404, detail="Unknown call-mode interview session.")
    # call_screen: the enumerator's screenshot of the phone's call screen —
    # number, duration and timestamp in one image, the ironclad companion
    # to the typed number (upgraded from fields-only by founder decision).
    if kind not in ("audio", "consent_recording", "call_screen"):
        raise HTTPException(status_code=422, detail="kind must be 'audio', 'consent_recording' or 'call_screen'.")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=422, detail="Empty file.")
    ref = storage.save_artifact_file(submission_id, kind, data, file.filename or "recording.m4a")
    return {"submission_id": submission_id, "kind": kind, "storage_ref": ref, "bytes": len(data)}


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
    try:
        submission = db.get(models.Submission, submission_id)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"DB lookup failed: {exc}")
    if submission is None or submission.collection_mode != "call":
        raise HTTPException(status_code=404, detail="Unknown call-mode interview session.")

    try:
        entry = db.scalar(
            select(models.SyncQueueEntry).where(
                models.SyncQueueEntry.submission_id == submission_id
            )
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"sync_queue query failed: {exc}")
    if entry is not None and entry.upload_status == "complete":
        if not submission.consent_captured:
            submission.consent_captured = True
            submission.sync_status = "synced"
            db.commit()
        return {"submission_id": submission_id, "status": submission.sync_status, "idempotent": True}

    # Consent hard gate (Bible Part 7): the bundle must contain a consent
    # recording or the upload is rejected outright — no partial ingest.
    types = {a.artifact_type for a in bundle.artifacts}
    if "consent_recording" not in types:
        raise HTTPException(
            status_code=422,
            detail="Evidence bundle rejected: consent_recording artifact is required.",
        )

    try:
        if entry is None:
            entry = models.SyncQueueEntry(submission_id=submission_id)
            db.add(entry)
        entry.upload_status = "uploading"
        entry.attempts = (entry.attempts or 0) + 1

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
        submission.consent_captured = True
        submission.sync_status = "synced"
        entry.upload_status = "complete"
        db.commit()
    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Evidence bundle store failed: {exc!r}")

    from app.workers import pipeline_worker

    if pipeline_worker.inline_mode():
        try:
            orchestrator.run_pipeline(db, submission_id)
        except PermissionError as e:
            raise HTTPException(status_code=422, detail=str(e))
        except Exception as exc:
            raise HTTPException(status_code=500, detail=f"Pipeline failed: {exc!r}")
        return {"submission_id": submission_id, "status": "processed"}

    return {"submission_id": submission_id, "status": "queued"}


class FinalizeIn(BaseModel):
    answers: Optional[dict] = None  # re-supplied if the original bundle never landed


@router.post("/{submission_id}/finalize")
def finalize_sync(
    submission_id: str,
    payload: FinalizeIn = FinalizeIn(),
    db: Session = Depends(get_db),
):
    """Recovery for interviews stuck at 'pending'/'failed': recordings
    usually uploaded fine even when the final bundle step failed, so this
    completes the sync from what the server already holds. The consent
    hard gate still applies — no consent recording on the server, no
    finalize (Bible Part 7)."""
    submission = db.get(models.Submission, submission_id)
    if submission is None or submission.collection_mode != "call":
        raise HTTPException(status_code=404, detail="Unknown call-mode interview session.")
    if submission.sync_status in ("synced", "processing", "processed"):
        return {"submission_id": submission_id, "status": submission.sync_status, "idempotent": True}

    saved = storage.list_saved_files(submission_id)
    missing = [k for k in ("consent_recording", "audio") if k not in saved]
    if missing:
        raise HTTPException(
            status_code=422,
            detail="Cannot recover this interview — the server never received: "
                   + ", ".join(missing).replace("_", " ")
                   + ". The recording only existed on the capture device.",
        )

    existing_types = {
        a.artifact_type
        for a in db.query(models.EvidenceArtifact)
        .filter(models.EvidenceArtifact.submission_id == submission_id)
        .all()
    }
    for kind in ("consent_recording", "audio", "call_screen"):
        if kind in saved and kind not in existing_types:
            db.add(models.EvidenceArtifact(
                submission_id=submission_id,
                artifact_type="screenshot_extracted_fields" if kind == "call_screen" else kind,
                storage_ref=saved[kind],
                payload={} if kind == "call_screen" else None,
            ))
    if payload.answers and "questionnaire_response" not in existing_types:
        db.add(models.EvidenceArtifact(
            submission_id=submission_id,
            artifact_type="questionnaire_response",
            payload=payload.answers,
        ))

    entry = db.scalar(
        select(models.SyncQueueEntry).where(
            models.SyncQueueEntry.submission_id == submission_id
        )
    )
    if entry is None:
        entry = models.SyncQueueEntry(submission_id=submission_id)
        db.add(entry)
    entry.upload_status = "complete"
    entry.attempts = (entry.attempts or 0) + 1
    submission.consent_captured = True
    submission.sync_status = "synced"  # pipeline worker sweeps it from here
    db.commit()
    return {"submission_id": submission_id, "status": "synced", "recovered": True}


@router.post("/{submission_id}/abandon")
def abandon_sync(submission_id: str, db: Session = Depends(get_db)):
    """Mark an unrecoverable interview as lost. The record stays — every
    attempted interview leaves evidence (constitution 00 §4); this only
    stops it looking like something still in progress."""
    submission = db.get(models.Submission, submission_id)
    if submission is None or submission.collection_mode != "call":
        raise HTTPException(status_code=404, detail="Unknown call-mode interview session.")
    if submission.sync_status in ("processing", "processed"):
        raise HTTPException(status_code=422, detail="This interview already completed — nothing to abandon.")
    submission.sync_status = "abandoned"
    db.commit()
    return {"submission_id": submission_id, "status": "abandoned"}
