"""
Durable pipeline worker — backpressure fix for Wave 1.5 hardening.

Upload requests no longer run the (transcription + LLM) pipeline inline:
the sync route marks the submission 'synced' and returns immediately; this
worker sweeps synced call/agent-mode rows and scores them. State lives in
Postgres (sync_status), not in memory — the same durable-outbox pattern as
fieldscore-backend's bridge_drainer, so a worker restart just picks up
where it left off and twenty enumerators syncing at 6pm queue instead of
timing out.

Failure semantics: a pipeline exception marks the row 'failed' (visible in
the app's sync queue) rather than leaving it stuck in 'processing'; rows
stuck in 'processing' longer than STALE_PROCESSING_MINUTES (a crashed
worker mid-run) are reclaimed on the next sweep.

PIPELINE_INLINE=true restores the old synchronous behaviour (tests, tiny
deployments). PIPELINE_WORKER=false disables the loop (e.g. when running
a dedicated worker container instead of in-process).
"""
import logging
import os
import threading
import time
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_, select

log = logging.getLogger(__name__)

SWEEP_INTERVAL_SECONDS = int(os.getenv("PIPELINE_SWEEP_SECONDS", "10"))
STALE_PROCESSING_MINUTES = int(os.getenv("STALE_PROCESSING_MINUTES", "20"))
_BATCH = 10

_started = False
_lock = threading.Lock()


def inline_mode() -> bool:
    return os.getenv("PIPELINE_INLINE", "").lower() in ("1", "true", "yes")


def process_once() -> int:
    """One sweep: score up to _BATCH pending rows. Returns rows processed."""
    from app import models
    from app.agents import orchestrator
    from app.db import get_sessionmaker

    SessionLocal = get_sessionmaker()
    processed = 0
    with SessionLocal() as db:
        stale_cutoff = datetime.now(timezone.utc) - timedelta(minutes=STALE_PROCESSING_MINUTES)
        rows = db.scalars(
            select(models.Submission)
            .where(
                models.Submission.collection_mode.in_(("call", "agent")),
                or_(
                    models.Submission.sync_status == "synced",
                    # reclaim rows a crashed worker left mid-run
                    (models.Submission.sync_status == "processing")
                    & (models.Submission.created_at < stale_cutoff),
                ),
            )
            .limit(_BATCH)
        ).all()
        ids = [r.submission_id for r in rows]

    for submission_id in ids:
        with SessionLocal() as db:
            try:
                orchestrator.run_pipeline(db, submission_id)
                processed += 1
            except Exception as exc:
                log.exception("pipeline failed for %s", submission_id)
                db.rollback()
                sub = db.get(models.Submission, submission_id)
                if sub is not None:
                    sub.sync_status = "failed"
                    # Surface WHY in the dashboard (sync_queue.last_error) —
                    # a silently flapping synced→failed row is undiagnosable.
                    from sqlalchemy import select as _select
                    entry = db.scalar(_select(models.SyncQueueEntry).where(
                        models.SyncQueueEntry.submission_id == submission_id))
                    if entry is None:
                        entry = models.SyncQueueEntry(submission_id=submission_id)
                        db.add(entry)
                    entry.last_error = f"analysis failed: {type(exc).__name__}: {str(exc)[:400]}"
                    db.commit()
    return processed


def _loop() -> None:
    log.info("pipeline worker started (every %ss)", SWEEP_INTERVAL_SECONDS)
    while True:
        try:
            process_once()
        except Exception:
            log.exception("pipeline worker sweep failed")
        time.sleep(SWEEP_INTERVAL_SECONDS)


def start_worker() -> None:
    """Idempotent; call from app startup. No-ops when disabled, inline,
    or the database isn't configured (e.g. unit tests)."""
    global _started
    from app.core import config

    if inline_mode() or os.getenv("PIPELINE_WORKER", "").lower() in ("0", "false", "no"):
        return
    if not config.DATABASE_URL:
        return
    with _lock:
        if _started:
            return
        _started = True
    threading.Thread(target=_loop, daemon=True, name="pipeline-worker").start()
