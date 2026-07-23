"""Tier 3: Similarity & Fabrication Agent.
Flags near-duplicate transcripts across supposedly independent interviews -
requires context.prior_interviews for the same enumerator/project.
"""
from app.agents.base import BaseAgent, AgentFinding


class SimilarityFabricationAgent(BaseAgent):
    name = "similarity_fabrication"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        raise NotImplementedError
