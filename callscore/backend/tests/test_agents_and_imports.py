"""Tests for the deterministic agents and import services."""
import io

import pytest
from openpyxl import Workbook

from app.agents.pattern_fraud import PatternFraudAgent
from app.agents.questionnaire_design import QuestionnaireDesignAgent
from app.agents.similarity_fabrication import SimilarityFabricationAgent
from app.core import config
from app.services import pii, scoring, xlsform
from app.agents.base import AgentFinding


def _xlsform_bytes(rows: list[tuple]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "survey"
    ws.append(("type", "name", "label", "required", "relevant"))
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class TestXlsform:
    def test_parses_questions_and_skip_logic(self):
        data = _xlsform_bytes([
            ("text", "q1", "How many people live here?", "yes", ""),
            ("integer", "q2", "What is your income?", "true", "${q1} > 0"),
            ("begin group", "g1", "", "", ""),
            ("note", "n1", "Section two", "", ""),
            ("text", "q3", "Comments", "", ""),
        ])
        qs = xlsform.parse_xlsform(data)
        assert [q.question_key for q in qs] == ["q1", "q2", "q3"]
        assert qs[0].is_required and qs[1].is_required and not qs[2].is_required
        assert qs[1].skip_logic == {"relevant": "${q1} > 0"}

    def test_rejects_non_xlsform(self):
        wb = Workbook()
        wb.active.title = "notasurvey"
        buf = io.BytesIO()
        wb.save(buf)
        with pytest.raises(ValueError):
            xlsform.parse_xlsform(buf.getvalue())


class TestPii:
    def test_round_trip(self, monkeypatch):
        monkeypatch.setattr(config, "CONSENT_ENCRYPTION_KEY", "test-passphrase")
        enc = pii.encrypt_pii("+2348012345678")
        assert enc != "+2348012345678" and enc.startswith("enc::")
        assert pii.decrypt_pii(enc) == "+2348012345678"

    def test_write_fails_closed_without_key(self, monkeypatch):
        monkeypatch.setattr(config, "CONSENT_ENCRYPTION_KEY", "")
        with pytest.raises(RuntimeError):
            pii.encrypt_pii("+2348012345678")

    def test_plaintext_passthrough_on_read(self):
        assert pii.decrypt_pii("legacy-plain") == "legacy-plain"


class TestTier0:
    def test_flags_leading_and_fatigue(self):
        items = [{"question_key": f"q{i}", "question_text": "How many goats?", "is_required": True}
                 for i in range(45)]
        items.append({"question_key": "lead", "question_text": "Don't you agree this program helps?",
                      "is_required": True})
        findings = QuestionnaireDesignAgent().run("PROJ-1", {"questionnaire_items": items})
        types = {f.finding_type for f in findings}
        assert "leading_question" in types and "fatigue_risk" in types

    def test_duplicate_keys_flagged(self):
        items = [{"question_key": "q1", "question_text": "A?", "is_required": True},
                 {"question_key": "q1", "question_text": "B?", "is_required": True}]
        findings = QuestionnaireDesignAgent().run("PROJ-1", {"questionnaire_items": items})
        assert any(f.finding_type == "inconsistent_skip_logic" for f in findings)


class TestTier3:
    def test_similarity_flags_near_duplicate(self):
        text = "the respondent said the household has four members and farms cassava " * 20
        ctx = {"transcript": {"text": text},
               "prior_transcripts": [{"submission_id": "OLD-1", "text": text}]}
        findings = SimilarityFabricationAgent().run("NEW-1", ctx)
        assert findings and findings[0].finding_type == "similarity"
        assert findings[0].confidence >= 90

    def test_similarity_ignores_distinct(self):
        ctx = {"transcript": {"text": "completely different conversation about market prices " * 20},
               "prior_transcripts": [{"submission_id": "OLD-1",
                                      "text": "a chat regarding school attendance and teachers " * 20}]}
        assert SimilarityFabricationAgent().run("NEW-1", ctx) == []

    def test_pattern_fraud_flags_tight_cluster(self):
        ctx = {"portfolio_durations": [900, 902, 899, 901, 900, 903]}
        findings = PatternFraudAgent().run("S", ctx)
        assert findings and findings[0].finding_type == "portfolio_anomaly"

    def test_pattern_fraud_accepts_natural_variation(self):
        ctx = {"portfolio_durations": [600, 900, 1200, 780, 1500, 660]}
        assert PatternFraudAgent().run("S", ctx) == []


class TestInformationalFindings:
    def test_transcript_finding_never_moves_scores(self):
        transcript = AgentFinding(agent_name="transcription_diarization",
                                  finding_type="transcript", description="info", confidence=0)
        r = scoring.synthesize([transcript], False, False, [])
        assert r.overall_quality_score == 100 and r.recommended_action == "none"
