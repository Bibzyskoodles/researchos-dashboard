"""Tier 2: Respondent Engagement Agent.
Hesitation, confusion, coaching indicators, third-party voices in the
background - signals the respondent may not be answering freely.
"""
from app.agents.base import BaseAgent, AgentFinding
from app.agents._transcript_judge import run_judgment, transcript_for_prompt

_SYSTEM = (
    "You audit respondent engagement in a research call transcript. Emit "
    "findings of type 'coaching_indicator' (someone prompting/feeding the "
    "respondent answers), 'third_party_voice' (an unexplained third speaker "
    "participating in answers), or 'low_engagement' (persistent confusion or "
    "disengagement that undermines answer quality). Quote the evidence."
)


class RespondentEngagementAgent(BaseAgent):
    name = "respondent_engagement"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        transcript = context.get("transcript")
        if not transcript:
            raise NotImplementedError
        return run_judgment(
            self.name, {"coaching_indicator", "third_party_voice", "low_engagement"},
            _SYSTEM, f"TRANSCRIPT:\n{transcript_for_prompt(transcript)}",
        )
