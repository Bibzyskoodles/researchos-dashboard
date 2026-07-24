"""
Shared machinery for Tier 2 transcript-judgment agents. Each agent supplies
a system prompt describing exactly which finding types it may emit; the LLM
must return {"findings": [{type, description, start_s, end_s, confidence}]}
and anything malformed is dropped rather than guessed at (Design
Principle 1: a finding without concrete grounding never becomes a score).
"""
from app.agents.base import AgentFinding
from app.services import llm

_RESPONSE_CONTRACT = (
    ' Respond with JSON: {"findings": [{"type": string, "description": string, '
    '"start_s": number|null, "end_s": number|null, "confidence": number 0-100}]}. '
    "Every finding MUST cite concrete evidence from the transcript in its "
    "description (quote or paraphrase the specific exchange). If nothing is "
    "wrong, return {\"findings\": []}. Never invent findings to seem thorough."
)


def transcript_for_prompt(transcript: dict, max_chars: int = 24_000) -> str:
    """Prefers the English-translated segments when the interview was
    conducted in another language (translated_segments, aligned 1:1 with
    the originals so timestamps still cite the real evidence); falls back
    to the original-language text."""
    segments = transcript.get("translated_segments") or transcript.get("segments", [])
    lines = []
    for s in segments:
        speaker = f" {s['speaker']}:" if s.get("speaker") else ""
        lines.append(f"[{int(s['start'])}s-{int(s['end'])}s]{speaker} {s['text'].strip()}")
    text = "\n".join(lines) or transcript.get("translated_text") or transcript.get("text", "")
    header = ""
    if transcript.get("translated_segments") or transcript.get("translated_text"):
        header = ("NOTE: transcript translated to English from "
                  f"{transcript.get('source_language', 'the interview language')} "
                  "for analysis; timestamps refer to the original audio.\n")
    return (header + text)[:max_chars]


def run_judgment(
    agent_name: str,
    allowed_types: set[str],
    system_prompt: str,
    user_content: str,
) -> list[AgentFinding]:
    if not llm.available():
        raise NotImplementedError
    result = llm.judge(system_prompt + _RESPONSE_CONTRACT, user_content)
    if result is None:
        raise NotImplementedError
    findings: list[AgentFinding] = []
    for f in result.get("findings", []):
        ftype = str(f.get("type", ""))
        desc = str(f.get("description", "")).strip()
        if ftype not in allowed_types or not desc:
            continue  # out-of-contract output is dropped, never coerced
        try:
            confidence = max(0, min(100, int(f.get("confidence", 0))))
        except (TypeError, ValueError):
            continue
        def _sec(v):
            try:
                return int(v) if v is not None else None
            except (TypeError, ValueError):
                return None
        findings.append(AgentFinding(
            agent_name=agent_name, finding_type=ftype, description=desc,
            confidence=confidence,
            timestamp_range_start=_sec(f.get("start_s")),
            timestamp_range_end=_sec(f.get("end_s")),
            raw_output=f,
        ))
    return findings
