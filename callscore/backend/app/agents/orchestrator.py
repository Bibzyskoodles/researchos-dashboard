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
from app.agents.consent_verification import ConsentVerificationAgent
from app.agents.transcription_diarization import TranscriptionDiarizationAgent
from app.agents.question_compliance import QuestionComplianceAgent
from app.agents.answer_consistency import AnswerConsistencyAgent
from app.agents.answer_extraction import AnswerExtractionAgent
from app.agents.behaviour_analysis import BehaviourAnalysisAgent
from app.agents.respondent_engagement import RespondentEngagementAgent
from app.agents.conversation_naturalness import ConversationNaturalnessAgent
from app.agents.similarity_fabrication import SimilarityFabricationAgent
from app.agents.pattern_fraud import PatternFraudAgent
from app.agents.voice_fingerprint import VoiceFingerprintAgent
from app.agents.voice_impersonation import VoiceImpersonationAgent
from app.agents.base import AgentFinding
from app.services import scoring

logger = logging.getLogger(__name__)

TIER_0 = [QuestionnaireDesignAgent()]  # run once at project setup, see Bible Part 4A.2
TIER_1 = [AudioQualityAgent(), TranscriptionDiarizationAgent(), ConsentVerificationAgent()]
TIER_2 = [
    QuestionComplianceAgent(),
    AnswerConsistencyAgent(),
    AnswerExtractionAgent(),
    BehaviourAnalysisAgent(),
    RespondentEngagementAgent(),
    ConversationNaturalnessAgent(),
    VoiceImpersonationAgent(),
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

    consent_art = db.scalar(
        select(models.EvidenceArtifact).where(
            models.EvidenceArtifact.submission_id == submission_id,
            models.EvidenceArtifact.artifact_type == "consent_recording",
        )
    )
    if consent_art and consent_art.storage_ref:
        consent_path = storage.resolve_storage_ref(consent_art.storage_ref)
        if consent_path is not None:
            context["consent_audio_path"] = consent_path

    items = (
        db.query(models.QuestionnaireItem)
        .filter(models.QuestionnaireItem.project_id == submission.project_id)
        .order_by(models.QuestionnaireItem.sort_order)
        .all()
    )
    if items:
        context["questionnaire_items"] = [
            {"question_key": i.question_key, "question_text": i.question_text,
             "is_required": i.is_required, "skip_logic": i.skip_logic,
             "question_type": i.question_type, "integrity": i.integrity,
             "choices": i.choices}
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

    # Agent-mode (and re-runs): a transcript may already exist from the
    # voice-agent provider — load it so Tier 1 doesn't re-transcribe.
    existing_transcript = db.scalar(
        select(models.AgentFindingRow)
        .where(
            models.AgentFindingRow.submission_id == submission_id,
            models.AgentFindingRow.agent_name == "transcription_diarization",
            models.AgentFindingRow.finding_type == "transcript",
        )
        .order_by(models.AgentFindingRow.created_at.desc())
    )
    if existing_transcript and (existing_transcript.raw_output or {}).get("text"):
        context["transcript"] = existing_transcript.raw_output

    # Speech-engine routing: per-project choice > language default > global.
    from app.services import stt

    cfg = db.get(models.CallProjectConfig, submission.project_id)
    context["consent_script"] = cfg.consent_script if cfg else None
    context["interview_language"] = (
        (cfg.stt_language or cfg.consent_language) if cfg else "en"
    )
    context["stt_order"] = stt.resolve_order(
        language=context["interview_language"],
        primary=cfg.stt_primary if cfg else None,
        verify=cfg.stt_verify if cfg else None,
    )

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
    if submission.collection_mode not in ("call", "agent"):
        raise ValueError(
            f"submission {submission_id} is {submission.collection_mode}-mode; "
            "this pipeline only scores call- and agent-mode interviews"
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

    # Trap questions (supervisor-set red herrings, Design stage): the
    # expected honest answer is known; any other non-empty answer is
    # strong fabrication evidence. Pure comparison — no LLM.
    submitted = context.get("answers") or {}
    for item in context.get("questionnaire_items") or []:
        integ = item.get("integrity") or {}
        if integ.get("role") != "trap" or not integ.get("expected"):
            continue
        given = str(submitted.get(item["question_key"], "")).strip()
        expected = str(integ["expected"]).strip()
        if given and given.lower() != expected.lower():
            findings.append(AgentFinding(
                agent_name="trap_check",
                finding_type="trap_failed",
                description=(
                    f"Trap question '{item['question_key']}' answered "
                    f"“{given[:80]}” — the only honest answer is "
                    f"“{expected}”. This question was designed so that any "
                    "other answer indicates fabrication."
                ),
                confidence=90,
                raw_output={"question_key": item["question_key"],
                            "given": given, "expected": expected,
                            "note": integ.get("note")},
            ))

    # Straightlining (industry-standard signal, weighted not disqualifying:
    # a straightliner may genuinely agree): with enough choice questions,
    # the same option position chosen nearly every time is suspicious.
    select_items = [
        i for i in context.get("questionnaire_items") or []
        if i.get("question_type") == "select_one"
    ]
    if len(select_items) >= 5:
        submitted_answers = context.get("answers") or {}
        positions = []
        for item in select_items:
            given = str(submitted_answers.get(item["question_key"], "")).strip().lower()
            names = [str(c.get("name", "")).lower() for c in (item.get("choices") or [])]
            if given and given in names:
                positions.append(names.index(given))
        if len(positions) >= 5:
            most_common = max(set(positions), key=positions.count)
            share = positions.count(most_common) / len(positions)
            if share >= 0.8:
                findings.append(AgentFinding(
                    agent_name="straightline_check",
                    finding_type="straightlining",
                    description=(
                        f"{positions.count(most_common)} of {len(positions)} choice "
                        "questions were answered with the same option position — "
                        "a straightlining pattern. Weighted, not disqualifying: "
                        "check the recording before concluding."
                    ),
                    confidence=int(min(85, 40 + share * 50)),
                    raw_output={"share": round(share, 2), "answered": len(positions)},
                ))

    # Deterministic duration check: a real interview takes real time.
    # Below a plausible minimum for the questionnaire's size, an explicit
    # finding is raised — no LLM involved, pure arithmetic evidence.
    if submission.started_at and submission.stopped_at:
        duration_s = (submission.stopped_at - submission.started_at).total_seconds()
        question_count = len(context.get("questionnaire_items") or [])
        min_expected = max(60, question_count * 15)  # ≥15s per question, ≥1 min overall
        if 0 < duration_s < min_expected:
            findings.append(AgentFinding(
                agent_name="timing_check",
                finding_type="short_interview",
                description=(
                    f"Interview lasted {int(duration_s)}s against {question_count} "
                    f"questions — below the plausible minimum of ~{min_expected}s. "
                    "Genuine interviews of this questionnaire take longer."
                ),
                confidence=85,
                timestamp_range_start=0,
                timestamp_range_end=int(duration_s),
            ))

    # Glance-Confirm, post-hoc half: extracted answers become their own
    # evidence artifact so the bridges and scorecard can read them as a
    # unit. They NEVER overwrite the enumerator's questionnaire_response
    # — humans confirm, AI drafts (constitution: AI standards).
    extracted = {
        f.raw_output["question_key"]: {
            "answer": f.raw_output.get("answer"),
            "quote": f.raw_output.get("quote"),
            "confidence": f.confidence,
        }
        for f in findings
        if f.finding_type == "extracted_answer" and f.raw_output.get("question_key")
    }
    if extracted:
        existing_ai = db.scalar(
            select(models.EvidenceArtifact).where(
                models.EvidenceArtifact.submission_id == submission_id,
                models.EvidenceArtifact.artifact_type == "ai_extracted_answers",
            )
        )
        if existing_ai is not None:
            existing_ai.payload = extracted  # idempotent re-score
        else:
            db.add(models.EvidenceArtifact(
                submission_id=submission_id,
                artifact_type="ai_extracted_answers",
                payload=extracted,
            ))

    # Checks that couldn't run are VISIBLE evidence, not silence — a
    # supervisor (and the founder debugging) must see coverage gaps on
    # the scorecard itself, not infer them from a confidence dip.
    for agent_name in failed_agents:
        findings.append(AgentFinding(
            agent_name=agent_name,
            finding_type="check_unavailable",
            description=f"The {agent_name.replace('_', ' ')} check could not run on this interview — its capability was unavailable. Confidence is reduced accordingly.",
            confidence=0,
        ))

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

    # Design Principle 8: pair automated detection with RANDOMIZED human
    # back-checks so enumerators can't reverse-engineer what triggers a
    # flag. Deterministic per session id (idempotent re-scoring), rate and
    # mechanism deliberately undisclosed outside this code.
    import hashlib
    random_backcheck = (
        int(hashlib.sha256(submission_id.encode()).hexdigest(), 16) % 20 == 0  # ~5%
    )

    late_start, early_stop = scoring.detect_timing_flags(
        submission.started_at,
        submission.stopped_at,
        submission.device1_call_started_at,
        submission.device1_call_ended_at,
    )
    cfg_for_scoring = db.get(models.CallProjectConfig, submission.project_id)
    result = scoring.synthesize(
        findings, late_start, early_stop, failed_agents,
        strictness=(cfg_for_scoring.strictness if cfg_for_scoring else "standard"),
    )
    if random_backcheck and result.recommended_action == "none":
        result.recommended_action = "conduct_backcheck"

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

    # Verified data flows downstream automatically (Bible Part 11 /
    # constitution 01): PASS interviews are handed to InsightScore via
    # fieldscore-backend's outbox. Best-effort — never fails scoring.
    if submission.verdict == "PASS":
        from app.services import insight_bridge
        insight_bridge.enqueue(db, submission)

    return scorecard
