-- Call-mode project configuration + PII/audio access audit log.

-- Per-project Call configuration (Bible Part 7): the consent script is
-- localized project config displayed verbatim in the enumerator app —
-- never hardcoded, so wording can't drift and jurisdictions can differ.
CREATE TABLE IF NOT EXISTS call_project_config (
    project_id      TEXT PRIMARY KEY,          -- FieldScore project id (PROJ-…)
    consent_script  TEXT NOT NULL,
    consent_language TEXT NOT NULL DEFAULT 'en',
    jurisdiction    TEXT,                      -- e.g. 'NG-NDPR'
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bible Part 9: audit logging on every access to raw audio or respondent
-- PII — who viewed what, when. Append-only, same rules as override_log.
CREATE TABLE IF NOT EXISTS access_log (
    id BIGSERIAL PRIMARY KEY,
    accessed_by TEXT NOT NULL,                 -- user id from the Bearer token
    resource_type TEXT NOT NULL CHECK (resource_type IN (
        'respondent_pii', 'raw_audio', 'trust_record'
    )),
    resource_id TEXT NOT NULL,                 -- respondent/submission/enumerator ref
    detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_access_log_resource ON access_log(resource_type, resource_id);
CREATE OR REPLACE RULE no_update_access_log AS
    ON UPDATE TO access_log DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_access_log AS
    ON DELETE TO access_log DO INSTEAD NOTHING;
