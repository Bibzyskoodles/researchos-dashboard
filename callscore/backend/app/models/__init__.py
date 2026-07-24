"""
SQLAlchemy ORM models for the reconciled schema (see docs/RECONCILIATION.md).

This service shares fieldscore-backend's Railway Postgres. Two kinds of
models live here:

1. Call-specific tables owned by THIS service — created by
   migrations/0001_call_mode.sql.
2. A partial mapping of `submissions`, which is OWNED BY fieldscore-backend's
   db.py. Only the columns Call mode reads/writes are mapped; never emit DDL
   for it from here (no metadata.create_all against this Base in production).

IDs are TEXT throughout to match FieldScore's conventions (PROJ-…, free-text
enumerator ids, client-generated submission ids).
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Submission(Base):
    # Partial mapping of fieldscore-backend's submissions table (db.py owns
    # the full definition). collection_mode/consent/timing columns come from
    # migrations/0001_call_mode.sql.
    __tablename__ = "submissions"

    submission_id: Mapped[str] = mapped_column(Text, primary_key=True)  # client-generated in call mode
    org_id: Mapped[Optional[str]] = mapped_column(Text)
    project_id: Mapped[Optional[str]] = mapped_column(Text)
    enumerator_id: Mapped[Optional[str]] = mapped_column(Text)

    collection_mode: Mapped[str] = mapped_column(Text, default="call")
    respondent_id: Mapped[Optional[str]] = mapped_column(Text)
    started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    stopped_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    device1_call_started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    device1_call_ended_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    consent_captured: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_status: Mapped[Optional[str]] = mapped_column(Text)

    # Shared scoring vocabulary — headline results both modes render.
    overall_score: Mapped[Optional[int]] = mapped_column(Integer)
    grade: Mapped[Optional[str]] = mapped_column(Text)
    verdict: Mapped[Optional[str]] = mapped_column(Text)      # PASS | FLAG | REJECT
    fraud_flag: Mapped[Optional[str]] = mapped_column(Text)
    supervisor_action: Mapped[Optional[str]] = mapped_column(Text)
    review_status: Mapped[Optional[str]] = mapped_column(Text)


class Enumerator(Base):
    # Identity REGISTRY only (decision 3.1) — stats are computed live from
    # submissions, never cached here.
    __tablename__ = "enumerators"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    org_id: Mapped[str] = mapped_column(Text, nullable=False)
    enumerator_ref: Mapped[str] = mapped_column(Text, nullable=False)  # = submissions.enumerator_id
    display_name: Mapped[Optional[str]] = mapped_column(Text)
    phone_number: Mapped[Optional[str]] = mapped_column(Text)
    voice_fingerprint_ref: Mapped[Optional[str]] = mapped_column(Text)
    external_ref: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Respondent(Base):
    __tablename__ = "respondents"

    id: Mapped[str] = mapped_column(Text, primary_key=True)  # client-generated
    org_id: Mapped[str] = mapped_column(Text, nullable=False)
    project_id: Mapped[str] = mapped_column(Text, nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(Text)
    phone_number: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)


class QuestionnaireItem(Base):
    __tablename__ = "questionnaire_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[str] = mapped_column(Text, nullable=False)
    question_key: Mapped[str] = mapped_column(Text, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    skip_logic: Mapped[Optional[dict]] = mapped_column(JSONB)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class EvidenceArtifact(Base):
    __tablename__ = "evidence_artifacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[str] = mapped_column(Text, nullable=False)
    artifact_type: Mapped[str] = mapped_column(Text, nullable=False)
    storage_ref: Mapped[Optional[str]] = mapped_column(Text)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB)
    timestamp_range_start: Mapped[Optional[int]] = mapped_column(Integer)
    timestamp_range_end: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class AgentFindingRow(Base):
    # Named AgentFindingRow to avoid clashing with the in-pipeline
    # dataclass app.agents.base.AgentFinding.
    __tablename__ = "agent_findings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[str] = mapped_column(Text, nullable=False)
    agent_name: Mapped[str] = mapped_column(Text, nullable=False)
    finding_type: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp_range_start: Mapped[Optional[int]] = mapped_column(Integer)
    timestamp_range_end: Mapped[Optional[int]] = mapped_column(Integer)
    confidence: Mapped[Optional[int]] = mapped_column(Integer)
    raw_output: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class CallScorecard(Base):
    # Slim sub-score table (decision 3.2). Headline verdict/grade/
    # overall_score live on submissions.
    __tablename__ = "call_scorecards"

    submission_id: Mapped[str] = mapped_column(Text, primary_key=True)
    authenticity_score: Mapped[Optional[int]] = mapped_column(Integer)
    compliance_score: Mapped[Optional[int]] = mapped_column(Integer)
    behaviour_score: Mapped[Optional[int]] = mapped_column(Integer)
    confidence_level: Mapped[Optional[int]] = mapped_column(Integer)
    fraud_risk: Mapped[Optional[str]] = mapped_column(Text)
    recommended_action: Mapped[Optional[str]] = mapped_column(Text)
    late_start_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    early_stop_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    generated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class SyncQueueEntry(Base):
    __tablename__ = "sync_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    upload_status: Mapped[str] = mapped_column(Text, nullable=False, default="queued")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))


class CallProjectConfig(Base):
    # Per-project Call configuration (Bible Part 7) — consent script is
    # displayed verbatim in the enumerator app, localized per project.
    __tablename__ = "call_project_config"

    project_id: Mapped[str] = mapped_column(Text, primary_key=True)
    consent_script: Mapped[str] = mapped_column(Text, nullable=False)
    consent_language: Mapped[str] = mapped_column(Text, nullable=False, default="en")
    jurisdiction: Mapped[Optional[str]] = mapped_column(Text)
    # Speech-engine routing (migrations/0003): which STT providers run for
    # this project's interviews. Null = language-aware default.
    stt_language: Mapped[Optional[str]] = mapped_column(Text)
    stt_primary: Mapped[Optional[str]] = mapped_column(Text)
    stt_verify: Mapped[Optional[str]] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class BackcheckCall(Base):
    # AI back-check verification call (migrations/0005). Never a primary
    # interview — Bible 8.4 keeps the conversation itself human.
    __tablename__ = "backcheck_calls"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(Text, nullable=False, default="vapi")
    provider_call_id: Mapped[Optional[str]] = mapped_column(Text)
    status: Mapped[str] = mapped_column(Text, nullable=False, default="queued")
    dispatched_by: Mapped[str] = mapped_column(Text, nullable=False)
    transcript: Mapped[Optional[str]] = mapped_column(Text)
    summary: Mapped[Optional[str]] = mapped_column(Text)
    result: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
    completed_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))


class FindingFeedback(Base):
    # Supervisor verdicts on individual AI findings — append-only
    # calibration signal (migrations/0004).
    __tablename__ = "finding_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    finding_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    submission_id: Mapped[str] = mapped_column(Text, nullable=False)
    agent_name: Mapped[str] = mapped_column(Text, nullable=False)
    verdict: Mapped[str] = mapped_column(Text, nullable=False)  # correct|incorrect|unsure
    note: Mapped[Optional[str]] = mapped_column(Text)
    given_by: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class AppFeedback(Base):
    __tablename__ = "app_feedback"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(Text, nullable=False)  # mobile|link|dashboard
    category: Mapped[Optional[str]] = mapped_column(Text)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    submitted_by: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class AccessLogEntry(Base):
    # Bible Part 9: append-only audit of every raw-audio / respondent-PII /
    # trust-record access — who viewed what, when.
    __tablename__ = "access_log"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    accessed_by: Mapped[str] = mapped_column(Text, nullable=False)
    resource_type: Mapped[str] = mapped_column(Text, nullable=False)
    resource_id: Mapped[str] = mapped_column(Text, nullable=False)
    detail: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class OverrideLogEntry(Base):
    # Shared append-only override audit (decision 3.3, Bible 4A.6).
    __tablename__ = "override_log"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    submission_id: Mapped[str] = mapped_column(Text, nullable=False)
    source_mode: Mapped[str] = mapped_column(Text, nullable=False)  # 'field' | 'call'
    recommended_action: Mapped[Optional[str]] = mapped_column(Text)
    previous_verdict: Mapped[Optional[str]] = mapped_column(Text)
    human_action: Mapped[str] = mapped_column(Text, nullable=False)
    overridden_by: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
