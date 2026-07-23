-- CallScore initial schema
-- Matches docs/ARCHITECTURE_BIBLE.md Part 5

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    region TEXT NOT NULL,              -- drives data residency / hosting selection
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enumerator identity is shared across CallScore and FieldScore.
-- Do not fork this table per-product; the unified trust record depends on it.
CREATE TABLE enumerators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    full_name TEXT NOT NULL,
    phone_number TEXT,                 -- encrypted at rest via pgcrypto in application layer
    external_ref TEXT,                 -- e.g. HR system ID, for cross-project matching
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id),
    name TEXT NOT NULL,
    questionnaire_source TEXT,         -- path/ref to imported XLSForm
    consent_script TEXT NOT NULL,      -- localized consent script for this project
    jurisdiction TEXT,                 -- drives consent flow config, e.g. 'NG-NDPR'
    integration_mode TEXT NOT NULL DEFAULT 'standalone'
        CHECK (integration_mode IN ('standalone', 'plugin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE questionnaire_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id),
    question_key TEXT NOT NULL,        -- matches XLSForm field name
    question_text TEXT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT true,
    skip_logic JSONB,                  -- derived from XLSForm relevance/constraint
    sort_order INT NOT NULL DEFAULT 0
);

CREATE TABLE respondents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id),
    display_name TEXT,
    phone_number TEXT,                 -- encrypted at rest via application layer
    metadata JSONB
);

CREATE TABLE enumerator_project_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enumerator_id UUID NOT NULL REFERENCES enumerators(id),
    project_id UUID NOT NULL REFERENCES projects(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The core unit of the system: one Start/Stop cycle.
CREATE TABLE interview_sessions (
    id UUID PRIMARY KEY,               -- client-generated UUID for offline idempotency
    project_id UUID NOT NULL REFERENCES projects(id),
    enumerator_id UUID NOT NULL REFERENCES enumerators(id),
    respondent_id UUID NOT NULL REFERENCES respondents(id),

    started_at TIMESTAMPTZ NOT NULL,   -- Start Interview press (device-local time)
    stopped_at TIMESTAMPTZ,            -- Stop Interview press

    -- BLE-reported call state, for late-start/early-stop discrepancy detection
    device1_call_started_at TIMESTAMPTZ,
    device1_call_ended_at TIMESTAMPTZ,

    consent_captured BOOLEAN NOT NULL DEFAULT false,
    integration_mode TEXT NOT NULL DEFAULT 'standalone',

    sync_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced', 'processing', 'processed', 'failed')),

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Never stores the raw screenshot. Only OCR-extracted structured fields.
CREATE TABLE evidence_artifacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_session_id UUID NOT NULL REFERENCES interview_sessions(id),
    artifact_type TEXT NOT NULL
        CHECK (artifact_type IN (
            'audio', 'consent_recording', 'ble_call_state_log',
            'screenshot_extracted_fields', 'questionnaire_response'
        )),
    storage_ref TEXT,                  -- object storage path, null for inline JSON artifacts
    payload JSONB,                     -- e.g. extracted {number, name, duration} for screenshot type
    timestamp_range_start INT,         -- seconds into the interview, if applicable
    timestamp_range_end INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Raw structured output from each Tier 1-3 agent.
CREATE TABLE agent_findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_session_id UUID NOT NULL REFERENCES interview_sessions(id),
    agent_name TEXT NOT NULL,          -- e.g. 'question_compliance', 'pattern_fraud'
    finding_type TEXT NOT NULL,
    description TEXT NOT NULL,
    timestamp_range_start INT,
    timestamp_range_end INT,
    confidence INT CHECK (confidence BETWEEN 0 AND 100),
    raw_output JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tier 4 synthesis output. One per interview session.
CREATE TABLE scorecards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_session_id UUID NOT NULL UNIQUE REFERENCES interview_sessions(id),
    overall_quality_score INT CHECK (overall_quality_score BETWEEN 0 AND 100),
    authenticity_score INT CHECK (authenticity_score BETWEEN 0 AND 100),
    compliance_score INT CHECK (compliance_score BETWEEN 0 AND 100),
    behaviour_score INT CHECK (behaviour_score BETWEEN 0 AND 100),
    fraud_risk TEXT CHECK (fraud_risk IN ('low', 'medium', 'high')),
    confidence_level INT CHECK (confidence_level BETWEEN 0 AND 100),
    recommended_action TEXT CHECK (recommended_action IN (
        'none', 'review_recording', 'conduct_backcheck', 'escalate'
    )),
    late_start_flag BOOLEAN NOT NULL DEFAULT false,
    early_stop_flag BOOLEAN NOT NULL DEFAULT false,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Offline upload queue tracking, keyed by client-generated interview_session_id
-- for idempotent retry behavior.
CREATE TABLE sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_session_id UUID NOT NULL REFERENCES interview_sessions(id),
    upload_status TEXT NOT NULL DEFAULT 'queued'
        CHECK (upload_status IN ('queued', 'uploading', 'complete', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ
);

CREATE INDEX idx_interview_sessions_project ON interview_sessions(project_id);
CREATE INDEX idx_interview_sessions_enumerator ON interview_sessions(enumerator_id);
CREATE INDEX idx_agent_findings_session ON agent_findings(interview_session_id);
CREATE INDEX idx_evidence_artifacts_session ON evidence_artifacts(interview_session_id);
