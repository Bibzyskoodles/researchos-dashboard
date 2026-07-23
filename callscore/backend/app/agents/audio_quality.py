"""Tier 1: Audio Quality Agent.
Flags noise/cross-talk/unusable segments BEFORE downstream agents waste
effort on bad input. Should run first and can short-circuit the pipeline
to 'needs re-record' if quality is below threshold.
"""
from app.agents.base import BaseAgent, AgentFinding


class AudioQualityAgent(BaseAgent):
    name = "audio_quality"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        raise NotImplementedError
