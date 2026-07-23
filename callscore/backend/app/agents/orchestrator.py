"""
Pipeline orchestration. See docs/ARCHITECTURE_BIBLE.md Part 4.3.

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


def run_pipeline(db: Session, interview_session_id: str) -> models.Scorecard:
    """
    Synchronous pipeline run. Designed to be called from a Celery/RQ
    worker; safe to call inline for small deployments and tests.

    Hard gate (Design Principle 2): refuses to run without a consent
    evidence artifact — enforced here in the state machine, not policy.
    """
    session = db.get(models.InterviewSession, interview_session_id)
    if session is None:
        raise ValueError(f"unknown interview session {interview_session_id}")

    consent = db.scalar(
        select(models.EvidenceArtifact).where(
            models.EvidenceArtifact.interview_session_id == session.id,
            models.EvidenceArtifact.artifact_type == "consent_recording",
        )
    )
    if not session.consent_captured or consent is None:
        raise PermissionError(
            "Consent artifact missing: analysis is blocked (Bible Part 7)."
        )

    session.sync_status = "processing"
    db.flush()

    findings: list[AgentFinding] = []
    failed_agents: list[str] = []
    context: dict = {"findings": findings}

    for tier in (TIER_1, TIER_2, TIER_3):
        for agent in tier:
            try:
                findings.extend(agent.run(str(session.id), context))
            except NotImplementedError:
                # Stub agents don't count as hard failures — they're absent
                # capability, but still tracked so confidence reflects coverage.
                failed_agents.append(agent.name)
            except Exception:
                logger.exception("agent %s failed for session %s", agent.name, session.id)
                failed_agents.append(agent.name)

    # Persist every upstream finding — the raw material Evidence
    # Generation compiles from, and the audit trail behind every score.
    for f in findings:
        db.add(
            models.AgentFindingRow(
                interview_session_id=session.id,
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
        session.started_at,
        session.stopped_at,
        session.device1_call_started_at,
        session.device1_call_ended_at,
    )
    result = scoring.synthesize(findings, late_start, early_stop, failed_agents)

    scorecard = db.scalar(
        select(models.Scorecard).where(models.Scorecard.interview_session_id == session.id)
    )
    if scorecard is None:
        scorecard = models.Scorecard(interview_session_id=session.id)
        db.add(scorecard)

    scorecard.overall_quality_score = result.overall_quality_score
    scorecard.authenticity_score = result.authenticity_score
    scorecard.compliance_score = result.compliance_score
    scorecard.behaviour_score = result.behaviour_score
    scorecard.fraud_risk = result.fraud_risk
    scorecard.confidence_level = result.confidence_level
    scorecard.recommended_action = result.recommended_action
    scorecard.late_start_flag = result.late_start_flag
    scorecard.early_stop_flag = result.early_stop_flag

    session.sync_status = "processed"
    db.commit()
    return scorecard
