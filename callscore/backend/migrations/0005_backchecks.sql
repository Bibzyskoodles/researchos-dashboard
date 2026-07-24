-- AI back-check calls (Design Principle 8 closed-loop).
--
-- Scope guard, stated where the schema lives: AI voice agents conduct
-- BACK-CHECK verification calls only — never primary interviews. The
-- conversation itself stays deliberately human (Bible 8.4); a back-check
-- is a verification of that human conversation, discloses that it is
-- automated, and asks only about the interview experience.
CREATE TABLE IF NOT EXISTS backcheck_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id TEXT NOT NULL,
    provider TEXT NOT NULL DEFAULT 'vapi',
    provider_call_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'dispatched', 'completed', 'failed')),
    dispatched_by TEXT NOT NULL,
    transcript TEXT,
    summary TEXT,
    result JSONB,                       -- provider end-of-call analysis payload
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_backcheck_calls_submission ON backcheck_calls(submission_id);
