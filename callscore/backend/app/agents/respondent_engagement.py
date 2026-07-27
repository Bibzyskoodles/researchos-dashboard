"""Tier 2: Respondent Engagement Agent.
Hesitation, confusion, coaching indicators, third-party voices in the
background - signals the respondent may not be answering freely.
"""
from app.agents.base import BaseAgent, AgentFinding
from app.agents._transcript_judge import run_judgment, transcript_for_prompt

_SYSTEM = (
    "You assess respondent engagement in a phone survey. Founder-"
    "calibrated rules from real false positives: SHORT DIRECT ANSWERS "
    "ARE NORMAL — 'No', 'Daily', 'None that I can think of' are exactly "
    "how genuine respondents answer closed or simple questions; brevity "
    "alone is NEVER low engagement. Only flag 'low_engagement' for "
    "concrete disengagement: refusing or deflecting multiple questions, "
    "audible distraction, answers unrelated to what was asked, or "
    "one-word replies to genuinely open questions that invite detail — "
    "quote the evidence. At most ONE low_engagement finding per "
    "interview. When in doubt, emit nothing."
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
