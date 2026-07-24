"""Project setup: import questionnaire, assign enumerators.
See docs/ARCHITECTURE_BIBLE.md Part 8.7 - setup should feel like uploading
a file, not configuring software.

Reconciled (docs/RECONCILIATION.md): projects themselves live in
fieldscore-backend (Supabase `projects`, TEXT PROJ-… ids) — this service
does NOT create projects. It only attaches Call-mode artifacts
(questionnaire_items) to an existing FieldScore project id.
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.agents.orchestrator import TIER_0
from app.db import get_db
from app.services.xlsform import parse_xlsform

router = APIRouter()


class CallConfigIn(BaseModel):
    consent_script: str
    consent_language: str = "en"
    jurisdiction: str | None = None
    # Speech-engine routing (provider names; null = language-aware default)
    stt_language: str | None = None
    stt_primary: str | None = None
    stt_verify: str | None = None


@router.put("/{project_id}/call-config")
def set_call_config(project_id: str, payload: CallConfigIn, db: Session = Depends(get_db)):
    """Consent script is project config, localized, displayed verbatim in
    the enumerator app so wording can't drift (Bible Part 7)."""
    if not payload.consent_script.strip():
        raise HTTPException(status_code=422, detail="consent_script cannot be empty.")
    cfg = db.get(models.CallProjectConfig, project_id)
    if cfg is None:
        cfg = models.CallProjectConfig(project_id=project_id, consent_script="")
        db.add(cfg)
    cfg.consent_script = payload.consent_script.strip()
    cfg.consent_language = payload.consent_language
    cfg.jurisdiction = payload.jurisdiction
    cfg.stt_language = payload.stt_language
    cfg.stt_primary = payload.stt_primary
    cfg.stt_verify = payload.stt_verify
    db.commit()
    from app.services import stt
    return {
        "project_id": project_id,
        "status": "saved",
        # Echo the effective engine order so a manager can see what their
        # choice actually resolves to with today's configured keys.
        "effective_stt_order": stt.resolve_order(
            language=payload.stt_language or payload.consent_language,
            primary=payload.stt_primary, verify=payload.stt_verify,
        ),
    }


@router.get("/{project_id}/call-config")
def get_call_config(project_id: str, db: Session = Depends(get_db)):
    cfg = db.get(models.CallProjectConfig, project_id)
    if cfg is None:
        raise HTTPException(status_code=404, detail="No call config for this project yet.")
    from app.services import stt
    return {
        "project_id": project_id,
        "consent_script": cfg.consent_script,
        "consent_language": cfg.consent_language,
        "jurisdiction": cfg.jurisdiction,
        "stt_language": cfg.stt_language,
        "stt_primary": cfg.stt_primary,
        "stt_verify": cfg.stt_verify,
        "effective_stt_order": stt.resolve_order(
            language=cfg.stt_language or cfg.consent_language,
            primary=cfg.stt_primary, verify=cfg.stt_verify,
        ),
    }


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
