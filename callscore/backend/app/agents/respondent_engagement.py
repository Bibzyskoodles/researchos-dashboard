"""Tier 2: Respondent Engagement Agent.
Hesitation, confusion, coaching indicators, third-party voices in the
background - signals the respondent may not be answering freely.
"""
from app.agents.base import BaseAgent, AgentFinding


class RespondentEngagementAgent(BaseAgent):
    name = "respondent_engagement"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        raise NotImplementedError
