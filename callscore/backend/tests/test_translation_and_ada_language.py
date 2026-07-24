"""Translation layer + Ada language localization tests."""
from app.agents._transcript_judge import transcript_for_prompt
from app.services import ada_voice, translate


class TestAdaLanguage:
    def test_register_survives_localization(self):
        u = ada_voice.build_ada_utterance("question 7 was skipped", 70, language="yo")
        assert u["register"] == "suspects"          # derived BEFORE any LLM
        assert u["language"] == "yo"
        assert "Yoruba" in u["framing_instruction"]
        assert "non-negotiable" in u["framing_instruction"]

    def test_english_default_unchanged(self):
        u = ada_voice.build_ada_utterance("all good", 95)
        assert u["language"] == "en"
        assert "Respond entirely" not in u["framing_instruction"]


class TestTranslationLayer:
    def test_same_language_is_noop(self):
        assert translate.translate("hello", "en", "en") is None

    def test_no_providers_returns_none(self, monkeypatch):
        from app.core import config
        monkeypatch.setattr(config, "SPITCH_API_KEY", None)
        from app.services import llm
        monkeypatch.setattr(llm, "available", lambda: False)
        assert translate.translate("bawo ni", "yo") is None

    def test_segment_alignment_preserved(self, monkeypatch):
        segs = [
            {"start": 0, "end": 4, "text": "bawo ni ile?", "speaker": "S0"},
            {"start": 4, "end": 9, "text": "awon eniyan merin", "speaker": "S1"},
        ]
        monkeypatch.setattr(
            translate, "translate",
            lambda text, s, t="en": "[0] how is the household?\n[1] four people",
        )
        out = translate.translate_segments(segs, "yo")
        assert out is not None
        assert out[0]["text"] == "how is the household?" and out[0]["speaker"] == "S0"
        assert out[1]["start"] == 4  # timestamps untouched — original evidence

    def test_lost_alignment_rejected(self, monkeypatch):
        segs = [{"start": 0, "end": 4, "text": "a", "speaker": None}] * 4
        monkeypatch.setattr(translate, "translate", lambda text, s, t="en": "no markers at all")
        assert translate.translate_segments(segs, "yo") is None


class TestPromptUsesTranslation:
    def test_translated_segments_preferred_with_note(self):
        transcript = {
            "text": "bawo ni",
            "source_language": "yo",
            "segments": [{"start": 0, "end": 3, "text": "bawo ni", "speaker": "S0"}],
            "translated_segments": [{"start": 0, "end": 3, "text": "how are you", "speaker": "S0"}],
        }
        prompt = transcript_for_prompt(transcript)
        assert "how are you" in prompt and "translated to English" in prompt

    def test_untranslated_passthrough(self):
        transcript = {"text": "hello", "segments": [{"start": 0, "end": 2, "text": "hello"}]}
        prompt = transcript_for_prompt(transcript)
        assert "hello" in prompt and "translated" not in prompt
