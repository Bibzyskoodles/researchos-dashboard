"""
Interview session lifecycle — reconciled onto FieldScore's `submissions`
table (docs/RECONCILIATION.md §2): a Call interview IS a submission row
with collection_mode='call'. Matches Bible Part 2.3 (lifecycle) and 5.3
(idempotent client-generated ids for offline sync).
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app import models
from app.db import get_db
from app.services import scoring

router = APIRouter()


class InterviewSessionCreate(BaseModel):
    id: str  # client-generated submission id
    org_id: str
    project_id: str
    enumerator_id: str  # free-text ref, matches enumerators.enumerator_ref
    respondent_id: str
    started_at: datetime
    consent_captured: bool


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
    existing = db.get(models.Submission, payload.id)
    if existing is not None:
        # Idempotent retry: same client-generated id, return existing state.
        return {"id": existing.submission_id, "status": "started", "idempotent": True}

    submission = models.Submission(
        submission_id=payload.id,
        org_id=payload.org_id,
        project_id=payload.project_id,
        enumerator_id=payload.enumerator_id,
        respondent_id=payload.respondent_id,
        collection_mode="call",
        started_at=payload.started_at,
        consent_captured=payload.consent_captured,
        sync_status="pending",
    )
    db.add(submission)
    db.commit()
    return {"id": submission.submission_id, "status": "started"}


@router.post("/{submission_id}/stop")
def stop_interview_session(
    submission_id: str, payload: InterviewSessionStop, db: Session = Depends(get_db)
):
    """
    Stop Interview. Runs the late-start/early-stop discrepancy check against
    device1_call_started_at / device1_call_ended_at (Part 6.5). Flags are
    also recomputed at scoring time; surfacing them here lets the app show
    the enumerator immediately that the session will carry a timing flag.
    """
    submission = db.get(models.Submission, submission_id)
    if submission is None or submission.collection_mode != "call":
        raise HTTPException(status_code=404, detail="Unknown call-mode interview session.")

    submission.stopped_at = payload.stopped_at
    submission.device1_call_started_at = payload.device1_call_started_at
    submission.device1_call_ended_at = payload.device1_call_ended_at
    db.commit()

    late_start, early_stop = scoring.detect_timing_flags(
        submission.started_at,
        submission.stopped_at,
        submission.device1_call_started_at,
        submission.device1_call_ended_at,
    )
    return {
        "id": submission.submission_id,
        "status": "stopped",
        "late_start_flag": late_start,
        "early_stop_flag": early_stop,
    }


@router.get("/pair/{code}")
def pair_by_code(code: str, db: Session = Depends(get_db)):
    """
    CallScore Link pairing (cloud-relay path): the main app shows a short
    code — the tail of the client-generated session id — during a live
    interview; Link resolves it to the full id here. Only in-progress
    call-mode sessions started in the last 4 hours match, so stale codes
    can't be hijacked and collisions are practically impossible within an
    active window.
    """
    from datetime import timedelta, timezone as tz

    code = code.strip().lower()
    if len(code) < 6:
        raise HTTPException(status_code=422, detail="Pairing code must be at least 6 characters.")
    cutoff = datetime.now(tz.utc) - timedelta(hours=4)
    matches = (
        db.query(models.Submission)
        .filter(
            models.Submission.collection_mode == "call",
            models.Submission.stopped_at.is_(None),
            models.Submission.started_at.isnot(None),
            models.Submission.started_at >= cutoff,
            models.Submission.submission_id.ilike(f"%{code}"),
        )
        .limit(2)
        .all()
    )
    if len(matches) != 1:
        raise HTTPException(status_code=404, detail="No active interview matches this code.")
    s = matches[0]
    return {
        "submission_id": s.submission_id,
        "respondent_id": s.respondent_id,
        "started_at": s.started_at,
    }


class Device1State(BaseModel):
    call_started_at: Optional[datetime] = None
    call_ended_at: Optional[datetime] = None
    # OCR/manually-extracted fields from the call screen — never the image
    # itself (Bible 6.1).
    number: Optional[str] = None
    name: Optional[str] = None
    duration_seconds: Optional[int] = None


@router.post("/{submission_id}/device1-state")
def report_device1_state(
    submission_id: str, payload: Device1State, db: Session = Depends(get_db)
):
    """
    CallScore Link (Device 1) reports call state. This is the CLOUD RELAY
    path — explicitly the weakest supported link (Bible 6.2 priority 3);
    BLE replaces it as the default in V1 when the companion app gains
    native call-state modules. Timestamps land on the same columns the
    late-start/early-stop check reads (Bible 6.5), so the flags work
    identically regardless of transport.
    """
    submission = db.get(models.Submission, submission_id)
    if submission is None or submission.collection_mode != "call":
        raise HTTPException(status_code=404, detail="Unknown call-mode interview session.")

    if payload.call_started_at:
        submission.device1_call_started_at = payload.call_started_at
    if payload.call_ended_at:
        submission.device1_call_ended_at = payload.call_ended_at
    if payload.number or payload.name or payload.duration_seconds is not None:
        db.add(
            models.EvidenceArtifact(
                submission_id=submission_id,
                artifact_type="screenshot_extracted_fields",
                payload={
                    "number": payload.number,
                    "name": payload.name,
                    "duration_seconds": payload.duration_seconds,
                    "source": "device1_link",
                },
            )
        )
    db.commit()
    return {"submission_id": submission_id, "status": "device1_state_recorded"}


@router.get("/project/{project_id}")
def list_interview_sessions(project_id: str, db: Session = Depends(get_db)):
    """Call-mode interviews for a project, most recent first — drives the
    dashboard's Collect-stage Call tab (sync/consent status at a glance)."""
    rows = (
        db.query(models.Submission)
        .filter(
            models.Submission.project_id == project_id,
            models.Submission.collection_mode == "call",
        )
        .order_by(models.Submission.started_at.desc().nulls_last())
        .limit(200)
        .all()
    )
    return {
        "project_id": project_id,
        "interviews": [
            {
                "id": s.submission_id,
                "enumerator_id": s.enumerator_id,
                "respondent_id": s.respondent_id,
                "started_at": s.started_at,
                "stopped_at": s.stopped_at,
                "consent_captured": s.consent_captured,
                "sync_status": s.sync_status,
                "verdict": s.verdict,
                "grade": s.grade,
            }
            for s in rows
        ],
    }


@router.get("/{submission_id}")
def get_interview_session(submission_id: str, db: Session = Depends(get_db)):
    submission = db.get(models.Submission, submission_id)
    if submission is None or submission.collection_mode != "call":
        raise HTTPException(status_code=404, detail="Unknown call-mode interview session.")
    artifacts = (
        db.query(models.EvidenceArtifact)
        .filter(models.EvidenceArtifact.submission_id == submission_id)
        .all()
    )
    scorecard = db.get(models.CallScorecard, submission_id)
    return {
        "id": submission.submission_id,
        "org_id": submission.org_id,
        "project_id": submission.project_id,
        "enumerator_id": submission.enumerator_id,
        "respondent_id": submission.respondent_id,
        "started_at": submission.started_at,
        "stopped_at": submission.stopped_at,
        "consent_captured": submission.consent_captured,
        "sync_status": submission.sync_status,
        "verdict": submission.verdict,
        "grade": submission.grade,
        "evidence_artifacts": [
            {
                "id": str(a.id),
                "artifact_type": a.artifact_type,
                "storage_ref": a.storage_ref,
                "created_at": a.created_at,
            }
            for a in artifacts
        ],
        "scorecard_available": scorecard is not None,
    }
