"""Tests for the multi-provider STT layer and diarization-driven behaviour."""
import pytest

from app.agents.behaviour_analysis import BehaviourAnalysisAgent
from app.agents.transcription_diarization import TranscriptionDiarizationAgent
from app.services import stt


class TestSttLayer:
    def test_no_providers_configured(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config, "DEEPGRAM_API_KEY", None)
        monkeypatch.setattr(config, "ASSEMBLYAI_API_KEY", None)
        monkeypatch.setattr(config, "OPENAI_API_KEY", None)
        assert stt.configured_providers() == []

    def test_agreement_attached_with_two_providers(self, monkeypatch, tmp_path):
        audio = tmp_path / "a.m4a"
        audio.write_bytes(b"x" * 100)
        r1 = {"text": "hello there respondent", "segments": [], "provider": "p1", "agreement": None}
        r2 = {"text": "hello their respondent", "segments": [], "provider": "p2", "agreement": None}
        monkeypatch.setattr(stt, "_PROVIDERS", [("p1", lambda p: dict(r1)), ("p2", lambda p: dict(r2))])
        out = stt.transcribe_with_verification(audio)
        assert out is not None and out["provider"] == "p1"
        assert out["agreement"]["provider"] == "p2"
        assert 0 < out["agreement"]["ratio"] <= 1

    def test_single_provider_no_agreement(self, monkeypatch, tmp_path):
        audio = tmp_path / "a.m4a"
        audio.write_bytes(b"x")
        r1 = {"text": "hello", "segments": [], "provider": "p1", "agreement": None}
        monkeypatch.setattr(stt, "_PROVIDERS", [("p1", lambda p: dict(r1)), ("p2", lambda p: None)])
        out = stt.transcribe_with_verification(audio)
        assert out is not None and out["agreement"] is None


class TestTranscriptionAgent:
    def test_disagreement_becomes_finding(self, monkeypatch, tmp_path):
        audio = tmp_path / "a.m4a"
        audio.write_bytes(b"x")
        result = {
            "text": "completely different words here",
            "segments": [{"start": 0, "end": 5, "text": "hi", "speaker": "S0"}],
            "provider": "deepgram",
            "agreement": {"provider": "assemblyai", "ratio": 0.4},
        }
        monkeypatch.setattr(stt, "configured_providers", lambda: ["deepgram", "assemblyai"])
        monkeypatch.setattr(stt, "transcribe_with_verification", lambda p: result)
        ctx: dict = {"audio_path": audio}
        findings = TranscriptionDiarizationAgent().run("S1", ctx)
        types = [f.finding_type for f in findings]
        assert "transcript" in types and "transcription_disagreement" in types
        assert ctx["transcript"] is result

    def test_no_providers_raises(self, monkeypatch, tmp_path):
        audio = tmp_path / "a.m4a"
        audio.write_bytes(b"x")
        monkeypatch.setattr(stt, "configured_providers", lambda: [])
        with pytest.raises(NotImplementedError):
            TranscriptionDiarizationAgent().run("S1", {"audio_path": audio})


class TestDominance:
    def test_dominant_speaker_flagged_without_llm(self, monkeypatch):
        from app.services import llm
        monkeypatch.setattr(llm, "available", lambda: False)
        transcript = {
            "text": "…",
            "segments": (
                [{"start": i * 10, "end": i * 10 + 9, "text": "talk", "speaker": "S0"} for i in range(9)]
                + [{"start": 90, "end": 95, "text": "ok", "speaker": "S1"}]
            ),
        }
        findings = BehaviourAnalysisAgent().run("S1", {"transcript": transcript})
        assert findings and findings[0].finding_type == "interviewer_dominance"

    def test_balanced_speakers_no_flag(self, monkeypatch):
        from app.services import llm
        monkeypatch.setattr(llm, "available", lambda: False)
        transcript = {
            "text": "…",
            "segments": [
                {"start": 0, "end": 50, "text": "q", "speaker": "S0"},
                {"start": 50, "end": 100, "text": "a", "speaker": "S1"},
            ],
        }
        with pytest.raises(NotImplementedError):
            # balanced + no LLM -> agent has nothing it can honestly say
            BehaviourAnalysisAgent().run("S1", {"transcript": transcript})
