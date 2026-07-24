"""Project setup: import questionnaire, assign enumerators.
See docs/ARCHITECTURE_BIBLE.md Part 8.7 - setup should feel like uploading
a file, not configuring software.

Reconciled (docs/RECONCILIATION.md): projects themselves live in
fieldscore-backend (Supabase `projects`, TEXT PROJ-… ids) — this service
does NOT create projects. It only attaches Call-mode artifacts
(questionnaire_items) to an existing FieldScore project id.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app import models
from app.agents.orchestrator import TIER_0
from app.db import get_db
from app.services.xlsform import parse_xlsform

router = APIRouter()


@router.post("/{project_id}/questionnaire")
async def import_questionnaire(project_id: str, file: UploadFile, db: Session = Depends(get_db)):
    """
    Parses an uploaded XLSForm and auto-derives questionnaire_items,
    including required flags and skip logic from the `relevant` column
    (Part 8.7) — a pure file upload, no manual re-specification of
    compliance rules. Re-importing replaces the project's items. Then runs
    the Tier 0 Questionnaire Design Agent (Bible 4A.2) — design-quality
    findings only; they never touch any interview's scorecard.
    """
    data = await file.read()
    try:
        questions = parse_xlsform(data)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    db.query(models.QuestionnaireItem).filter(
        models.QuestionnaireItem.project_id == project_id
    ).delete()
    items = [
        models.QuestionnaireItem(
            project_id=project_id,
            question_key=q.question_key,
            question_text=q.question_text,
            is_required=q.is_required,
            skip_logic=q.skip_logic,
            sort_order=q.sort_order,
        )
        for q in questions
    ]
    db.add_all(items)
    db.commit()

    # Tier 0 review — setup-time only, never per-interview.
    design_findings = []
    for agent in TIER_0:
        try:
            findings = agent.run(project_id, {
                "questionnaire_items": [
                    {"question_key": q.question_key, "question_text": q.question_text,
                     "is_required": q.is_required, "skip_logic": q.skip_logic}
                    for q in questions
                ],
            })
            design_findings.extend(
                {"type": f.finding_type, "description": f.description, "confidence": f.confidence}
                for f in findings
            )
        except NotImplementedError:
            pass

    return {
        "project_id": project_id,
        "imported": len(items),
        "design_review": design_findings,
    }


@router.get("/{project_id}/questionnaire")
def get_questionnaire(project_id: str, db: Session = Depends(get_db)):
    """Drives the enumerator app's Glance-Confirm rows and the Question
    Compliance agent — one source of truth for both."""
    items = (
        db.query(models.QuestionnaireItem)
        .filter(models.QuestionnaireItem.project_id == project_id)
        .order_by(models.QuestionnaireItem.sort_order)
        .all()
    )
    return {
        "project_id": project_id,
        "items": [
            {
                "question_key": i.question_key,
                "question_text": i.question_text,
                "is_required": i.is_required,
                "skip_logic": i.skip_logic,
                "sort_order": i.sort_order,
            }
            for i in items
        ],
    }
