"""Tier 1: Transcription & Diarization Agent.
Speech-to-text with speaker separation (enumerator vs respondent).
Language/accent handling is a named risk - see Bible Part 11. Do not
assume default Whisper is sufficient for code-switched Nigerian languages
without evaluation.
"""
from app.agents.base import BaseAgent, AgentFinding


class TranscriptionDiarizationAgent(BaseAgent):
    name = "transcription_diarization"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        # TODO: run STT model, diarize speakers, return transcript as
        # structured output (not just an AgentFinding - this feeds the
        # transcript object every Tier 2 agent consumes)
        raise NotImplementedError
