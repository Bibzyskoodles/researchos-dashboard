"""Tier 2: Conversation Naturalness Agent.
Does this sound like a genuine, unscripted exchange or a read-aloud/
rehearsed one? Complements Fabrication detection at Tier 3.
"""
from app.agents.base import BaseAgent, AgentFinding
from app.agents._transcript_judge import run_judgment, transcript_for_prompt

_SYSTEM = (
    "You judge whether a research interview transcript is a genuine "
    "conversation or a scripted/rehearsed performance. Founder-calibrated "
    "rules, learned from real false positives:\n"
    "- SHORT ANSWERS ARE NORMAL. 'Very likely', 'No', 'Daily' are exactly "
    "how real respondents answer closed survey questions on a phone call. "
    "Brevity alone is NEVER evidence of scripting.\n"
    "- Timing claims must be PROVEN by the timestamps: only claim an "
    "answer 'arrived before the question finished' if the answer "
    "segment's start time is genuinely earlier than the question "
    "segment's end time. Never infer overlap from flow.\n"
    "- Real scripting evidence: both parties audibly reading (unnatural "
    "prosody markers in wording), answers that repeat the question's "
    "exact phrasing verbatim across MULTIPLE exchanges, zero "
    "backchannel/repair across a LONG interview, or answers to "
    "questions that were never asked.\n"
    "Emit findings of type 'scripted_exchange' only when at least one of "
    "those concrete patterns is present — quote it. When in doubt, emit "
    "nothing: a false scripting accusation against an honest enumerator "
    "is worse than a miss."
)


class ConversationNaturalnessAgent(BaseAgent):
    name = "conversation_naturalness"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        transcript = context.get("transcript")
        if not transcript:
            raise NotImplementedError
        return run_judgment(
            self.name, {"scripted_exchange"}, _SYSTEM,
            f"TRANSCRIPT:\n{transcript_for_prompt(transcript)}",
        )
