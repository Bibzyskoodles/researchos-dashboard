"""Tier 2: Answer Consistency Agent.
Compares what was said aloud (transcript) to what was submitted in the
questionnaire response. A mismatch here is high-value fraud evidence -
e.g. spoken income differs from submitted income value.
"""
from app.agents.base import BaseAgent, AgentFinding


class AnswerConsistencyAgent(BaseAgent):
    name = "answer_consistency"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        raise NotImplementedError
