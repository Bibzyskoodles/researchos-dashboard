"""Respondent import and management. Phone numbers are sensitive PII -
encrypt at rest per docs/ARCHITECTURE_BIBLE.md Part 9.

project_id is a FieldScore project id (TEXT, PROJ-…) — respondents are a
Call-specific table attached to existing FieldScore projects
(docs/RECONCILIATION.md §2)."""
from fastapi import APIRouter, UploadFile

router = APIRouter()


@router.post("/{project_id}/import")
async def import_respondents(project_id: str, file: UploadFile):
    # TODO: parse CSV, insert respondents with encrypted phone_number
    return {"status": "not_yet_implemented"}
