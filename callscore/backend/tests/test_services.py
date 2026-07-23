"""Unit tests for the deterministic service layer (no DB required)."""
from datetime import datetime, timedelta, timezone

import pytest

from app.agents.base import AgentFinding
from app.services import ada_voice, scoring


def _finding(ftype: str, confidence: int) -> AgentFinding:
    return AgentFinding(
        agent_name="test", finding_type=ftype, description=f"{ftype} detected",
        confidence=confidence,
    )


class TestAdaVoice:
    def test_register_boundaries(self):
        assert ada_voice.register_for(90) is ada_voice.Register.KNOW
        assert ada_voice.register_for(89) is ada_voice.Register.SUSPECT
        assert ada_voice.register_for(60) is ada_voice.Register.SUSPECT
        assert ada_voice.register_for(59) is ada_voice.Register.RECOMMEND_CHECKING

    def test_out_of_range_rejected(self):
        with pytest.raises(ValueError):
            ada_voice.register_for(101)

    def test_render_finding_uses_register_opener(self):
        s = ada_voice.render_finding("Question 7 was not asked", 95)
        assert s.text.startswith("I know")
        s = ada_voice.render_finding("Question 7 was not asked", 70)
        assert s.text.startswith("I suspect")
        s = ada_voice.render_finding("Question 7 was not asked", 30)
        assert s.text.startswith("I recommend checking")

    def test_no_finding_never_asserts(self):
        s = ada_voice.render_scorecard_summary("high", 95, "escalate", None)
        assert s.register is ada_voice.Register.RECOMMEND_CHECKING


class TestTimingFlags:
    def test_late_start(self):
        t0 = datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc)
        late, early = scoring.detect_timing_flags(
            started_at=t0 + timedelta(minutes=5), stopped_at=t0 + timedelta(minutes=20),
            call_started_at=t0, call_ended_at=t0 + timedelta(minutes=20),
            threshold_seconds=90,
        )
        assert late and not early

    def test_early_stop(self):
        t0 = datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc)
        late, early = scoring.detect_timing_flags(
            started_at=t0, stopped_at=t0 + timedelta(minutes=10),
            call_started_at=t0, call_ended_at=t0 + timedelta(minutes=15),
            threshold_seconds=90,
        )
        assert early and not late

    def test_no_ble_data_no_flags(self):
        t0 = datetime(2026, 7, 1, 10, 0, tzinfo=timezone.utc)
        assert scoring.detect_timing_flags(t0, t0, None, None) == (False, False)


class TestSynthesis:
    def test_clean_interview(self):
        r = scoring.synthesize([], False, False, [])
        assert r.fraud_risk == "low"
        assert r.recommended_action == "none"
        assert r.overall_quality_score == 100

    def test_escalator_forces_high_risk(self):
        r = scoring.synthesize([_finding("voice_mismatch", 80)], False, False, [])
        assert r.fraud_risk == "high"
        assert r.recommended_action == "escalate"

    def test_failed_agents_route_to_review(self):
        r = scoring.synthesize([], False, False, ["transcription_diarization"])
        assert r.partial_analysis
        assert r.recommended_action == "review_recording"

    def test_timing_flag_routes_to_review(self):
        r = scoring.synthesize([], True, False, [])
        assert r.late_start_flag
        assert r.recommended_action != "none"

    def test_missing_questions_hit_compliance(self):
        r = scoring.synthesize([_finding("missing_question", 90)] * 3, False, False, [])
        assert r.compliance_score < 50
        assert r.fraud_risk in ("medium", "high")
