"""
Tier 0: Questionnaire Design Agent (Ada). See docs/ARCHITECTURE_BIBLE.md Part 4A.2.

Runs BEFORE fieldwork begins, against the imported XLSForm. This is a
design-quality reviewer, not a fraud/scoring agent - its findings never
touch an interview's scorecard. Feeds the Research Manager during project
setup (Part 8.7). Deterministic heuristics so the same questionnaire
always gets the same review; an LLM style pass can layer on later.
"""
import re

from app.agents.base import BaseAgent, AgentFinding

_LEADING = re.compile(
    r"\b(don'?t you (think|agree)|wouldn'?t you|isn'?t it true|surely|obviously)\b", re.I)
_FATIGUE_REQUIRED = 40


class QuestionnaireDesignAgent(BaseAgent):
    name = "questionnaire_design"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        # context is NOT an interview — it's {'questionnaire_items': [...]}
        # from a just-imported XLSForm, called once at project setup.
        items = context.get("questionnaire_items")
        if not items:
            raise NotImplementedError
        findings: list[AgentFinding] = []

        def add(ftype: str, description: str, confidence: int):
            findings.append(AgentFinding(
                agent_name=self.name, finding_type=ftype,
                description=description, confidence=confidence,
            ))

        for q in items:
            text = str(q.get("question_text", ""))
            key = q.get("question_key", "?")
            # Double-barrelled: one question mark, two asks joined by and/or.
            if text.count("?") <= 1 and re.search(r"\b(and|or)\b", text, re.I) \
                    and len(re.findall(r"\b(what|how|why|when|where|do|did|are|is|have)\b", text, re.I)) >= 2:
                add("double_barrelled",
                    f"[{key}] may be double-barrelled — it asks two things at once: “{text[:120]}”", 60)
            if _LEADING.search(text):
                add("leading_question",
                    f"[{key}] is leading — it signals the expected answer: “{text[:120]}”", 80)
            if len(text.split()) > 40:
                add("ambiguous_wording",
                    f"[{key}] is {len(text.split())} words long — hard to hold in mind over a phone call.", 65)

        required = [q for q in items if q.get("is_required")]
        if len(required) > _FATIGUE_REQUIRED:
            add("fatigue_risk",
                f"{len(required)} required questions — respondent fatigue on a remote call "
                "degrades late-questionnaire data quality. Consider trimming or splitting.", 70)

        if not any("consent" in str(q.get("question_text", "")).lower()
                   or "consent" in str(q.get("question_key", "")).lower() for q in items):
            add("missing_consent_language",
                "No consent-related item found in the form. CallScore records consent "
                "separately, but forms submitted to other platforms should carry it too.", 55)

        # Duplicate keys break answer mapping outright.
        keys = [q.get("question_key") for q in items]
        for dup in {k for k in keys if keys.count(k) > 1}:
            add("inconsistent_skip_logic",
                f"Question key '{dup}' appears more than once — answers will collide.", 95)

        return findings
