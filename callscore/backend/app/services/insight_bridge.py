"""
InsightScore handoff for call-mode interviews.

RECONCILIATION.md §"InsightScore" is explicit: reuse fieldscore-backend's
existing insightscore_outbox rather than building a parallel handoff.
That table is owned by fieldscore-backend (its schema lives in that
repo, not here), so this module NEVER assumes its shape: it reflects
the table at runtime and only inserts when the columns it needs are
actually present. If the table is missing or shaped differently, the
enqueue is a logged no-op — analysis handoff must never break scoring.

Independent of the outbox, build_analysis_payload() is the documented
contract for what a verified call interview contributes to analysis:
identity, shared-vocabulary scores, the questionnaire answers, and the
full transcript. routes/projects.py exposes it as a pull endpoint so
fieldscore-backend / InsightScore can always fetch call data explicitly
even where the outbox path is unavailable.
"""
import json
import logging

from sqlalchemy import MetaData, Table, inspect, select
from sqlalchemy.orm import Session

from app import models

log = logging.getLogger(__name__)

OUTBOX_TABLE = "insightscore_outbox"


def _merge_answers(typed: dict, ai_extracted: dict) -> dict:
    """Typed answers always win; AI-extracted answers only fill questions
    the enumerator left blank (constitution: AI drafts, humans decide).
    Returns {**answers, "_ai_extracted_keys": [...]} so downstream
    consumers can tell which values came from the recording."""
    merged = dict(typed)
    ai_keys = []
    for key, meta in (ai_extracted or {}).items():
        answer = (meta or {}).get("answer")
        if answer and not str(merged.get(key, "")).strip():
            merged[key] = answer
            ai_keys.append(key)
    if ai_keys:
        merged["_ai_extracted_keys"] = sorted(ai_keys)
    return merged


def build_analysis_payload(db: Session, submission: models.Submission) -> dict:
    """Everything InsightScore needs from one verified call interview."""
    sid = submission.submission_id

    answers_row = db.scalar(
        select(models.EvidenceArtifact).where(
            models.EvidenceArtifact.submission_id == sid,
            models.EvidenceArtifact.artifact_type == "questionnaire_response",
        )
    )
    ai_answers_row = db.scalar(
        select(models.EvidenceArtifact).where(
            models.EvidenceArtifact.submission_id == sid,
            models.EvidenceArtifact.artifact_type == "ai_extracted_answers",
        )
    )
    transcript_row = db.scalar(
        select(models.AgentFindingRow)
        .where(
            models.AgentFindingRow.submission_id == sid,
            models.AgentFindingRow.agent_name == "transcription_diarization",
            models.AgentFindingRow.finding_type == "transcript",
        )
        .order_by(models.AgentFindingRow.created_at.desc())
    )
    transcript = transcript_row.raw_output if transcript_row else None

    duration_seconds = None
    if submission.started_at and submission.stopped_at:
        delta = (submission.stopped_at - submission.started_at).total_seconds()
        if delta > 0:
            duration_seconds = int(delta)

    return {
        "submission_id": sid,
        "collection_mode": "call",
        "org_id": submission.org_id,
        "project_id": submission.project_id,
        "enumerator_id": submission.enumerator_id,
        "respondent_id": submission.respondent_id,
        "interviewed_at": submission.started_at.isoformat() if submission.started_at else None,
        "duration_seconds": duration_seconds,
        # Shared scoring vocabulary (constitution 01) — InsightScore only
        # analyses verified data, so verification status travels with it.
        "verdict": submission.verdict,
        "grade": submission.grade,
        "overall_score": submission.overall_score,
        "answers": _merge_answers(
            (answers_row.payload if answers_row else None) or {},
            (ai_answers_row.payload if ai_answers_row else None) or {},
        ),
        # Call mode's analysis advantage: the full transcript. Quotes in
        # InsightScore reports trace back to these segments/timestamps.
        "transcript_text": (transcript or {}).get("text"),
        "transcript_segments": (transcript or {}).get("segments"),
    }


def enqueue(db: Session, submission: models.Submission) -> bool:
    """Best-effort push into fieldscore-backend's insightscore_outbox.

    Returns True when a row was written. Never raises: a failed handoff
    is logged and left for the pull endpoint / a later retry, it must
    not fail or roll back the scoring pipeline that calls it.
    """
    try:
        bind = db.get_bind()
        if not inspect(bind).has_table(OUTBOX_TABLE):
            log.info("insightscore_outbox not present; skipping push for %s "
                     "(pull endpoint /projects/{id}/analysis-export still serves it)",
                     submission.submission_id)
            return False

        table = Table(OUTBOX_TABLE, MetaData(), autoload_with=bind)
        cols = {c.name for c in table.columns}
        payload = build_analysis_payload(db, submission)

        # Map onto whatever subset of the expected columns exists. The
        # outbox pattern needs at least a submission reference; without
        # one we cannot enqueue meaningfully.
        row: dict = {}
        if "submission_id" in cols:
            row["submission_id"] = submission.submission_id
        elif "submission_ref" in cols:
            row["submission_ref"] = submission.submission_id
        else:
            log.warning("insightscore_outbox has no submission id column; skipping push")
            return False

        if "project_id" in cols:
            row["project_id"] = submission.project_id
        if "org_id" in cols:
            row["org_id"] = submission.org_id
        if "status" in cols:
            row["status"] = "pending"
        for payload_col in ("payload", "data", "body"):
            if payload_col in cols:
                col_type = str(table.columns[payload_col].type).lower()
                row[payload_col] = payload if ("json" in col_type) else json.dumps(payload)
                break
        if "source" in cols:
            row["source"] = "callscore"

        db.execute(table.insert().values(**row))
        db.commit()
        log.info("enqueued call interview %s for InsightScore", submission.submission_id)
        return True
    except Exception:
        db.rollback()
        log.exception("insightscore_outbox push failed for %s (non-fatal)",
                      submission.submission_id)
        return False
