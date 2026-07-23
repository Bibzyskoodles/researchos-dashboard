"""Tier 2: Conversation Naturalness Agent.
Does this sound like a genuine, unscripted exchange or a read-aloud/
rehearsed one? Complements Fabrication detection at Tier 3.
"""
from app.agents.base import BaseAgent, AgentFinding


class ConversationNaturalnessAgent(BaseAgent):
    name = "conversation_naturalness"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        raise NotImplementedError
