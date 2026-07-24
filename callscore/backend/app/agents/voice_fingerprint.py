"""Tier 3: Enumerator Voice Fingerprint Agent.
Confirms the assigned enumerator, not a substitute, conducted the
interview. Requires a reference voice sample enrolled per enumerator.
"""
from app.agents.base import BaseAgent, AgentFinding


class VoiceFingerprintAgent(BaseAgent):
    name = "voice_fingerprint"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        raise NotImplementedError
