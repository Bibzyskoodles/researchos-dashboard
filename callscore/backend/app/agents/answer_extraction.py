"""Tier 2: Answer Extraction Agent (Glance-Confirm, post-hoc half).

Reads the transcript against the questionnaire and produces the answers
it heard — each grounded in a transcript quote with its own confidence.
AI drafts, humans confirm (constitution: AI standards): extracted answers
NEVER overwrite what the enumerator typed. They fill blanks — clearly
marked as AI-extracted — and surface alongside typed answers so the
supervisor sees both. Findings are informational: they carry no score
penalty (scoring._INFORMATIONAL), unlike answer_consistency mismatches.
"""
import json

from app.agents.base import BaseAgent, AgentFinding
from app.agents._transcript_judge import transcript_for_prompt
from app.services import llm

_SYSTEM = (
    "You extract questionnaire answers from a research interview transcript. "
    "For each question, find where it was answered in the conversation and "
    "extract the respondent's answer, concise and faithful to their words. "
    "Only extract answers the respondent actually gave — if a question was "
    "not asked or not answered, skip it entirely. Never infer or guess. "
    'Respond with JSON: {"answers": [{"question_key": string, '
    '"answer": string, "quote": string (the exact transcript line(s) the '
    'answer comes from), "start_s": number|null, "end_s": number|null, '
    '"confidence": number 0-100}]}. '
    'If nothing was answered, return {"answers": []}.'
)


class AnswerExtractionAgent(BaseAgent):
    name = "answer_extraction"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        transcript = context.get("transcript")
        items = context.get("questionnaire_items") or []
        if not transcript or not items:
            raise NotImplementedError
        if not llm.available():
            raise NotImplementedError

        questions = [
            {"question_key": i["question_key"], "question_text": i["question_text"]}
            for i in items
        ]
        result = llm.judge(
            _SYSTEM,
            f"QUESTIONNAIRE:\n{json.dumps(questions, indent=1)[:6000]}\n\n"
            f"TRANSCRIPT:\n{transcript_for_prompt(transcript)}",
        )
        if result is None:
            raise NotImplementedError

        valid_keys = {q["question_key"] for q in questions}
        findings: list[AgentFinding] = []
        for a in result.get("answers", []):
            key = str(a.get("question_key", ""))
            answer = str(a.get("answer", "")).strip()
            quote = str(a.get("quote", "")).strip()
            # No quote, no answer: an extraction without concrete transcript
            # grounding is a guess (Design Principle 1) — dropped.
            if key not in valid_keys or not answer or not quote:
                continue
            try:
                confidence = max(0, min(100, int(a.get("confidence", 0))))
            except (TypeError, ValueError):
                continue

            def _sec(v):
                try:
                    return int(v) if v is not None else None
                except (TypeError, ValueError):
                    return None

            findings.append(AgentFinding(
                agent_name=self.name,
                finding_type="extracted_answer",
                description=f"{key}: “{answer}” — heard: “{quote[:200]}”",
                confidence=confidence,
                timestamp_range_start=_sec(a.get("start_s")),
                timestamp_range_end=_sec(a.get("end_s")),
                raw_output={"question_key": key, "answer": answer, "quote": quote},
            ))
        return findings
