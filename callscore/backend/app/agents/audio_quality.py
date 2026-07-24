"""Tier 1: Audio Quality Agent.
Flags unusable audio BEFORE downstream agents waste effort on bad input.
MVP heuristics over the stored file + transcript coverage; signal-level
analysis (noise floor, cross-talk) is V1 — room-audio quality is a named
unsolved risk (Bible Part 11), not assumed solved here.
"""
from app.agents.base import BaseAgent, AgentFinding

_MIN_BYTES = 20_000          # anything smaller isn't a real interview recording
_MIN_WORDS_PER_MINUTE = 20   # far below any real conversation -> mostly silence/noise


class AudioQualityAgent(BaseAgent):
    name = "audio_quality"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        audio_path = context.get("audio_path")
        if audio_path is None:
            raise NotImplementedError
        findings: list[AgentFinding] = []

        size = audio_path.stat().st_size
        if size < _MIN_BYTES:
            findings.append(AgentFinding(
                agent_name=self.name, finding_type="audio_quality",
                description=f"Recording is only {size} bytes — too short/empty to analyze.",
                confidence=95, raw_output={"bytes": size},
            ))
            return findings

        transcript = context.get("transcript")
        if transcript and transcript.get("segments"):
            duration = max((s["end"] for s in transcript["segments"]), default=0)
            words = len(transcript.get("text", "").split())
            if duration >= 60:
                wpm = words / (duration / 60)
                if wpm < _MIN_WORDS_PER_MINUTE:
                    findings.append(AgentFinding(
                        agent_name=self.name, finding_type="audio_quality",
                        description=(
                            f"Only {wpm:.0f} intelligible words/minute over "
                            f"{duration/60:.0f} minutes — audio is largely silent or unusable."
                        ),
                        confidence=70,
                        timestamp_range_start=0, timestamp_range_end=int(duration),
                        raw_output={"words_per_minute": round(wpm, 1), "duration_s": duration},
                    ))
        return findings
