"""
SQLAlchemy ORM models. Mirrors migrations/0001_init.sql and
0002_ada_overrides.sql exactly — the SQL migrations are the source of
truth for the schema; keep these in lockstep.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, CheckConstraint, ForeignKey, Integer, Text, text
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Organization(Base):
    __tablename__ = "organizations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    region: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Enumerator(Base):
    # Shared identity across CallScore and FieldScore (Bible 4.6 / 4A.4).
    __tablename__ = "enumerators"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    full_name: Mapped[str] = mapped_column(Text, nullable=False)
    phone_number: Mapped[Optional[str]] = mapped_column(Text)
    external_ref: Mapped[Optional[str]] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("organizations.id"), nullable=False)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    questionnaire_source: Mapped[Optional[str]] = mapped_column(Text)
    consent_script: Mapped[str] = mapped_column(Text, nullable=False)
    jurisdiction: Mapped[Optional[str]] = mapped_column(Text)
    integration_mode: Mapped[str] = mapped_column(Text, nullable=False, default="standalone")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class QuestionnaireItem(Base):
    __tablename__ = "questionnaire_items"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False)
    question_key: Mapped[str] = mapped_column(Text, nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    is_required: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    skip_logic: Mapped[Optional[dict]] = mapped_column(JSONB)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)


class Respondent(Base):
    __tablename__ = "respondents"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(Text)
    phone_number: Mapped[Optional[str]] = mapped_column(Text)
    metadata_: Mapped[Optional[dict]] = mapped_column("metadata", JSONB)


class EnumeratorProjectAssignment(Base):
    __tablename__ = "enumerator_project_assignments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enumerator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enumerators.id"), nullable=False)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False)
    assigned_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))


class InterviewSession(Base):
    __tablename__ = "interview_sessions"

    # Client-generated UUID for offline idempotency (Bible 5.3) — no default.
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id"), nullable=False)
    enumerator_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("enumerators.id"), nullable=False)
    respondent_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("respondents.id"), nullable=False)

    started_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    stopped_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))

    device1_call_started_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))
    device1_call_ended_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))

    consent_captured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    integration_mode: Mapped[str] = mapped_column(Text, nullable=False, default="standalone")
    sync_status: Mapped[str] = mapped_column(Text, nullable=False, default="pending")
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    evidence_artifacts: Mapped[list["EvidenceArtifact"]] = relationship(back_populates="session")
    agent_findings: Mapped[list["AgentFindingRow"]] = relationship(back_populates="session")
    scorecard: Mapped[Optional["Scorecard"]] = relationship(back_populates="session", uselist=False)


class EvidenceArtifact(Base):
    __tablename__ = "evidence_artifacts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interview_sessions.id"), nullable=False)
    artifact_type: Mapped[str] = mapped_column(Text, nullable=False)
    storage_ref: Mapped[Optional[str]] = mapped_column(Text)
    payload: Mapped[Optional[dict]] = mapped_column(JSONB)
    timestamp_range_start: Mapped[Optional[int]] = mapped_column(Integer)
    timestamp_range_end: Mapped[Optional[int]] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    session: Mapped[InterviewSession] = relationship(back_populates="evidence_artifacts")


class AgentFindingRow(Base):
    # Named AgentFindingRow to avoid clashing with the in-pipeline
    # dataclass app.agents.base.AgentFinding.
    __tablename__ = "agent_findings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interview_sessions.id"), nullable=False)
    agent_name: Mapped[str] = mapped_column(Text, nullable=False)
    finding_type: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    timestamp_range_start: Mapped[Optional[int]] = mapped_column(Integer)
    timestamp_range_end: Mapped[Optional[int]] = mapped_column(Integer)
    confidence: Mapped[Optional[int]] = mapped_column(Integer)
    raw_output: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    session: Mapped[InterviewSession] = relationship(back_populates="agent_findings")


class Scorecard(Base):
    __tablename__ = "scorecards"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("interview_sessions.id"), nullable=False, unique=True
    )
    overall_quality_score: Mapped[Optional[int]] = mapped_column(Integer)
    authenticity_score: Mapped[Optional[int]] = mapped_column(Integer)
    compliance_score: Mapped[Optional[int]] = mapped_column(Integer)
    behaviour_score: Mapped[Optional[int]] = mapped_column(Integer)
    fraud_risk: Mapped[Optional[str]] = mapped_column(Text)
    confidence_level: Mapped[Optional[int]] = mapped_column(Integer)
    recommended_action: Mapped[Optional[str]] = mapped_column(Text)
    late_start_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    early_stop_flag: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    generated_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))

    session: Mapped[InterviewSession] = relationship(back_populates="scorecard")


class SyncQueueEntry(Base):
    __tablename__ = "sync_queue"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interview_sessions.id"), nullable=False)
    upload_status: Mapped[str] = mapped_column(Text, nullable=False, default="queued")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(TIMESTAMP(timezone=True))


class AdaOverride(Base):
    # Bible 4A.6: every human decision against Ada's recommendation is
    # logged — who, when, and a required free-text reason.
    __tablename__ = "ada_overrides"
    __table_args__ = (CheckConstraint("length(trim(reason)) > 0", name="ada_overrides_reason_required"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    interview_session_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("interview_sessions.id"), nullable=False)
    scorecard_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scorecards.id"), nullable=False)
    recommended_action: Mapped[str] = mapped_column(Text, nullable=False)
    human_action: Mapped[str] = mapped_column(Text, nullable=False)
    overridden_by: Mapped[str] = mapped_column(Text, nullable=False)
    reason: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), server_default=text("now()"))
