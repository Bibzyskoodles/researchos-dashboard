"""
AI back-check calls via a Vapi-style voice-agent provider.

SCOPE GUARD (do not widen without an explicit Bible revision): the agent
conducts BACK-CHECK verification calls only — a few minutes confirming
that a human interview actually happened as recorded. It never conducts
primary interviews (Bible 8.4: the conversation itself stays human), it
DISCLOSES that it is automated in its first sentence, and it accepts "no"
— a respondent declining ends the call politely and that is itself a
recorded outcome.

Env-gated: VAPI_API_KEY + VAPI_PHONE_NUMBER_ID. Endpoint configurable
(VAPI_API_URL) — verify the request shape against docs.vapi.ai when the
account is provisioned; the fields used here (assistant inline config,
phoneNumberId, customer.number, metadata, server webhook) are Vapi's
documented core call-creation shape.
"""
import logging
import os
from typing import Optional

import httpx

log = logging.getLogger(__name__)

VAPI_API_KEY = os.getenv("VAPI_API_KEY", "")
VAPI_API_URL = os.getenv("VAPI_API_URL", "https://api.vapi.ai/call")
VAPI_PHONE_NUMBER_ID = os.getenv("VAPI_PHONE_NUMBER_ID", "")
VAPI_WEBHOOK_SECRET = os.getenv("VAPI_WEBHOOK_SECRET", "")
PUBLIC_BASE_URL = os.getenv("PUBLIC_BASE_URL", "")  # this service's public URL


def available() -> bool:
    return bool(VAPI_API_KEY and VAPI_PHONE_NUMBER_ID)


def build_backcheck_prompt(
    respondent_name: str,
    interview_date: str,
    topic_hints: list[str],
    language: str = "en",
) -> str:
    topics = ", ".join(topic_hints[:3]) if topic_hints else "the survey topics"
    return (
        "You are a quality-verification assistant for a research organisation. "
        "You are NOT conducting an interview — you are verifying that one "
        "already happened. Rules, in order:\n"
        "1. FIRST SENTENCE: disclose that you are an automated quality-check "
        "call from the research team, and ask if they have two minutes. If "
        "they decline or seem confused, thank them warmly and end the call.\n"
        "2. Ask, conversationally, one at a time: (a) did someone from the "
        f"research team interview them around {interview_date}? (b) roughly "
        "how long did that conversation last? (c) did it cover topics like "
        f"{topics}? (d) how was the experience — were they rushed, was anyone "
        "else answering for them?\n"
        "3. Never re-ask survey questions, never collect new data, never "
        "discuss the interviewer's performance evaluation.\n"
        "4. Keep the whole call under three minutes. Close by thanking "
        f"{respondent_name or 'them'} for helping keep the research honest.\n"
        f"5. Conduct the call in {language} if the respondent uses it.\n"
        "At the end, summarize: interview_confirmed (yes/no/unclear), "
        "reported_duration, topics_matched (yes/no/unclear), concerns."
    )


def dispatch_call(
    phone_number: str,
    prompt: str,
    submission_id: str,
    first_message: str = (
        "Hello! This is an automated quality-check call from the research team "
        "— not a sales call. Do you have two minutes to confirm a recent "
        "interview? You can say no and I'll hang up right away."
    ),
    kind: str = "backcheck",
    webhook_path: str = "/api/v1/backchecks/webhook",
    max_duration_seconds: int = 240,
) -> Optional[str]:
    """Create the outbound call; returns the provider call id or None.
    Shared transport for back-checks and Agent-mode interviews — the kind
    and webhook route keep the two auditable as distinct call types."""
    if not available():
        return None
    body = {
        "phoneNumberId": VAPI_PHONE_NUMBER_ID,
        "customer": {"number": phone_number},
        "assistant": {
            "firstMessage": first_message,
            "model": {
                "provider": "openai",
                "model": "gpt-4o-mini",
                "messages": [{"role": "system", "content": prompt}],
            },
            "endCallFunctionEnabled": True,
            "maxDurationSeconds": max_duration_seconds,
        },
        "metadata": {"submission_id": submission_id, "kind": kind},
    }
    if PUBLIC_BASE_URL:
        body["assistant"]["server"] = {
            "url": f"{PUBLIC_BASE_URL}{webhook_path}",
            **({"secret": VAPI_WEBHOOK_SECRET} if VAPI_WEBHOOK_SECRET else {}),
        }
    try:
        r = httpx.post(
            VAPI_API_URL,
            headers={"Authorization": f"Bearer {VAPI_API_KEY}"},
            json=body,
            timeout=60,
        )
        r.raise_for_status()
        return str(r.json().get("id", "")) or None
    except Exception:
        log.exception("backcheck dispatch failed for %s", submission_id)
        return None
