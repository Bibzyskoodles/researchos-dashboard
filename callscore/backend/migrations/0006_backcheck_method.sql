-- Back-checks are method-neutral: a HUMAN back-check (assigned to a
-- person, outcome recorded manually) or an AI verification call are two
-- ways of doing the same thing, and both land their result as evidence
-- the same way. Human is always available; AI requires a configured
-- voice-agent provider.
ALTER TABLE backcheck_calls ADD COLUMN IF NOT EXISTS method TEXT NOT NULL DEFAULT 'ai';
ALTER TABLE backcheck_calls ADD COLUMN IF NOT EXISTS assigned_to TEXT;
