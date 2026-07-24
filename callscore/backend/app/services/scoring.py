"""
Deterministic Tier 4 synthesis logic (Bible Part 4.4).

Pure functions over upstream AgentFinding data — no LLM calls, so the
synthesis rule "never introduce a conclusion not sourced from an upstream
agent" is enforced structurally: everything here is arithmetic over
findings that already exist.
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app.agents.base import AgentFinding
from app.core import config

# finding_type -> which score dimension it damages, and how hard per
# confidence point. Tuned conservatively for MVP; revise with real data.
_DIMENSION_WEIGHTS = {
    "missing_question": ("compliance", 0.30),
    "answer_mismatch": ("compliance", 0.25),
    "pacing": ("behaviour", 0.15),
    "interviewer_dominance": ("behaviour", 0.15),
    "rushed_segment": ("behaviour", 0.20),
    "low_engagement": ("behaviour", 0.10),
    "coaching_indicator": ("authenticity", 0.30),
    "third_party_voice": ("authenticity", 0.20),
    "scripted_exchange": ("authenticity", 0.25),
    "similarity": ("authenticity", 0.35),
    "portfolio_anomaly": ("authenticity", 0.25),
    "respondent_mismatch": ("authenticity", 0.40),
    "voice_mismatch": ("authenticity", 0.40),
    "device_state_discrepancy": ("authenticity", 0.20),
    "audio_quality": ("quality", 0.15),
    "transcription_disagreement": ("quality", 0.10),
}

_AUTHENTICITY_ESCALATORS = {"respondent_mismatch", "voice_mismatch", "similarity"}

# Informational findings (e.g. the persisted transcript) carry evidence for
# humans and downstream agents but never move a score or the confidence
# average — Design Principle 1 cuts both ways: no score without evidence,
# and no score movement from non-evidence.
_INFORMATIONAL = {"transcript"}


@dataclass
class SynthesisResult:
    overall_quality_score: int
    authenticity_score: int
    compliance_score: int
    behaviour_score: int
    fraud_risk: str                    # low | medium | high
    confidence_level: int
    recommended_action: str            # none | review_recording | conduct_backcheck | escalate
    late_start_flag: bool
    early_stop_flag: bool
    partial_analysis: bool             # true if any agent failed (Bible 4.3)


def _clamp(v: float) -> int:
    return max(0, min(100, round(v)))


def to_field_vocabulary(result: "SynthesisResult") -> dict:
    """
    Map a Call scorecard into FieldScore's shared verdict/grade vocabulary
    (see docs/RECONCILIATION.md §2) so both modes render identically on the
    shared dashboards and leaderboard.
    """
    if result.fraud_risk == "high":
        verdict = "REJECT"
    elif result.fraud_risk == "medium" or result.partial_analysis:
        verdict = "FLAG"
    else:
        verdict = "PASS"

    score = result.overall_quality_score
    grade = "A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70 else "D" if score >= 60 else "F"
    return {"verdict": verdict, "grade": grade, "overall_score": score}


def detect_timing_flags(
    started_at: Optional[datetime],
    stopped_at: Optional[datetime],
    call_started_at: Optional[datetime],
    call_ended_at: Optional[datetime],
    threshold_seconds: Optional[int] = None,
) -> tuple[bool, bool]:
    """Late-start / early-stop detection (Bible 6.5)."""
    threshold = threshold_seconds if threshold_seconds is not None else config.TIMING_DISCREPANCY_THRESHOLD_SECONDS
    late_start = bool(
        started_at and call_started_at
        and (started_at - call_started_at).total_seconds() > threshold
    )
    early_stop = bool(
        stopped_at and call_ended_at and (call_ended_at - stopped_at).total_seconds() > threshold
    )
    return late_start, early_stop


def synthesize(
    findings: list[AgentFinding],
    late_start_flag: bool,
    early_stop_flag: bool,
    failed_agents: list[str],
) -> SynthesisResult:
    scores = {"quality": 100.0, "authenticity": 100.0, "compliance": 100.0, "behaviour": 100.0}
    has_escalator = False

    findings = [f for f in findings if f.finding_type not in _INFORMATIONAL]
    for f in findings:
        dim, weight = _DIMENSION_WEIGHTS.get(f.finding_type, ("quality", 0.05))
        scores[dim] -= weight * f.confidence
        if f.finding_type in _AUTHENTICITY_ESCALATORS and f.confidence >= 60:
            has_escalator = True

    if late_start_flag or early_stop_flag:
        # Partial-trust, not zero-trust (Bible 6.5): the un-covered span
        # is unverifiable, so authenticity takes a bounded penalty.
        scores["authenticity"] -= 15

    auth = _clamp(scores["authenticity"])
    comp = _clamp(scores["compliance"])
    behav = _clamp(scores["behaviour"])
    quality = _clamp(min(scores["quality"], (auth + comp + behav) / 3))

    if has_escalator or auth < 40:
        fraud_risk = "high"
    elif auth < 70 or comp < 50:
        fraud_risk = "medium"
    else:
        fraud_risk = "low"

    # Confidence: how much evidence coverage we actually have. Failed
    # agents and no-finding pipelines both reduce it — Design Principle 1:
    # a bare number without evidence must route to human review.
    coverage_penalty = 15 * len(failed_agents)
    if findings:
        avg_conf = sum(f.confidence for f in findings) / len(findings)
    else:
        avg_conf = 75  # clean run: solid but not absolute
    confidence_level = _clamp(avg_conf - coverage_penalty)

    if fraud_risk == "high":
        action = "escalate"
    elif fraud_risk == "medium":
        action = "conduct_backcheck"
    elif late_start_flag or early_stop_flag or failed_agents or confidence_level < 60:
        action = "review_recording"
    else:
        action = "none"

    return SynthesisResult(
        overall_quality_score=quality,
        authenticity_score=auth,
        compliance_score=comp,
        behaviour_score=behav,
        fraud_risk=fraud_risk,
        confidence_level=confidence_level,
        recommended_action=action,
        late_start_flag=late_start_flag,
        early_stop_flag=early_stop_flag,
        partial_analysis=bool(failed_agents),
    )
