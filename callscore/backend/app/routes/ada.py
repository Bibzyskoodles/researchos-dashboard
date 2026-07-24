"""Ada's voice — text-to-speech in the enumerator's language.

Spitch TTS covers Yoruba/Igbo/Hausa/Nigerian English natively, which is
what makes "Ada speaks your language" real rather than English-only.
Same server-side-key pattern as FieldScore's /ada/speak (never a
provider key in the browser/app). Env-gated: no SPITCH_API_KEY -> 503,
and the caller falls back to on-screen text.

Register rule still applies upstream: whatever text arrives here was
produced through build_ada_utterance()'s deterministic register framing —
this route only gives it sound.
"""
import httpx
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

from app.core import config

router = APIRouter()

# Default Spitch voices per language — override per request if needed.
_DEFAULT_VOICES = {"en": "lucy", "yo": "sade", "ig": "obinna", "ha": "hasan"}


class SpeakIn(BaseModel):
    text: str
    language: str = "en"   # en | yo | ig | ha (Spitch codes)
    voice: str | None = None


@router.post("/speak")
def speak(payload: SpeakIn):
    if not config.SPITCH_API_KEY:
        raise HTTPException(status_code=503, detail="No TTS provider configured.")
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=422, detail="Nothing to say.")
    lang = payload.language.strip().lower()
    try:
        r = httpx.post(
            config.SPITCH_API_URL.replace("/transcriptions", "/speech"),
            headers={"Authorization": f"Bearer {config.SPITCH_API_KEY}"},
            json={
                "text": text[:1000],
                "language": lang,
                "voice": payload.voice or _DEFAULT_VOICES.get(lang, "lucy"),
            },
            timeout=120,
        )
        r.raise_for_status()
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="TTS provider request failed.")
    return Response(
        content=r.content,
        media_type=r.headers.get("content-type", "audio/wav"),
        headers={"Cache-Control": "no-store"},
    )
