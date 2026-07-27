"""Tier 2: Voice Impersonation Agent (same-person detection).

The founder faked both sides of a call and nothing acoustic caught it —
diarization labels turn-taking, it never asks whether the two "speakers"
are physically the same voice. FieldScore's deployed voice-diversity
engine (ECAPA-TDNN speaker embeddings, cosine-compared across the two
halves of the recording) answers exactly that and catches it even when
the person pitches their voice differently.

Rather than shipping the heavy encoder here, this agent posts the call
audio to fieldscore-backend's /api/internal/acoustic-voice-check,
authenticating with a short-lived service JWT minted from the SHARED
JWT_SECRET both services already hold (one platform, one auth — the
same key this service uses to verify user tokens).
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import time

from app.agents.base import BaseAgent, AgentFinding

log = logging.getLogger(__name__)

FIELDSCORE_URL = os.getenv("FIELDSCORE_URL", "https://web-production-f5bab.up.railway.app")
_MAX_AUDIO_BYTES = 60 * 1024 * 1024


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode().rstrip("=")


def _mint_service_token() -> str | None:
    secret = os.getenv("JWT_SECRET", "")
    if not secret:
        return None
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({
        "sub": "callscore-service", "org": "internal", "role": "admin",
        "exp": time.time() + 120,  # one call's worth of lifetime
    }).encode())
    sig = _b64url(hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest())
    return f"{header}.{payload}.{sig}"


class VoiceImpersonationAgent(BaseAgent):
    name = "voice_impersonation"

    def run(self, interview_session_id: str, context: dict) -> list[AgentFinding]:
        audio_path = context.get("audio_path")
        token = _mint_service_token()
        if audio_path is None or token is None:
            raise NotImplementedError  # absent capability -> reduced confidence

        data = audio_path.read_bytes()
        if not data or len(data) > _MAX_AUDIO_BYTES:
            raise NotImplementedError

        import httpx

        # The decoder picks its parser from this mimetype — a wrong label
        # (webm bytes read as mp3) makes the check silently unavailable.
        suffix = audio_path.suffix.lower()
        mime = {
            ".webm": "audio/webm", ".wav": "audio/wav", ".m4a": "audio/mp4",
            ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".mp4": "audio/mp4",
        }.get(suffix, "audio/webm")
        resp = httpx.post(
            f"{FIELDSCORE_URL}/api/internal/acoustic-voice-check",
            headers={"Authorization": f"Bearer {token}"},
            files={"file": (audio_path.name, data, mime)},
            timeout=120,
        )
        if resp.status_code != 200:
            log.warning("acoustic voice check returned HTTP %s", resp.status_code)
            raise NotImplementedError
        result = resp.json()
        if not result.get("available"):
            raise NotImplementedError  # encoder unavailable / audio too short

        status = result.get("status")
        similarity = result.get("cosine_similarity")
        if status in ("REJECT", "FLAG"):
            return [AgentFinding(
                agent_name=self.name,
                finding_type="single_voice",
                description=str(result.get("finding", "Both sides of the call sound like the same voice.")),
                confidence=92 if status == "REJECT" else 65,
                raw_output={"cosine_similarity": similarity, "engine_status": status,
                            "method": result.get("method")},
            )]
        # Distinct voices: informational evidence that the check RAN and
        # passed — coverage a supervisor and an auditor can both see.
        return [AgentFinding(
            agent_name=self.name,
            finding_type="voice_diversity_ok",
            description=str(result.get("finding", "Two acoustically distinct voices detected.")),
            confidence=0,
            raw_output={"cosine_similarity": similarity, "method": result.get("method")},
        )]
