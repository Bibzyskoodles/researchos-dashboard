"""
Multi-provider speech-to-text with speaker diarization.

Providers (each env-gated; configure any subset):
  - Deepgram   (DEEPGRAM_API_KEY)    — primary: diarized, telephony-tuned
  - AssemblyAI (ASSEMBLYAI_API_KEY)  — secondary: diarized, field-proven
  - OpenAI     (OPENAI_API_KEY)      — fallback: whisper-1, NO diarization

Cross-validation ("use two or more, so we are sure"): when at least two
providers are configured, the audio is transcribed by the top two and their
texts compared. Low agreement is itself evidence — it becomes a
'transcription_disagreement' finding that lowers confidence and routes the
interview to human review rather than trusting either transcript blindly
(Design Principle 1).

Unified result shape:
  {"text": str,
   "segments": [{"start": s, "end": s, "text": str, "speaker": "S0"|None}],
   "provider": str,
   "agreement": {"provider": str, "ratio": float} | None}

Known risk (Bible Part 11): none of these are validated for Nigerian
Pidgin / code-switched Yoruba/Igbo/Hausa-English. The provider abstraction
here is exactly where a specialised engine (Spitch, Intron, fine-tuned
Whisper) plugs in after the evaluation benchmark runs.
"""
import difflib
import logging
import pathlib
import time
from typing import Optional

import httpx

from app.core import config

log = logging.getLogger(__name__)

_TIMEOUT = 300.0


def _normalize(text: str) -> str:
    return " ".join(text.lower().split())


# ── Providers ───────────────────────────────────────────────────────────────

def _deepgram(audio_path: pathlib.Path) -> Optional[dict]:
    if not config.DEEPGRAM_API_KEY:
        return None
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(
                "https://api.deepgram.com/v1/listen",
                params={"diarize": "true", "punctuate": "true",
                        "utterances": "true", "model": "nova-2"},
                headers={"Authorization": f"Token {config.DEEPGRAM_API_KEY}",
                         "Content-Type": "audio/*"},
                content=audio_path.read_bytes(),
            )
            r.raise_for_status()
            data = r.json()
        utterances = data.get("results", {}).get("utterances", [])
        segments = [
            {"start": u["start"], "end": u["end"], "text": u["transcript"],
             "speaker": f"S{u.get('speaker', 0)}"}
            for u in utterances
        ]
        text = " ".join(s["text"] for s in segments) or (
            data.get("results", {}).get("channels", [{}])[0]
            .get("alternatives", [{}])[0].get("transcript", "")
        )
        if not text.strip():
            return None
        return {"text": text, "segments": segments, "provider": "deepgram", "agreement": None}
    except Exception:
        log.exception("deepgram transcription failed")
        return None


def _assemblyai(audio_path: pathlib.Path) -> Optional[dict]:
    if not config.ASSEMBLYAI_API_KEY:
        return None
    headers = {"authorization": config.ASSEMBLYAI_API_KEY}
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            up = client.post("https://api.assemblyai.com/v2/upload",
                             headers=headers, content=audio_path.read_bytes())
            up.raise_for_status()
            job = client.post(
                "https://api.assemblyai.com/v2/transcript",
                headers=headers,
                json={"audio_url": up.json()["upload_url"], "speaker_labels": True},
            )
            job.raise_for_status()
            tid = job.json()["id"]
            for _ in range(120):  # poll up to ~10 min
                res = client.get(f"https://api.assemblyai.com/v2/transcript/{tid}",
                                 headers=headers).json()
                if res.get("status") == "completed":
                    segments = [
                        {"start": u["start"] / 1000, "end": u["end"] / 1000,
                         "text": u["text"], "speaker": f"S{u.get('speaker', 'A')}"}
                        for u in (res.get("utterances") or [])
                    ]
                    text = res.get("text", "")
                    if not text.strip():
                        return None
                    return {"text": text, "segments": segments,
                            "provider": "assemblyai", "agreement": None}
                if res.get("status") == "error":
                    log.warning("assemblyai job error: %s", res.get("error"))
                    return None
                time.sleep(5)
        return None
    except Exception:
        log.exception("assemblyai transcription failed")
        return None


def _spitch(audio_path: pathlib.Path) -> Optional[dict]:
    """Spitch — the Nigerian-language specialist (Yoruba/Igbo/Hausa/
    Nigerian English, with diacritics). No diarization or word timestamps
    expected: it returns one plain-text transcript, so in the ensemble it
    serves as the code-switch-aware CROSS-CHECK voice while a diarizing
    provider stays primary.

    NOTE: endpoint/response shape is young and was not verifiable from
    this build environment — the URL is configurable (SPITCH_API_URL) and
    the parser accepts the common field spellings. Verify against
    docs.spitch.app when the API key is provisioned.
    """
    if not config.SPITCH_API_KEY:
        return None
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(
                config.SPITCH_API_URL,
                headers={"Authorization": f"Bearer {config.SPITCH_API_KEY}"},
                data={"language": config.SPITCH_LANGUAGE, "model": "mansa_v1"},
                files={"content": (audio_path.name, audio_path.read_bytes(), "audio/*")},
            )
            r.raise_for_status()
            data = r.json()
        text = (data.get("text") or data.get("transcription")
                or data.get("transcript") or "")
        if not str(text).strip():
            return None
        return {"text": str(text), "segments": [], "provider": "spitch", "agreement": None}
    except Exception:
        log.exception("spitch transcription failed")
        return None


def _intron(audio_path: pathlib.Path) -> Optional[dict]:
    """Intron Sahara — African-accent specialist (500+ accents, 23 African
    languages). Same defensive posture as Spitch: enterprise-provisioned
    API whose exact shape must be confirmed with the key (INTRON_API_URL
    is configurable); parser accepts the common field spellings. No
    diarization assumed, so it serves as a cross-check voice."""
    if not config.INTRON_API_KEY:
        return None
    try:
        with httpx.Client(timeout=_TIMEOUT) as client:
            r = client.post(
                config.INTRON_API_URL,
                headers={"Authorization": f"Bearer {config.INTRON_API_KEY}"},
                files={"file": (audio_path.name, audio_path.read_bytes(), "audio/*")},
            )
            r.raise_for_status()
            data = r.json()
        text = (data.get("text") or data.get("transcript")
                or data.get("transcription") or "")
        if not str(text).strip():
            return None
        return {"text": str(text), "segments": [], "provider": "intron", "agreement": None}
    except Exception:
        log.exception("intron transcription failed")
        return None


def _whisper(audio_path: pathlib.Path) -> Optional[dict]:
    from app.services import llm
    result = llm.transcribe(audio_path)
    if result is None:
        return None
    return {
        "text": result["text"],
        "segments": [{**s, "speaker": None} for s in result["segments"]],
        "provider": "openai-whisper",
        "agreement": None,
    }


# Default order: first available = primary transcript (wants diarization),
# second available = cross-check. The specialists sit directly behind
# Deepgram so a diarizer-vs-specialist disagreement on code-switched audio
# is real signal. resolve_order() below re-ranks per project/language.
_PROVIDERS = [
    ("deepgram", _deepgram),
    ("intron", _intron),
    ("spitch", _spitch),
    ("assemblyai", _assemblyai),
    ("openai-whisper", _whisper),
]
_PROVIDER_FNS = dict(_PROVIDERS)

# Languages where the African-speech specialists should LEAD rather than
# verify: Yoruba, Igbo, Hausa, Nigerian Pidgin, Amharic, Swahili.
_SPECIALIST_LANGUAGES = {"yo", "ig", "ha", "pcm", "am", "sw"}
_SPECIALISTS = ["intron", "spitch"]


def resolve_order(
    language: str | None = None,
    primary: str | None = None,
    verify: str | None = None,
) -> list[str]:
    """The router: decides WHICH speech engines run for an interview.

    Precedence: explicit per-project choices (stt_primary/stt_verify on
    call_project_config) > language-aware default (specialist leads for
    Nigerian/African languages, diarizer verifies) > global default order.
    Unconfigured providers are silently skipped, so a project preference
    never breaks scoring — it degrades to the next best engine.
    """
    available = configured_providers()
    order: list[str] = []

    def push(name: str | None):
        if name and name in available and name not in order:
            order.append(name)

    push(primary)
    push(verify)

    lang = (language or "").strip().lower()
    if lang in _SPECIALIST_LANGUAGES:
        # Specialist first for the languages it exists for; the diarizing
        # engine still runs as the cross-check so speaker labels and the
        # agreement signal are both preserved.
        for name in _SPECIALISTS:
            push(name)

    for name, _ in _PROVIDERS:
        push(name)
    return order


def configured_providers() -> list[str]:
    out = []
    if config.DEEPGRAM_API_KEY:
        out.append("deepgram")
    if config.INTRON_API_KEY:
        out.append("intron")
    if config.SPITCH_API_KEY:
        out.append("spitch")
    if config.ASSEMBLYAI_API_KEY:
        out.append("assemblyai")
    if config.OPENAI_API_KEY:
        out.append("openai-whisper")
    return out


def transcribe_with_verification(
    audio_path: pathlib.Path, order: list[str] | None = None
) -> Optional[dict]:
    """Primary transcript from the first working provider in `order`
    (default: resolve_order()); when a second provider exists, cross-check
    and attach the agreement ratio. A diarized transcript's speaker labels
    survive regardless of which provider ranks first — if the primary has
    no segments but the verifier does, the verifier's segments are kept."""
    names = order if order is not None else resolve_order()
    results: list[dict] = []
    for name in names:
        fn = _PROVIDER_FNS.get(name)
        if fn is None:
            continue
        r = fn(audio_path)
        if r is not None:
            results.append(r)
        if len(results) == 2:
            break
    if not results:
        return None
    primary = results[0]
    if len(results) == 2:
        ratio = difflib.SequenceMatcher(
            None, _normalize(primary["text"]), _normalize(results[1]["text"]),
        ).ratio()
        primary["agreement"] = {"provider": results[1]["provider"], "ratio": round(ratio, 3)}
        # Keep diarization wherever it came from: specialist text can lead
        # while the diarizer's speaker-labelled segments still power the
        # dominance analysis and evidence timestamps.
        if not primary.get("segments") and results[1].get("segments"):
            primary["segments"] = results[1]["segments"]
            primary["segments_provider"] = results[1]["provider"]
    return primary
