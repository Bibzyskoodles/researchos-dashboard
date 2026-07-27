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
    "answering on the respondent's behalf does not). CONDITIONAL questions "
    "must NOT be counted missing when their condition did not apply: a "
    "question marked conditional, or whose wording begins 'If yes/If no/"
    "If applicable', is only owed when the triggering answer occurred — "
    "correctly skipping it is compliant, never a finding. Also never emit "
    "a finding for a question that WAS asked but merely lacked follow-up "
    "probing — missing_question means the question itself was never asked. "
    "Emit one finding of type 'missing_question' per genuinely unasked "
    "required question, citing the question key and where in the "
    "transcript the interviewer moved past it."
)


class QuestionComplianceAgent(BaseAgent):
    name = "question_compliance"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        transcript = context.get("transcript")
        questions = context.get("questionnaire_items") or []
        if not transcript or not questions:
            raise NotImplementedError
        qlist = "\n".join(
            f"- [{q['question_key']}]"
            f"{' (required)' if q['is_required'] else ''}"
            f"{' (conditional — only owed if its condition applies)' if q.get('skip_logic') else ''}"
            f" {q['question_text']}"
            for q in questions
        )
        return run_judgment(
            self.name, {"missing_question"}, _SYSTEM,
            f"QUESTIONNAIRE:\n{qlist}\n\nTRANSCRIPT:\n{transcript_for_prompt(transcript)}",
        )
