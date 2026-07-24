"""
Agent mode — the AI interviewer (Bible Part 12, Revision 2).

DOUBLY OPTIONAL by design (12.2): requires AGENT_MODE_ENABLED=true AND a
configured voice-agent provider. Off = the platform behaves exactly as
Parts 1-11 describe.

Consent strengthened for AI (12.3): first sentence discloses the AI,
then the project's consent script is read and explicit verbal consent
requested. Declined consent ends the call politely and NOTHING is
retained or analyzed — enforced in the webhook state machine
(routes/agent_interviews.py), not here in prose.
"""
import logging
import os
from typing import Optional

from app.services import backcheck_agent  # shares the Vapi credentials/transport

log = logging.getLogger(__name__)


def enabled() -> bool:
    return (
        os.getenv("AGENT_MODE_ENABLED", "").lower() in ("1", "true", "yes")
        and backcheck_agent.available()
    )


def build_interview_prompt(
    org_name: str,
    consent_script: str,
    questions: list[dict],
    language: str = "en",
) -> str:
    qlist = "\n".join(
        f"{i + 1}. [{q['question_key']}]{' (required)' if q.get('is_required') else ''} "
        f"{q['question_text']}"
        for i, q in enumerate(questions)
    )
    return (
        f"You are an AI research interviewer calling on behalf of {org_name or 'the research team'}. "
        "Rules, in strict order:\n"
        "1. FIRST SENTENCE: state clearly that you are an AI assistant calling "
        "on behalf of the organisation, and why.\n"
        "2. Read this consent statement essentially verbatim, then ask for an "
        f"explicit yes/no: \"{consent_script.strip()}\"\n"
        "3. If consent is not clearly given, thank them warmly and END THE CALL. "
        "Never persuade, never re-ask more than once.\n"
        "4. If consent is given, conduct the interview: ask each question below "
        "one at a time, conversationally, in order. Clarify when asked, but "
        "never suggest answers, never react with approval/disapproval to any "
        "answer, and never skip a required question.\n"
        f"QUESTIONS:\n{qlist}\n"
        "5. If the respondent wants to stop at any point, stop immediately and "
        "thank them.\n"
        f"6. Conduct the call in {language} if the respondent prefers it.\n"
        "7. Close by thanking them and saying how the data will be used.\n"
        "At the end, produce a structured summary: consent_given (yes/no), "
        "answers as a JSON object keyed by the question keys above, and any "
        "notes about interruptions or third parties."
    )


def dispatch_interview(
    phone_number: str,
    prompt: str,
    submission_id: str,
    first_message: str,
) -> Optional[str]:
    """Reuses the provider transport from backcheck_agent; separate entry
    point so Agent-mode calls are auditable as their own kind."""
    if not enabled():
        return None
    return backcheck_agent.dispatch_call(
        phone_number, prompt, submission_id, first_message=first_message,
        kind="agent_interview", webhook_path="/api/v1/agent-interviews/webhook",
        max_duration_seconds=1800,  # a real interview, not a 3-minute check
    )
