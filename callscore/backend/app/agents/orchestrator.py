"""
Pipeline orchestration. See docs/ARCHITECTURE_BIBLE.md Part 4.3 and
docs/RECONCILIATION.md — this service shares fieldscore-backend's Postgres;
the interview entity is a `submissions` row with collection_mode='call'.

Tier 1 -> Tier 2 (parallel where possible) -> Tier 3 (batched against
interview history) -> Tier 4 (synthesis).

Failure isolation: if one agent fails, the others still complete and the
interview routes to 'partial analysis - needs review' (lower confidence,
review_recording floor) rather than dropping silently.
"""
import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models
from app.agents.questionnaire_design import QuestionnaireDesignAgent  # Tier 0 - project setup, not per-interview
from app.agents.audio_quality import AudioQualityAgent
from app.agents.transcription_diarization import TranscriptionDiarizationAgent
from app.agents.question_compliance import QuestionComplianceAgent
from app.agents.answer_consistency import AnswerConsistencyAgent
from app.agents.behaviour_analysis import BehaviourAnalysisAgent
from app.agents.respondent_engagement import RespondentEngagementAgent
from app.agents.conversation_naturalness import ConversationNaturalnessAgent
from app.agents.similarity_fabrication import SimilarityFabricationAgent
from app.agents.pattern_fraud import PatternFraudAgent
from app.agents.voice_fingerprint import VoiceFingerprintAgent
from app.agents.base import AgentFinding
from app.services import scoring

logger = logging.getLogger(__name__)

TIER_0 = [QuestionnaireDesignAgent()]  # run once at project setup, see Bible Part 4A.2
TIER_1 = [AudioQualityAgent(), TranscriptionDiarizationAgent()]
TIER_2 = [
    QuestionComplianceAgent(),
    AnswerConsistencyAgent(),
    BehaviourAnalysisAgent(),
    RespondentEngagementAgent(),
    ConversationNaturalnessAgent(),
]
TIER_3 = [SimilarityFabricationAgent(), PatternFraudAgent(), VoiceFingerprintAgent()]


def _build_context(db: Session, submission: models.Submission, context: dict) -> None:
    """Load everything each tier is entitled to (see BaseAgent.run docs):
    Tier 1 the raw audio, Tier 2 the questionnaire + submitted answers,
    Tier 3 this enumerator's interview history. Missing pieces stay absent —
    agents that need them raise NotImplementedError and are counted as
    reduced coverage rather than fed guesses."""
    from app.services import storage

    submission_id = submission.submission_id

    audio = db.scalar(
        select(models.EvidenceArtifact).where(
            models.EvidenceArtifact.submission_id == submission_id,
            models.EvidenceArtifact.artifact_type == "audio",
        )
    )
    if audio and audio.storage_ref:
        path = storage.resolve_storage_ref(audio.storage_ref)
        if path is not None:
            context["audio_path"] = path

    items = (
        db.query(models.QuestionnaireItem)
        .filter(models.QuestionnaireItem.project_id == submission.project_id)
        .order_by(models.QuestionnaireItem.sort_order)
        .all()
    )
    if items:
        context["questionnaire_items"] = [
            {"question_key": i.question_key, "question_text": i.question_text,
             "is_required": i.is_required, "skip_logic": i.skip_logic}
            for i in items
        ]

    answers = db.scalar(
        select(models.EvidenceArtifact).where(
            models.EvidenceArtifact.submission_id == submission_id,
            models.EvidenceArtifact.artifact_type == "questionnaire_response",
        )
    )
    if answers and answers.payload:
        context["answers"] = answers.payload

    # Tier 3 history: prior transcripts (from transcription findings) and
    # portfolio durations for this enumerator's call interviews.
    prior_rows = db.scalars(
        select(models.AgentFindingRow)
        .join(models.Submission,
              models.AgentFindingRow.submission_id == models.Submission.submission_id)
        .where(
            models.Submission.enumerator_id == submission.enumerator_id,
            models.Submission.collection_mode == "call",
            models.AgentFindingRow.agent_name == "transcription_diarization",
            models.AgentFindingRow.submission_id != submission_id,
        )
        .order_by(models.AgentFindingRow.created_at.desc())
        .limit(25)
    ).all()
    context["prior_transcripts"] = [
        {"submission_id": r.submission_id, "text": (r.raw_output or {}).get("text", "")}
        for r in prior_rows
    ]

    portfolio = db.scalars(
        select(models.Submission).where(
            models.Submission.enumerator_id == submission.enumerator_id,
            models.Submission.collection_mode == "call",
            models.Submission.started_at.isnot(None),
            models.Submission.stopped_at.isnot(None),
        ).limit(50)
    ).all()
    context["portfolio_durations"] = [
        (s.stopped_at - s.started_at).total_seconds()
        for s in portfolio
        if s.stopped_at and s.started_at and s.stopped_at > s.started_at
    ]


def run_pipeline(db: Session, submission_id: str) -> models.CallScorecard:
    """
    Synchronous pipeline run. Designed to be called from a Celery/RQ
    worker; safe to call inline for small deployments and tests.

    Hard gate (Design Principle 2): refuses to run without a consent
    evidence artifact — enforced here in the state machine, not policy.
    """
    submission = db.get(models.Submission, submission_id)
    if submission is None:
        raise ValueError(f"unknown submission {submission_id}")
    if submission.collection_mode != "call":
        raise ValueError(
            f"submission {submission_id} is {submission.collection_mode}-mode; "
            "this pipeline only scores call-mode interviews"
        )

    consent = db.scalar(
        select(models.EvidenceArtifact).where(
            models.EvidenceArtifact.submission_id == submission_id,
            models.EvidenceArtifact.artifact_type == "consent_recording",
        )
    )
    if not submission.consent_captured or consent is None:
        raise PermissionError(
            "Consent artifact missing: analysis is blocked (Bible Part 7)."
        )

    submission.sync_status = "processing"
    db.flush()

    findings: list[AgentFinding] = []
    failed_agents: list[str] = []
    context: dict = {"findings": findings}
    _build_context(db, submission, context)

    for tier in (TIER_1, TIER_2, TIER_3):
        for agent in tier:
            try:
                findings.extend(agent.run(submission_id, context))
            except NotImplementedError:
                # Stub agents don't count as hard failures — they're absent
                # capability, but still tracked so confidence reflects coverage.
                failed_agents.append(agent.name)
            except Exception:
                logger.exception("agent %s failed for submission %s", agent.name, submission_id)
                failed_agents.append(agent.name)

    # Persist every upstream finding — the raw material Evidence
    # Generation compiles from, and the audit trail behind every score.
    for f in findings:
        db.add(
            models.AgentFindingRow(
                submission_id=submission_id,
                agent_name=f.agent_name,
                finding_type=f.finding_type,
                description=f.description,
                timestamp_range_start=f.timestamp_range_start,
                timestamp_range_end=f.timestamp_range_end,
                confidence=f.confidence,
                raw_output=f.raw_output,
            )
        )

    late_start, early_stop = scoring.detect_timing_flags(
        submission.started_at,
        submission.stopped_at,
        submission.device1_call_started_at,
        submission.device1_call_ended_at,
    )
    result = scoring.synthesize(findings, late_start, early_stop, failed_agents)

    scorecard = db.get(models.CallScorecard, submission_id)
    if scorecard is None:
        scorecard = models.CallScorecard(submission_id=submission_id)
        db.add(scorecard)

    scorecard.authenticity_score = result.authenticity_score
    scorecard.compliance_score = result.compliance_score
    scorecard.behaviour_score = result.behaviour_score
    scorecard.confidence_level = result.confidence_level
    scorecard.fraud_risk = result.fraud_risk
    scorecard.recommended_action = result.recommended_action
    scorecard.late_start_flag = result.late_start_flag
    scorecard.early_stop_flag = result.early_stop_flag

    # Headline results in the shared vocabulary, onto the submissions row —
    # this is what the existing FieldScore dashboards/leaderboard read.
    shared = scoring.to_field_vocabulary(result)
    submission.verdict = shared["verdict"]
    submission.grade = shared["grade"]
    submission.overall_score = shared["overall_score"]
    submission.fraud_flag = result.fraud_risk if result.fraud_risk != "low" else None

    submission.sync_status = "processed"
    db.commit()
    return scorecard
