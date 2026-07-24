"""Agent mode (Bible Part 12): optionality gates and prompt contract."""
from app.services import ai_interviewer, backcheck_agent


class TestOptionality:
    def test_disabled_by_default(self, monkeypatch):
        monkeypatch.delenv("AGENT_MODE_ENABLED", raising=False)
        assert ai_interviewer.enabled() is False

    def test_flag_alone_is_not_enough(self, monkeypatch):
        # Doubly gated (12.2): the flag AND a provider are both required.
        monkeypatch.setenv("AGENT_MODE_ENABLED", "true")
        monkeypatch.setattr(backcheck_agent, "VAPI_API_KEY", "")
        monkeypatch.setattr(backcheck_agent, "VAPI_PHONE_NUMBER_ID", "")
        assert ai_interviewer.enabled() is False

    def test_enabled_with_flag_and_provider(self, monkeypatch):
        monkeypatch.setenv("AGENT_MODE_ENABLED", "true")
        monkeypatch.setattr(backcheck_agent, "VAPI_API_KEY", "k")
        monkeypatch.setattr(backcheck_agent, "VAPI_PHONE_NUMBER_ID", "p")
        assert ai_interviewer.enabled() is True


class TestPromptContract:
    def test_prompt_contains_disclosure_consent_and_questions(self):
        prompt = ai_interviewer.build_interview_prompt(
            org_name="Intelligency",
            consent_script="May we record this interview?",
            questions=[
                {"question_key": "q1", "question_text": "How many people live here?", "is_required": True},
                {"question_key": "q2", "question_text": "Comments?", "is_required": False},
            ],
            language="yo",
        )
        assert "AI assistant" in prompt                      # 12.3 disclosure
        assert "May we record this interview?" in prompt     # verbatim consent script
        assert "END THE CALL" in prompt                      # consent refusal path
        assert "[q1]" in prompt and "(required)" in prompt
        assert "never suggest answers" in prompt
        assert "yo" in prompt                                # localized
