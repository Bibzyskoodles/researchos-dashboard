"""Tier 1: Consent Verification Agent.

A consent recording EXISTING is not consent (founder-found gap: a silent
consent file sailed through). This agent transcribes the consent
recording and checks two things, cheapest first:

1. Was anything actually said? A near-silent or empty consent transcript
   is a high-confidence 'consent_not_verified' finding — deterministic,
   no LLM involved.
2. If a project consent script is configured and the LLM is available,
   does the recording contain the consent being requested AND agreed to?
   A refusal or an unrelated recording becomes 'consent_mismatch'.

Consent remains a hard gate at upload (Bible Part 7) — this agent is the
second lock: the gate checks the artifact exists, this checks it is real.
"""
from app.agents.base import BaseAgent, AgentFinding
from app.services import llm, stt


class ConsentVerificationAgent(BaseAgent):
    name = "consent_verification"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        consent_path = context.get("consent_audio_path")
        if consent_path is None or not stt.configured_providers():
            raise NotImplementedError  # absent capability -> reduced confidence

        result = stt.transcribe_with_verification(
            consent_path, order=context.get("stt_order")
        )
        text = (result or {}).get("text", "").strip()
        word_count = len(text.split()) if text else 0

        if word_count < 5:
            return [AgentFinding(
                agent_name=self.name,
                finding_type="consent_not_verified",
                description=(
                    "The consent recording contains no audible spoken consent "
                    f"({word_count} word(s) transcribed). A recording exists, "
                    "but consent being asked and given is not on it."
                ),
                confidence=90,
                raw_output={"transcript": text, "word_count": word_count},
            )]

        script = (context.get("consent_script") or "").strip()
        if not script or not llm.available():
            # Words were spoken but there is nothing to compare against —
            # record what was heard, informationally, and stop there.
            return [AgentFinding(
                agent_name=self.name,
                finding_type="consent_transcript",
                description=f"Consent recording transcribed ({word_count} words).",
                confidence=0,
                raw_output={"transcript": text[:2000]},
            )]

        verdict = llm.judge(
            "You verify that a consent recording from a research interview "
            "is genuine. Compare the transcript against the project's "
            "consent script. The wording need not match verbatim — what "
            "matters is that recording/consent was clearly requested AND "
            "the respondent clearly agreed. Respond with JSON: "
            '{"consent_given": boolean, "reason": string (quote the '
            "transcript), \"confidence\": number 0-100}.",
            f"CONSENT SCRIPT:\n{script[:2000]}\n\nRECORDING TRANSCRIPT:\n{text[:4000]}",
        )
        if verdict is None:
            raise NotImplementedError
        if not verdict.get("consent_given", False):
            try:
                confidence = max(0, min(100, int(verdict.get("confidence", 70))))
            except (TypeError, ValueError):
                confidence = 70
            return [AgentFinding(
                agent_name=self.name,
                finding_type="consent_mismatch",
                description=(
                    "The consent recording does not show consent being asked "
                    f"and given: {str(verdict.get('reason', ''))[:300]}"
                ),
                confidence=confidence,
                raw_output={"transcript": text[:2000], "reason": verdict.get("reason")},
            )]
        return [AgentFinding(
            agent_name=self.name,
            finding_type="consent_transcript",
            description=f"Consent verified on the recording ({word_count} words).",
            confidence=0,
            raw_output={"transcript": text[:2000]},
        )]
