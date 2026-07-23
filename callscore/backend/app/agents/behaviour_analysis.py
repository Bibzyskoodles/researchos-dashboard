"""Tier 2: Behaviour Analysis Agent.
Pacing, interviewer dominance (speaking-time ratio), rushed segments.
"""
from app.agents.base import BaseAgent, AgentFinding


class BehaviourAnalysisAgent(BaseAgent):
    name = "behaviour_analysis"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        raise NotImplementedError
