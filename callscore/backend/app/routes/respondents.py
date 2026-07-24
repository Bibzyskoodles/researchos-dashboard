"""Respondent import and management. Phone numbers are sensitive PII -
encrypt at rest per docs/ARCHITECTURE_BIBLE.md Part 9.

project_id is a FieldScore project id (TEXT, PROJ-…) — respondents are a
Call-specific table attached to existing FieldScore projects
(docs/RECONCILIATION.md §2)."""
from fastapi import APIRouter, Depends, UploadFile
from sqlalchemy.orm import Session

from app import models
from app.db import get_db

router = APIRouter()


@router.get("/{project_id}")
def list_respondents(project_id: str, db: Session = Depends(get_db)):
    """Assigned respondents for a project — drives the enumerator app's
    respondent picker (Bible 2.3 step 1). Phone numbers are returned only
    to authenticated staff (router-level require_staff in main.py)."""
    rows = (
        db.query(models.Respondent)
        .filter(models.Respondent.project_id == project_id)
        .order_by(models.Respondent.display_name)
        .limit(500)
        .all()
    )
    return {
        "project_id": project_id,
        "respondents": [
            {
                "id": r.id,
                "display_name": r.display_name,
                "phone_number": r.phone_number,
                "metadata": r.metadata_,
            }
            for r in rows
        ],
    }


@router.post("/{project_id}/import")
async def import_respondents(project_id: str, file: UploadFile):
    # TODO: parse CSV, insert respondents with encrypted phone_number
    return {"status": "not_yet_implemented"}
