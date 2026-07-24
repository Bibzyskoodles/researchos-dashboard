"""Tier 2: Answer Consistency Agent.
Compares what was said aloud (transcript) to what was submitted in the
questionnaire response. A mismatch here is high-value fraud evidence -
e.g. spoken income differs from submitted income value.
"""
import json

from app.agents.base import BaseAgent, AgentFinding
from app.agents._transcript_judge import run_judgment, transcript_for_prompt

_SYSTEM = (
    "You compare submitted questionnaire values against what the respondent "
    "actually said in the transcript. Emit one finding of type "
    "'answer_mismatch' per field where the spoken answer clearly contradicts "
    "the submitted value (quote both). Ignore minor phrasing differences, "
    "rounding, and fields never discussed aloud."
)


class AnswerConsistencyAgent(BaseAgent):
    name = "answer_consistency"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        transcript = context.get("transcript")
        answers = context.get("answers") or {}
        if not transcript or not answers:
            raise NotImplementedError
        return run_judgment(
            self.name, {"answer_mismatch"}, _SYSTEM,
            f"SUBMITTED ANSWERS:\n{json.dumps(answers, indent=1)[:4000]}\n\n"
            f"TRANSCRIPT:\n{transcript_for_prompt(transcript)}",
        )
