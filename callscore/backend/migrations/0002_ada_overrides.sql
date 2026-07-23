-- Ada override audit log. See docs/ARCHITECTURE_BIBLE.md Part 4A.6.
--
-- Every time a human approves an interview against Ada's recommendation to
-- escalate/back-check, or rejects one Ada scored as low-risk, that override
-- must be logged. Without this an organization cannot answer "why was this
-- fraudulent interview approved" during an external audit.

CREATE TABLE ada_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_session_id UUID NOT NULL REFERENCES interview_sessions(id),
    scorecard_id UUID NOT NULL REFERENCES scorecards(id),

    ada_recommended_action TEXT NOT NULL,   -- what Ada/risk_recommendation agent said
    human_action_taken TEXT NOT NULL,       -- what the human actually did
    overridden_by UUID NOT NULL,            -- references a users table (not yet modeled)
    reason TEXT NOT NULL,                   -- free-text justification, required not optional

    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ada_overrides_session ON ada_overrides(interview_session_id);
