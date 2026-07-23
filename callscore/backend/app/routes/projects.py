"""Project setup: import questionnaire, respondents, assign enumerators.
See docs/ARCHITECTURE_BIBLE.md Part 8.7 - setup should feel like uploading
a file, not configuring software.
"""
from fastapi import APIRouter, UploadFile, HTTPException
from pydantic import BaseModel
from uuid import UUID

router = APIRouter()


class ProjectCreate(BaseModel):
    organization_id: UUID
    name: str
    consent_script: str
    jurisdiction: str
    integration_mode: str = "standalone"


@router.post("/")
def create_project(payload: ProjectCreate):
    # TODO: insert into projects table
    return {"status": "created"}


@router.post("/{project_id}/questionnaire")
async def import_questionnaire(project_id: UUID, file: UploadFile):
    """
    Parses an uploaded XLSForm and auto-derives questionnaire_items,
    including required flags and skip logic from relevance/constraint
    columns (Part 8.7). This is the single most important onboarding
    flow for research managers - keep it a pure file upload, no manual
    re-specification of compliance rules.
    """
    # TODO: parse XLSForm (pyxform), populate questionnaire_items
    raise HTTPException(status_code=501, detail="Not yet implemented")
