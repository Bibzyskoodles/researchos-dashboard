"""Tier 2: Behaviour Analysis Agent.
Pacing, interviewer dominance, rushed segments. When the transcript
carries speaker labels (Deepgram/AssemblyAI diarization), dominance is
computed DETERMINISTICALLY from speaking-time ratio — same input, same
flag, no model in the loop. The LLM pass handles the judgment-laden
signals (rushing, pacing) on top.
"""
from collections import defaultdict

from app.agents.base import BaseAgent, AgentFinding
from app.agents._transcript_judge import run_judgment, transcript_for_prompt

_DOMINANCE_RATIO = 0.75  # one voice holding >75% of speaking time in a survey call

_SYSTEM = (
    "You analyse interviewer behaviour in a phone survey transcript. "
    "Founder-calibrated rules from real false positives: brief "
    "acknowledgements after an answer — 'Okay.', 'Alright.', 'Thank "
    "you.' — are NORMAL backchannel, never interruption or dominance. "
    "Moving to the next question after a complete answer is correct "
    "interviewing, not rushing. Only flag 'rushed_segment' when the "
    "timestamps PROVE questions overlapped or cut off an in-progress "
    "answer, 'interviewer_dominance' when the interviewer audibly talks "
    "over or answers FOR the respondent, and 'pacing' for timestamp-"
    "proven abnormal gaps. Quote concrete evidence; when in doubt, "
    "emit nothing."
)


class BehaviourAnalysisAgent(BaseAgent):
    name = "behaviour_analysis"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        transcript = context.get("transcript")
        if not transcript:
            raise NotImplementedError
        findings = self._dominance_from_diarization(transcript)
        try:
            findings.extend(run_judgment(
                self.name, {"rushed_segment", "pacing", "interviewer_dominance"},
                _SYSTEM, f"TRANSCRIPT:\n{transcript_for_prompt(transcript)}",
            ))
        except NotImplementedError:
            # No LLM configured — the deterministic dominance signal alone
            # is still honest evidence; don't discard it.
            if not findings:
                raise
        return findings

    def _dominance_from_diarization(self, transcript: dict) -> list[AgentFinding]:
        talk: dict[str, float] = defaultdict(float)
        for s in transcript.get("segments", []):
            if s.get("speaker") and s.get("end", 0) > s.get("start", 0):
                talk[s["speaker"]] += s["end"] - s["start"]
        if len(talk) < 2:
            return []  # undiarized or single voice — nothing measurable
        total = sum(talk.values())
        speaker, seconds = max(talk.items(), key=lambda kv: kv[1])
        ratio = seconds / total
        if ratio <= _DOMINANCE_RATIO:
            return []
        return [AgentFinding(
            agent_name=self.name, finding_type="interviewer_dominance",
            description=(
                f"Speaker {speaker} holds {ratio:.0%} of all speaking time — in a "
                "survey interview the respondent should carry most of the answers."
            ),
            confidence=min(90, int(ratio * 100)),
            raw_output={"speaking_time": {k: round(v, 1) for k, v in talk.items()},
                        "dominant_ratio": round(ratio, 3)},
        )]
