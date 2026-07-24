"""
Evidence file storage. MVP: local disk under STORAGE_DIR — on Railway,
mount a Volume there so recordings survive redeploys (same pattern as
fieldscore-backend's /data volume). The storage_ref format ("file://…")
keeps the door open for an S3/GCS backend later without schema changes.

Bible Part 9: artifacts are encrypted in transit (TLS) and access-scoped —
every read goes through an authenticated route; there is no public URL.
"""
import os
import pathlib
import re

STORAGE_DIR = pathlib.Path(os.getenv("STORAGE_DIR", "/data/callscore-evidence"))

_SAFE = re.compile(r"[^A-Za-z0-9._-]")

_ALLOWED_KINDS = {"audio", "consent_recording"}


def _safe(name: str) -> str:
    return _SAFE.sub("_", name)[:120]


def save_artifact_file(submission_id: str, kind: str, data: bytes, filename: str) -> str:
    """Store raw bytes; returns the storage_ref to persist on the artifact."""
    if kind not in _ALLOWED_KINDS:
        raise ValueError(f"unsupported artifact kind: {kind}")
    folder = STORAGE_DIR / _safe(submission_id)
    folder.mkdir(parents=True, exist_ok=True)
    path = folder / f"{kind}__{_safe(filename) or 'recording.m4a'}"
    path.write_bytes(data)
    return f"file://{path}"


def resolve_storage_ref(storage_ref: str) -> pathlib.Path | None:
    """file:// ref -> local path, or None if missing/not local. Refuses
    paths outside STORAGE_DIR so a crafted ref can't read arbitrary files."""
    if not storage_ref or not storage_ref.startswith("file://"):
        return None
    path = pathlib.Path(storage_ref[len("file://"):]).resolve()
    try:
        path.relative_to(STORAGE_DIR.resolve())
    except ValueError:
        return None
    return path if path.exists() else None
