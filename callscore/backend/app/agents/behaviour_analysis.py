"""Tier 2: Behaviour Analysis Agent.
Pacing, interviewer dominance, rushed segments. Speaking-time ratio needs
diarization (V1); MVP judges pacing and rushing from the timed transcript.
"""
from app.agents.base import BaseAgent, AgentFinding
from app.agents._transcript_judge import run_judgment, transcript_for_prompt

_SYSTEM = (
    "You audit interviewer behaviour in a research call transcript with "
    "timestamps. Emit findings of type 'rushed_segment' (a stretch where "
    "questions are fired without waiting for complete answers), 'pacing' "
    "(overall pace clearly too fast for considered answers), or "
    "'interviewer_dominance' (interviewer talks over or supplies answers). "
    "Cite the timestamps and quote the exchange."
)


class BehaviourAnalysisAgent(BaseAgent):
    name = "behaviour_analysis"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        transcript = context.get("transcript")
        if not transcript:
            raise NotImplementedError
        return run_judgment(
            self.name, {"rushed_segment", "pacing", "interviewer_dominance"},
            _SYSTEM, f"TRANSCRIPT:\n{transcript_for_prompt(transcript)}",
        )
