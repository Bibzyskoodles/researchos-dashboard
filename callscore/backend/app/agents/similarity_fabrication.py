"""Tier 3: Similarity & Fabrication Agent.
Flags near-duplicate transcripts across supposedly independent interviews.
Deterministic sequence-similarity over context['prior_transcripts'] (this
enumerator's history, loaded by the orchestrator) — no LLM, so identical
input always produces the identical flag.
"""
import difflib

from app.agents.base import BaseAgent, AgentFinding
from app.core import config


class SimilarityFabricationAgent(BaseAgent):
    name = "similarity_fabrication"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        transcript = context.get("transcript")
        priors = context.get("prior_transcripts") or []  # [{submission_id, text}]
        if not transcript:
            raise NotImplementedError
        if not priors:
            return []  # first interview for this enumerator — nothing to compare

        current = " ".join(transcript.get("text", "").lower().split())
        findings: list[AgentFinding] = []
        for prior in priors:
            prior_text = " ".join(str(prior.get("text", "")).lower().split())
            if len(prior_text) < 200 or len(current) < 200:
                continue
            ratio = difflib.SequenceMatcher(None, current, prior_text).quick_ratio()
            if ratio < config.SIMILARITY_THRESHOLD:
                continue
            # quick_ratio over-estimates; confirm with the real ratio.
            ratio = difflib.SequenceMatcher(None, current, prior_text).ratio()
            if ratio >= config.SIMILARITY_THRESHOLD:
                findings.append(AgentFinding(
                    agent_name=self.name, finding_type="similarity",
                    description=(
                        f"Transcript is {ratio:.0%} similar to prior interview "
                        f"{prior.get('submission_id')} by the same enumerator — "
                        "independent interviews should not repeat like this."
                    ),
                    confidence=min(95, int(ratio * 100)),
                    raw_output={"prior_submission_id": prior.get("submission_id"),
                                "similarity_ratio": round(ratio, 3)},
                ))
        return findings
