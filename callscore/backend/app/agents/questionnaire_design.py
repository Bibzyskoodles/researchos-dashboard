"""
Tier 0: Questionnaire Design Agent (Ada). See docs/ARCHITECTURE_BIBLE.md Part 4A.2.

Runs BEFORE fieldwork begins, against the imported XLSForm. This is a
design-quality reviewer, not a fraud/scoring agent - its findings never
touch an interview's scorecard. Feeds the Research Manager during project
setup (Part 8.7).
"""
from app.agents.base import BaseAgent, AgentFinding


class QuestionnaireDesignAgent(BaseAgent):
    name = "questionnaire_design"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        """
        context here is NOT an interview - it's {'questionnaire_items': [...]}
        from a just-imported XLSForm. Called once at project setup, not
        per-interview. Checks for:
          - ambiguous / double-barrelled / leading question wording
          - inconsistent skip logic
          - missing or incomplete consent language
          - translation concerns
          - questionnaire fatigue risk (length, repetition)
        """
        raise NotImplementedError
