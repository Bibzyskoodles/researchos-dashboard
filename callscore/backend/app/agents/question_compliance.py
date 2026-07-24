"""Tier 2: Question Compliance Agent.
Confirms every required question (from questionnaire_items, derived from
the XLSForm on import) was asked in substance. Output feeds directly into
compliance_score on the scorecard.
"""
from app.agents.base import BaseAgent, AgentFinding
from app.agents._transcript_judge import run_judgment, transcript_for_prompt

_SYSTEM = (
    "You are a survey-compliance auditor. Given a questionnaire and an "
    "interview transcript with timestamps, identify REQUIRED questions that "
    "were never asked in substance (rephrasing counts as asked; skipping or "
    "answering on the respondent's behalf does not). Emit one finding of "
    "type 'missing_question' per unasked required question, citing the "
    "question key and where in the transcript the interviewer moved past it."
)


class QuestionComplianceAgent(BaseAgent):
    name = "question_compliance"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        transcript = context.get("transcript")
        questions = context.get("questionnaire_items") or []
        if not transcript or not questions:
            raise NotImplementedError
        qlist = "\n".join(
            f"- [{q['question_key']}]{' (required)' if q['is_required'] else ''} {q['question_text']}"
            for q in questions
        )
        return run_judgment(
            self.name, {"missing_question"}, _SYSTEM,
            f"QUESTIONNAIRE:\n{qlist}\n\nTRANSCRIPT:\n{transcript_for_prompt(transcript)}",
        )
