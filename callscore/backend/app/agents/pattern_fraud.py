"""Tier 3: Pattern Fraud Agent.
Benford's-law-style numeric checks, response-time clustering, timing
anomalies across an enumerator's FULL interview portfolio, not just this
one interview. Runs batched, not per-session.
"""
from app.agents.base import BaseAgent, AgentFinding


class PatternFraudAgent(BaseAgent):
    name = "pattern_fraud"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        raise NotImplementedError
