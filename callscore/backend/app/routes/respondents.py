"""Respondent import and management. Phone numbers are sensitive PII -
encrypt at rest per docs/ARCHITECTURE_BIBLE.md Part 9.

project_id is a FieldScore project id (TEXT, PROJ-…) — respondents are a
Call-specific table attached to existing FieldScore projects
(docs/RECONCILIATION.md §2)."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.core.auth import require_auth
from app.db import get_db
from app.services import pii

router = APIRouter()


class RespondentIn(BaseModel):
    display_name: str
    phone_number: str | None = None


@router.post("/{project_id}")
def create_respondent(
    project_id: str,
    payload: RespondentIn,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    """Add one respondent from the app — the no-CSV path. Same encryption
    rule as import: no CONSENT_ENCRYPTION_KEY, no plaintext phone stored."""
    import uuid

    name = payload.display_name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="A name is required.")
    phone = (payload.phone_number or "").strip()
    if phone and not pii.encryption_available():
        raise HTTPException(
            status_code=503,
            detail="Phone numbers cannot be stored: encryption is not configured.",
        )
    r = models.Respondent(
        id=f"RESP-{uuid.uuid4().hex[:10].upper()}",
        org_id=auth.get("org", ""),
        project_id=project_id,
        display_name=name,
        phone_number=pii.encrypt_pii(phone) if phone else None,
    )
    db.add(r)
    db.commit()
    return {
        "id": r.id,
        "display_name": r.display_name,
        "phone_number": phone or None,
        "metadata": None,
    }


@router.get("/{project_id}")
def list_respondents(
    project_id: str,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_auth),
):
    """Assigned respondents for a project — drives the enumerator app's
    respondent picker (Bible 2.3 step 1). Phone numbers decrypt only for
    authenticated staff, and every read is audit-logged (Bible Part 9)."""
    rows = (
        db.query(models.Respondent)
        .filter(models.Respondent.project_id == project_id)
        .order_by(models.Respondent.display_name)
        .limit(500)
        .all()
    )
    db.add(models.AccessLogEntry(
        accessed_by=auth.get("sub", "unknown"),
        resource_type="respondent_pii",
        resource_id=project_id,
        detail=f"listed {len(rows)} respondents",
    ))
    db.commit()
    return {
        "project_id": project_id,
        "respondents": [
            {
                "id": r.id,
                "display_name": r.display_name,
                "phone_number": pii.decrypt_pii(r.phone_number),
                "metadata": r.metadata_,
            }
            for r in rows
        ],
    }


@router.post("/{project_id}/import")
async def import_respondents(
    project_id: str,
    file: UploadFile,
    org_id: str = "",
    db: Session = Depends(get_db),
):
    """CSV import: columns `id` (optional), `name`, `phone`. Phone numbers
    are Fernet-encrypted at rest (Bible Part 9) — the import refuses to
    run if CONSENT_ENCRYPTION_KEY is unset rather than storing plaintext."""
    import csv
    import io
    import uuid

    from app.services import pii

    if not pii.encryption_available():
        raise HTTPException(
            status_code=503,
            detail="CONSENT_ENCRYPTION_KEY is not configured — respondent PII "
                   "cannot be stored unencrypted (Bible Part 9).",
        )
    text = (await file.read()).decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise HTTPException(status_code=422, detail="Empty CSV.")
    cols = {c.strip().lower(): c for c in reader.fieldnames}
    name_col = cols.get("name") or cols.get("display_name")
    phone_col = cols.get("phone") or cols.get("phone_number") or cols.get("number")
    if not name_col and not phone_col:
        raise HTTPException(status_code=422, detail="CSV needs a 'name' and/or 'phone' column.")

    imported = 0
    for row in reader:
        rid = (row.get(cols.get("id", ""), "") or "").strip() or f"RESP-{uuid.uuid4().hex[:10].upper()}"
        existing = db.get(models.Respondent, rid)
        target = existing or models.Respondent(id=rid, org_id=org_id, project_id=project_id)
        target.display_name = (row.get(name_col, "") or "").strip() if name_col else target.display_name
        raw_phone = (row.get(phone_col, "") or "").strip() if phone_col else ""
        if raw_phone:
            target.phone_number = pii.encrypt_pii(raw_phone)
        if existing is None:
            db.add(target)
        imported += 1
    db.commit()
    return {"project_id": project_id, "imported": imported}
