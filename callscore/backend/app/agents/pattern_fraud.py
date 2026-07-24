"""Tier 3: Pattern Fraud Agent.
Timing anomalies across an enumerator's FULL interview portfolio, not just
this one interview. MVP: duration-clustering — genuinely independent
interviews vary in length; a portfolio of near-identical durations is a
fabrication signal. Benford's-law numeric checks arrive with richer
numeric answer data. Deterministic — per Design Principle 8, thresholds
here are deliberately not surfaced to enumerators.
"""
import statistics

from app.agents.base import BaseAgent, AgentFinding

_MIN_PORTFOLIO = 5
_CV_THRESHOLD = 0.08  # coefficient of variation below this is suspicious


class PatternFraudAgent(BaseAgent):
    name = "pattern_fraud"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        durations = context.get("portfolio_durations") or []  # seconds, incl. this one
        if len(durations) < _MIN_PORTFOLIO:
            return []  # not enough history to say anything honest
        mean = statistics.fmean(durations)
        if mean <= 0:
            return []
        cv = statistics.pstdev(durations) / mean
        if cv >= _CV_THRESHOLD:
            return []
        return [AgentFinding(
            agent_name=self.name, finding_type="portfolio_anomaly",
            description=(
                f"This enumerator's last {len(durations)} call interviews are "
                f"nearly identical in length (±{cv:.0%} around {mean/60:.0f} min). "
                "Independent interviews don't cluster this tightly."
            ),
            confidence=70,
            raw_output={"n": len(durations), "mean_seconds": round(mean),
                        "coefficient_of_variation": round(cv, 4)},
        )]
