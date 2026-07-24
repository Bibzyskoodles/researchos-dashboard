"""
Translation layer — the bridge that lets enumerators interview in ANY
language while the analysis pipeline still reasons reliably.

Flow: a local-language transcript (Yoruba/Igbo/Hausa/Pidgin/…) is
translated to English for the Tier 2 judgment agents — their prompts and
the models behind them are strongest in English — while the ORIGINAL
transcript remains the evidence of record (Design Principle 1: findings
cite the original timestamps; the translation is an analysis aid, never
a replacement).

Providers, env-gated:
  - Spitch translation API (SPITCH_API_KEY) — Nigerian-language native
  - OpenAI (OPENAI_API_KEY) — LLM translation fallback
Neither configured -> None; the pipeline analyzes the original text and
notes reduced reliability rather than guessing.
"""
import logging
from typing import Optional

import httpx

from app.core import config

log = logging.getLogger(__name__)

_LANG_NAMES = {
    "yo": "Yoruba", "ig": "Igbo", "ha": "Hausa", "pcm": "Nigerian Pidgin",
    "am": "Amharic", "sw": "Swahili", "en": "English",
}


def _spitch_translate(text: str, source: str, target: str) -> Optional[str]:
    if not config.SPITCH_API_KEY:
        return None
    try:
        r = httpx.post(
            config.SPITCH_API_URL.replace("/transcriptions", "/translations"),
            headers={"Authorization": f"Bearer {config.SPITCH_API_KEY}"},
            json={"text": text, "source": source, "target": target},
            timeout=120,
        )
        r.raise_for_status()
        data = r.json()
        out = data.get("text") or data.get("translation") or ""
        return str(out) if str(out).strip() else None
    except Exception:
        log.exception("spitch translation failed")
        return None


def _llm_translate(text: str, source: str, target: str) -> Optional[str]:
    from app.services import llm
    if not llm.available():
        return None
    result = llm.judge(
        "You are a professional translator for research interviews. Translate "
        f"faithfully from {_LANG_NAMES.get(source, source)} to "
        f"{_LANG_NAMES.get(target, target)}. Preserve meaning exactly — never "
        "summarize, never editorialize, keep hesitations and repetitions. "
        'Respond with JSON: {"translation": string}.',
        text[:24_000],
    )
    if result is None:
        return None
    out = str(result.get("translation", ""))
    return out if out.strip() else None


def translate(text: str, source_lang: str, target_lang: str = "en") -> Optional[str]:
    """Best-available translation, or None if no provider can do it."""
    source = (source_lang or "").strip().lower()
    target = (target_lang or "en").strip().lower()
    if not text.strip() or source == target or not source:
        return None
    return _spitch_translate(text, source, target) or _llm_translate(text, source, target)


def translate_segments(segments: list[dict], source_lang: str) -> Optional[list[dict]]:
    """Segment-by-segment translation batched into one call, keeping the
    timestamp/speaker structure aligned with the original evidence."""
    if not segments:
        return None
    joined = "\n".join(f"[{i}] {s['text'].strip()}" for i, s in enumerate(segments))
    translated = translate(joined, source_lang)
    if translated is None:
        return None
    by_index: dict[int, str] = {}
    for line in translated.splitlines():
        line = line.strip()
        if line.startswith("[") and "]" in line:
            try:
                idx = int(line[1:line.index("]")])
                by_index[idx] = line[line.index("]") + 1:].strip()
            except ValueError:
                continue
    if len(by_index) < max(1, len(segments) // 2):
        return None  # alignment lost — better no translation than a wrong one
    return [
        {**s, "text": by_index.get(i, s["text"])}
        for i, s in enumerate(segments)
    ]
