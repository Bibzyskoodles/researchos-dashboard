"""
LLM access for the analysis agents. Env-gated: without OPENAI_API_KEY,
helpers return None and agents raise NotImplementedError — the orchestrator
then counts them as absent capability, lowers confidence, and routes the
interview to human review (Bible 4.3). No key never means silent guesses
(Design Principle 1).

Ada's own natural-language rendering does NOT go through here — her
register is enforced deterministically in ada_voice.py (Bible 4A.3). These
calls produce structured findings only.
"""
import json
import logging
import pathlib
from typing import Optional

from app.core import config

log = logging.getLogger(__name__)

TRANSCRIPTION_MODEL = "whisper-1"
JUDGMENT_MODEL = "gpt-4o-mini"


def available() -> bool:
    return bool(config.OPENAI_API_KEY)


def _client():
    from openai import OpenAI
    return OpenAI(api_key=config.OPENAI_API_KEY)


def transcribe(audio_path: pathlib.Path) -> Optional[dict]:
    """Speech-to-text with segment timestamps. Returns
    {"text": str, "segments": [{"start": s, "end": s, "text": str}]} or None.

    Known risk, tracked honestly (Bible Part 11): default Whisper is a
    starting point, NOT validated for Nigerian Pidgin / code-switched
    Yoruba/Igbo/Hausa-English. Dedicated evaluation before production use.
    """
    if not available():
        return None
    try:
        with open(audio_path, "rb") as f:
            result = _client().audio.transcriptions.create(
                model=TRANSCRIPTION_MODEL, file=f, response_format="verbose_json",
            )
        segments = [
            {"start": s.start, "end": s.end, "text": s.text}
            for s in (result.segments or [])
        ]
        return {"text": result.text, "segments": segments}
    except Exception:
        log.exception("transcription failed for %s", audio_path)
        return None


def judge(system_prompt: str, user_content: str) -> Optional[dict]:
    """One structured-JSON judgment call. Returns the parsed object or None
    on any failure — callers treat None as 'this agent could not run'."""
    if not available():
        return None
    try:
        resp = _client().chat.completions.create(
            model=JUDGMENT_MODEL,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            temperature=0,
        )
        return json.loads(resp.choices[0].message.content or "{}")
    except Exception:
        log.exception("LLM judgment call failed")
        return None
