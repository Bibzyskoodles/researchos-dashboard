"""Project setup: import questionnaire, assign enumerators.
See docs/ARCHITECTURE_BIBLE.md Part 8.7 - setup should feel like uploading
a file, not configuring software.

Reconciled (docs/RECONCILIATION.md): projects themselves live in
fieldscore-backend (Supabase `projects`, TEXT PROJ-… ids) — this service
does NOT create projects. It only attaches Call-mode artifacts
(questionnaire_items) to an existing FieldScore project id.
"""
from fastapi import APIRouter, UploadFile, HTTPException

router = APIRouter()


@router.post("/{project_id}/questionnaire")
async def import_questionnaire(project_id: str, file: UploadFile):
    """
    Parses an uploaded XLSForm and auto-derives questionnaire_items,
    including required flags and skip logic from relevance/constraint
    columns (Part 8.7). This is the single most important onboarding
    flow for research managers - keep it a pure file upload, no manual
    re-specification of compliance rules. Also the input to the Tier 0
    Questionnaire Design Agent (Bible 4A.2).
    """
    # TODO: parse XLSForm (pyxform), populate questionnaire_items,
    # then run TIER_0 QuestionnaireDesignAgent against the parsed items
    raise HTTPException(status_code=501, detail="Not yet implemented")
