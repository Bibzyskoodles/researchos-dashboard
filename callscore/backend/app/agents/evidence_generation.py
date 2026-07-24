"""Tier 4: Evidence Generation Agent.
Compiles ALL upstream AgentFindings into one human-readable evidence
packet. Design Principle 1 (Part 3): never introduces a conclusion not
sourced from an upstream finding.
"""
from app.agents.base import BaseAgent, AgentFinding


class EvidenceGenerationAgent(BaseAgent):
    name = "evidence_generation"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        # context['findings'] = flat list of every Tier 1-3 AgentFinding
        # for this interview_session_id
        raise NotImplementedError
