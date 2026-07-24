"""Tier 2: Conversation Naturalness Agent.
Does this sound like a genuine, unscripted exchange or a read-aloud/
rehearsed one? Complements Fabrication detection at Tier 3.
"""
from app.agents.base import BaseAgent, AgentFinding
from app.agents._transcript_judge import run_judgment, transcript_for_prompt

_SYSTEM = (
    "You judge whether a research interview transcript is a genuine "
    "conversation or a scripted/rehearsed performance (both voices reading, "
    "unnaturally fluent answers, zero repair/backchannel, respondent "
    "'answers' arriving before questions finish). Emit findings of type "
    "'scripted_exchange' only when the evidence is concrete — quote it."
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
