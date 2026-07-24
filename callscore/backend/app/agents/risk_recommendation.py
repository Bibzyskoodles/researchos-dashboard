"""Tier 4: Risk & Recommendation Agent.
Produces the final Scorecard (see docs/ARCHITECTURE_BIBLE.md Part 4.4)
and the specific recommended_action. This is the last step before a
result is shown to a supervisor.
"""
from app.agents.base import BaseAgent, AgentFinding


class RiskRecommendationAgent(BaseAgent):
    name = "risk_recommendation"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        raise NotImplementedError
