-- CallScore reconciled schema — Call capture mode on FieldScore's live DB.
--
-- Target: the Railway Postgres that fieldscore-backend's db.py owns
-- (system of record for `submissions`). This migration is ADDITIVE ONLY:
-- it extends `submissions` and adds Call-specific tables keyed on the
-- TEXT submission_id. It replaces this repo's original 0001_init.sql,
-- which proposed parallel organizations/projects/interview_sessions
-- tables — see docs/RECONCILIATION.md for the mapping and decisions.
--
-- Decisions applied (docs/RECONCILIATION.md §3, approved 2026-07-23):
--   3.1 enumerators = identity REGISTRY only; stats stay computed live
--   3.2 call sub-scores in slim call_scorecards; headline verdict/grade
--       still written to submissions
--   3.3 override audit = shared append-only override_log (both modes)
--   3.4 pipeline runs as a separate service sharing this database

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── submissions: Call-mode columns (safe on existing rows) ──────────────
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS collection_mode TEXT NOT NULL DEFAULT 'field';
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS respondent_id TEXT;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;          -- Start Interview press
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS stopped_at TIMESTAMPTZ;          -- Stop Interview press
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS device1_call_started_at TIMESTAMPTZ;  -- BLE-reported
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS device1_call_ended_at TIMESTAMPTZ;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS consent_captured BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS sync_status TEXT;                -- pending|synced|processing|processed|failed (call mode only)

CREATE INDEX IF NOT EXISTS idx_submissions_mode ON submissions(collection_mode);

-- ── enumerator identity registry (decision 3.1) ─────────────────────────
-- Identity + enrolment metadata ONLY. Performance stats are ALWAYS
-- computed live from submissions (see fieldscore-backend
-- enumerator_stats.py and the dead enumerator_memory table for why no
-- cached stats live here). enumerator_ref matches the free-text
-- enumerator_id already on submission rows.
CREATE TABLE IF NOT EXISTS enumerators (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    org_id          TEXT NOT NULL,
    enumerator_ref  TEXT NOT NULL,             -- = submissions.enumerator_id
    display_name    TEXT,
    phone_number    TEXT,                      -- encrypted at application layer
    voice_fingerprint_ref TEXT,                -- enrolment artifact for Tier 3 voice agent
    external_ref    TEXT,                      -- HR system id etc.
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT unique_enumerator_per_org UNIQUE (org_id, enumerator_ref)
);

-- ── respondents (Call-specific; FieldScore has no respondent entity) ────
CREATE TABLE IF NOT EXISTS respondents (
    id              TEXT PRIMARY KEY,          -- client-generated for offline creation
    org_id          TEXT NOT NULL,
    project_id      TEXT NOT NULL,             -- FieldScore project id (PROJ-…)
    display_name    TEXT,
    phone_number    TEXT,                      -- encrypted at application layer (Bible Part 9)
    metadata        JSONB
);
CREATE INDEX IF NOT EXISTS idx_respondents_project ON respondents(project_id);

-- ── questionnaire items (drives Tier 0 + Question Compliance) ───────────
CREATE TABLE IF NOT EXISTS questionnaire_items (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id      TEXT NOT NULL,
    question_key    TEXT NOT NULL,             -- XLSForm field name
    question_text   TEXT NOT NULL,
    is_required     BOOLEAN NOT NULL DEFAULT TRUE,
    skip_logic      JSONB,
    sort_order      INT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_questionnaire_project ON questionnaire_items(project_id);

-- ── evidence artifacts (never the raw screenshot — Bible 6.1) ───────────
CREATE TABLE IF NOT EXISTS evidence_artifacts (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id   TEXT NOT NULL,             -- FK-by-convention to submissions (db.py owns that table)
    artifact_type   TEXT NOT NULL
        CHECK (artifact_type IN (
            'audio', 'consent_recording', 'ble_call_state_log',
            'screenshot_extracted_fields', 'questionnaire_response'
        )),
    storage_ref     TEXT,
    payload         JSONB,
    timestamp_range_start INT,
    timestamp_range_end INT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_evidence_submission ON evidence_artifacts(submission_id);

-- ── agent findings (Tier 1-3 structured output) ─────────────────────────
CREATE TABLE IF NOT EXISTS agent_findings (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id   TEXT NOT NULL,
    agent_name      TEXT NOT NULL,
    finding_type    TEXT NOT NULL,
    description     TEXT NOT NULL,
    timestamp_range_start INT,
    timestamp_range_end INT,
    confidence      INT CHECK (confidence BETWEEN 0 AND 100),
    raw_output      JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_findings_submission ON agent_findings(submission_id);

-- ── call scorecards (decision 3.2 — slim sub-score table) ───────────────
-- Headline verdict/grade/overall_score are written to submissions so the
-- shared dashboards/leaderboard treat both modes identically.
CREATE TABLE IF NOT EXISTS call_scorecards (
    submission_id   TEXT PRIMARY KEY,
    authenticity_score INT CHECK (authenticity_score BETWEEN 0 AND 100),
    compliance_score   INT CHECK (compliance_score BETWEEN 0 AND 100),
    behaviour_score    INT CHECK (behaviour_score BETWEEN 0 AND 100),
    confidence_level   INT CHECK (confidence_level BETWEEN 0 AND 100),
    fraud_risk      TEXT CHECK (fraud_risk IN ('low', 'medium', 'high')),
    recommended_action TEXT CHECK (recommended_action IN (
        'none', 'review_recording', 'conduct_backcheck', 'escalate'
    )),
    late_start_flag BOOLEAN NOT NULL DEFAULT FALSE,
    early_stop_flag BOOLEAN NOT NULL DEFAULT FALSE,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── sync queue (offline-first uploads, idempotent on submission_id) ─────
CREATE TABLE IF NOT EXISTS sync_queue (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id   TEXT NOT NULL UNIQUE,
    upload_status   TEXT NOT NULL DEFAULT 'queued'
        CHECK (upload_status IN ('queued', 'uploading', 'complete', 'failed')),
    attempts        INT NOT NULL DEFAULT 0,
    last_attempt_at TIMESTAMPTZ
);

-- ── shared override audit log (decision 3.3, Bible 4A.6) ────────────────
-- Append-only, both modes. FieldScore's existing override_* columns on
-- submissions remain the current-state display; every override event ALSO
-- appends here with a mandatory reason. fieldscore-backend's override
-- write path should be extended to insert here (separate change in that repo).
CREATE TABLE IF NOT EXISTS override_log (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id   TEXT NOT NULL,
    source_mode     TEXT NOT NULL CHECK (source_mode IN ('field', 'call')),
    recommended_action TEXT,                   -- what the system recommended (Ada, for call)
    previous_verdict TEXT,
    human_action    TEXT NOT NULL,
    overridden_by   TEXT NOT NULL,             -- FieldScore user id (TEXT)
    reason          TEXT NOT NULL CHECK (length(trim(reason)) > 0),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_override_log_submission ON override_log(submission_id);

CREATE OR REPLACE RULE no_update_override_log AS
    ON UPDATE TO override_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_override_log AS
    ON DELETE TO override_log DO INSTEAD NOTHING;
