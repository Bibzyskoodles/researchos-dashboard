-- Agent mode (Bible Part 12, Revision 2): AI-conducted interviews as an
-- optional third capture mode. Submissions carry collection_mode='agent';
-- this table tracks the outbound provider call per interview.
CREATE TABLE IF NOT EXISTS agent_interview_calls (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    submission_id TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL DEFAULT 'vapi',
    provider_call_id TEXT,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'dispatched', 'completed', 'consent_declined', 'failed')),
    dispatched_by TEXT NOT NULL,
    transcript TEXT,
    recording_url TEXT,
    result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_agent_calls_submission ON agent_interview_calls(submission_id);
