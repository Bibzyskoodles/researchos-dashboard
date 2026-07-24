"""Tier 1: Transcription & Diarization Agent.
Speech-to-text with segment timestamps. Sets context['transcript'] for
every downstream agent AND persists it via an informational finding
(confidence weight zero in scoring — see scoring._INFORMATIONAL).

Language/accent handling is a named risk — see Bible Part 11. Default
Whisper is the MVP starting point, NOT assumed sufficient for code-switched
Nigerian languages without dedicated evaluation. True speaker diarization
(enumerator vs respondent) needs a diarization model — V1 work; segments
here are time-aligned but unlabelled.
"""
from app.agents.base import BaseAgent, AgentFinding
from app.services import llm


class TranscriptionDiarizationAgent(BaseAgent):
    name = "transcription_diarization"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        audio_path = context.get("audio_path")
        if audio_path is None or not llm.available():
            raise NotImplementedError  # absent capability -> reduced confidence
        result = llm.transcribe(audio_path)
        if result is None or not result.get("text", "").strip():
            raise NotImplementedError
        context["transcript"] = result
        return [
            AgentFinding(
                agent_name=self.name,
                finding_type="transcript",
                description=f"Transcribed {len(result['segments'])} segments, "
                            f"{len(result['text'].split())} words.",
                confidence=0,  # informational — never moves a score
                raw_output=result,
            )
        ]
