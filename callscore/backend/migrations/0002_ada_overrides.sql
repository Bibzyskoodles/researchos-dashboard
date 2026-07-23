-- Ada override audit log (Bible Part 4A.6).
-- Every human decision taken AGAINST Ada's recommended_action must be
-- recorded: approving an interview Ada said to escalate/back-check, or
-- rejecting one she scored low-risk. Reason is required, not optional.

CREATE TABLE ada_overrides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interview_session_id UUID NOT NULL REFERENCES interview_sessions(id),
    scorecard_id UUID NOT NULL REFERENCES scorecards(id),
    recommended_action TEXT NOT NULL,      -- what Ada recommended at time of override
    human_action TEXT NOT NULL
        CHECK (human_action IN ('approve', 'reject', 'backcheck', 'escalate')),
    overridden_by TEXT NOT NULL,           -- user identifier of the deciding human
    reason TEXT NOT NULL
        CHECK (length(trim(reason)) > 0),  -- free-text reason is mandatory
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ada_overrides_session ON ada_overrides(interview_session_id);
