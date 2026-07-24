"""Tier 1: Transcription & Diarization Agent.
Multi-provider STT with speaker labels (services/stt.py): Deepgram or
AssemblyAI diarize; Whisper is the undiarized fallback. When two providers
are configured the transcripts are cross-checked — low agreement becomes a
'transcription_disagreement' finding instead of blind trust in either
(Design Principle 1). Sets context['transcript'] for every downstream
agent AND persists it via an informational finding (weight zero in scoring).

Language/accent handling is a named risk — see Bible Part 11. None of the
providers is assumed sufficient for code-switched Nigerian languages
without dedicated evaluation; the provider layer is where a specialised
engine plugs in after that benchmark.
"""
from app.agents.base import BaseAgent, AgentFinding
from app.services import stt

_AGREEMENT_FLOOR = 0.75  # below this the two providers heard different interviews


class TranscriptionDiarizationAgent(BaseAgent):
    name = "transcription_diarization"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        if context.get("transcript"):
            return []  # already transcribed (agent-mode provider / re-run)
        audio_path = context.get("audio_path")
        if audio_path is None or not stt.configured_providers():
            raise NotImplementedError  # absent capability -> reduced confidence
        result = stt.transcribe_with_verification(audio_path, order=context.get("stt_order"))
        if result is None or not result.get("text", "").strip():
            raise NotImplementedError

        # Non-English interview: attach an English translation for the
        # analysis agents. The original stays the evidence of record; if no
        # translator is configured, agents analyze the original text.
        language = (context.get("interview_language") or "en").lower()
        if language and language != "en":
            from app.services import translate as tr
            result["source_language"] = language
            translated_segments = tr.translate_segments(result.get("segments", []), language)
            if translated_segments:
                result["translated_segments"] = translated_segments
            else:
                translated_text = tr.translate(result["text"], language)
                if translated_text:
                    result["translated_text"] = translated_text

        context["transcript"] = result

        speakers = {s.get("speaker") for s in result["segments"] if s.get("speaker")}
        findings = [AgentFinding(
            agent_name=self.name,
            finding_type="transcript",
            description=(
                f"Transcribed via {result['provider']}: {len(result['segments'])} segments, "
                f"{len(result['text'].split())} words, "
                f"{len(speakers) or 'no'} labelled speaker(s)."
            ),
            confidence=0,  # informational — never moves a score
            raw_output=result,
        )]

        agreement = result.get("agreement")
        if agreement and agreement["ratio"] < _AGREEMENT_FLOOR:
            findings.append(AgentFinding(
                agent_name=self.name,
                finding_type="transcription_disagreement",
                description=(
                    f"Independent transcription engines disagree "
                    f"({result['provider']} vs {agreement['provider']}, "
                    f"{agreement['ratio']:.0%} agreement) — the audio may be "
                    "unclear or code-switched beyond current engine coverage; "
                    "downstream findings need a human ear."
                ),
                confidence=int((1 - agreement["ratio"]) * 100),
                raw_output=agreement,
            ))
        return findings
