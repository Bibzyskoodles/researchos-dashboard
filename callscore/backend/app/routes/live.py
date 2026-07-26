"""Live transcription + answer pre-fill for the laptop capture flow —
the realtime half of Glance-Confirm (Bible 8.5: settled/confirm states).

The browser streams its MediaRecorder chunks here over a WebSocket; this
route relays them to Deepgram's realtime API (the key never reaches the
browser — the same rule as every other provider) and, as final
transcript segments accumulate, periodically runs a lightweight
extraction pass against the project questionnaire. The client receives:

  {"type": "status", "state": "live" | "unavailable"}
  {"type": "transcript", "text": "..."}                  (final segments)
  {"type": "answers", "answers": [{question_key, answer, confidence}]}

Design guarantees, same as the post-hoc extraction agent: answers are
drafts for the enumerator to CONFIRM (amber state), they never overwrite
anything typed, and the authoritative extraction still happens in the
pipeline after upload. A dropped socket degrades to exactly the
pre-existing manual flow — recording is untouched (it stays entirely
client-side and uploads at Stop).

Offline-first note (Design Principle 5): this is a laptop-only
enhancement — the mobile app keeps the post-hoc path, because live
streaming requires connectivity the field cannot promise.
"""
import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core import config

log = logging.getLogger(__name__)
router = APIRouter()

_EXTRACT_EVERY_SECONDS = 15
_MIN_NEW_CHARS = 40  # don't re-extract until the transcript actually grew


def _load_questionnaire(project_id: str) -> list[dict]:
    from app import models
    from app.db import get_sessionmaker

    with get_sessionmaker()() as db:
        items = (
            db.query(models.QuestionnaireItem)
            .filter(models.QuestionnaireItem.project_id == project_id)
            .order_by(models.QuestionnaireItem.sort_order)
            .all()
        )
        return [
            {"question_key": i.question_key, "question_text": i.question_text}
            for i in items
        ]


def _extract(questions: list[dict], transcript: str) -> list[dict]:
    """One cheap extraction pass. Same grounding rule as the pipeline's
    answer_extraction agent: no quote in the transcript, no answer."""
    from app.services import llm

    if not llm.available() or not questions or not transcript.strip():
        return []
    result = llm.judge(
        "You extract questionnaire answers from a LIVE, PARTIAL research "
        "interview transcript. Extract only answers the respondent has "
        "clearly given so far — skip anything not yet asked or answered, "
        "never infer. Respond with JSON: {\"answers\": [{\"question_key\": "
        "string, \"answer\": string, \"confidence\": number 0-100}]}.",
        f"QUESTIONNAIRE:\n{json.dumps(questions)[:6000]}\n\n"
        f"TRANSCRIPT SO FAR:\n{transcript[-16000:]}",
    )
    if not result:
        return []
    valid = {q["question_key"] for q in questions}
    out = []
    for a in result.get("answers", []):
        key, answer = str(a.get("question_key", "")), str(a.get("answer", "")).strip()
        if key in valid and answer:
            try:
                conf = max(0, min(100, int(a.get("confidence", 0))))
            except (TypeError, ValueError):
                continue
            out.append({"question_key": key, "answer": answer, "confidence": conf})
    return out


@router.websocket("/transcribe")
async def live_transcribe(
    ws: WebSocket,
    project_id: str = "",
    language: str = "en",
    token: str = "",
    encoding: str = "",     # e.g. "linear16" — mobile streams raw PCM tailed
    sample_rate: int = 0,   # from its WAV recording; browser sends webm
):
    # Browsers cannot set headers on a WebSocket, so the Bearer token
    # travels as a query param — verified with the exact same shared-JWT
    # check every HTTP route uses (fail-closed, app/core/auth.py).
    from app.core.auth import verify_token

    await ws.accept()
    if verify_token(token) is None:
        await ws.send_json({"type": "status", "state": "unauthorized"})
        await ws.close()
        return
    if not config.DEEPGRAM_API_KEY:
        await ws.send_json({"type": "status", "state": "unavailable"})
        await ws.close()
        return

    try:
        import websockets
    except ImportError:
        log.warning("websockets package missing — live transcription off")
        await ws.send_json({"type": "status", "state": "unavailable"})
        await ws.close()
        return

    questions = await asyncio.to_thread(_load_questionnaire, project_id) if project_id else []

    dg_url = (
        "wss://api.deepgram.com/v1/listen"
        "?model=nova-2&smart_format=true&interim_results=false"
        f"&language={language or 'en'}"
    )
    if encoding:
        dg_url += f"&encoding={encoding}&sample_rate={sample_rate or 16000}&channels=1"
    transcript_parts: list[str] = []
    last_extract_len = 0

    try:
        async with websockets.connect(
            dg_url, extra_headers={"Authorization": f"Token {config.DEEPGRAM_API_KEY}"}
        ) as dg:
            await ws.send_json({"type": "status", "state": "live"})

            async def pump_audio():
                try:
                    while True:
                        chunk = await ws.receive_bytes()
                        await dg.send(chunk)
                except (WebSocketDisconnect, RuntimeError):
                    try:
                        await dg.send(json.dumps({"type": "CloseStream"}))
                    except Exception:
                        pass

            async def pump_transcripts():
                nonlocal last_extract_len
                loop = asyncio.get_running_loop()
                next_extract = loop.time() + _EXTRACT_EVERY_SECONDS
                async for message in dg:
                    try:
                        data = json.loads(message)
                    except (TypeError, ValueError):
                        continue
                    alt = (
                        (data.get("channel") or {}).get("alternatives") or [{}]
                    )[0]
                    text = (alt.get("transcript") or "").strip()
                    if text and data.get("is_final"):
                        transcript_parts.append(text)
                        await ws.send_json({"type": "transcript", "text": text})

                    if loop.time() >= next_extract:
                        next_extract = loop.time() + _EXTRACT_EVERY_SECONDS
                        full = " ".join(transcript_parts)
                        if questions and len(full) - last_extract_len >= _MIN_NEW_CHARS:
                            last_extract_len = len(full)
                            answers = await asyncio.to_thread(_extract, questions, full)
                            if answers:
                                await ws.send_json({"type": "answers", "answers": answers})

            audio_task = asyncio.create_task(pump_audio())
            transcript_task = asyncio.create_task(pump_transcripts())
            done, pending = await asyncio.wait(
                {audio_task, transcript_task}, return_when=asyncio.FIRST_COMPLETED
            )
            for t in pending:
                t.cancel()
    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("live transcription session failed")
        try:
            await ws.send_json({"type": "status", "state": "unavailable"})
        except Exception:
            pass
    finally:
        try:
            await ws.close()
        except Exception:
            pass
