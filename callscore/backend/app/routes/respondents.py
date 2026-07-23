"""Respondent import and management. Phone numbers are sensitive PII -
encrypt at rest per docs/ARCHITECTURE_BIBLE.md Part 9."""
from fastapi import APIRouter, UploadFile
from uuid import UUID

router = APIRouter()


@router.post("/{project_id}/import")
async def import_respondents(project_id: UUID, file: UploadFile):
    # TODO: parse CSV, insert respondents with encrypted phone_number
    return {"status": "not_yet_implemented"}
