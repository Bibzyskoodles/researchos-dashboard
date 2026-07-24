-- Feedback loops.

-- Supervisor verdicts on individual AI findings — the calibration signal.
-- Append-only: later disagreement is a new row, never an edit, so agent
-- precision over time is computable honestly.
CREATE TABLE IF NOT EXISTS finding_feedback (
    id BIGSERIAL PRIMARY KEY,
    finding_id UUID NOT NULL,          -- agent_findings.id
    submission_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,          -- denormalized for cheap per-agent stats
    verdict TEXT NOT NULL CHECK (verdict IN ('correct', 'incorrect', 'unsure')),
    note TEXT,
    given_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_finding_feedback_agent ON finding_feedback(agent_name);
CREATE INDEX IF NOT EXISTS idx_finding_feedback_submission ON finding_feedback(submission_id);
CREATE OR REPLACE RULE no_update_finding_feedback AS
    ON UPDATE TO finding_feedback DO INSTEAD NOTHING;
CREATE OR REPLACE RULE no_delete_finding_feedback AS
    ON DELETE TO finding_feedback DO INSTEAD NOTHING;

-- Free-form product feedback from any surface (enumerator app, Link,
-- dashboard) — field problems reach the team without a WhatsApp thread.
CREATE TABLE IF NOT EXISTS app_feedback (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL CHECK (source IN ('mobile', 'link', 'dashboard')),
    category TEXT,
    message TEXT NOT NULL CHECK (length(trim(message)) > 0),
    submitted_by TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
