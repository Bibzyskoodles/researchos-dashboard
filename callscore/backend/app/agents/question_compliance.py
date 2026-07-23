"""Tier 2: Question Compliance Agent.
Confirms every required question (from questionnaire_items, derived from
the XLSForm on import) was asked in substance. Output feeds directly into
compliance_score on the scorecard.
"""
from app.agents.base import BaseAgent, AgentFinding


class QuestionComplianceAgent(BaseAgent):
    name = "question_compliance"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        raise NotImplementedError
