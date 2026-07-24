"""
Per-IP rate limiting. Fixed-window counter, in-process — deliberately
simple: one Railway instance means one limiter, and the goal is stopping
credential-stuffing and runaway clients, not precision traffic shaping.
If the service ever scales horizontally, swap the store for Redis; the
middleware interface stays the same.

RATE_LIMIT_PER_MINUTE (default 240) — 0 disables. /health is exempt so
platform probes never get throttled.
"""
import os
import threading
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "240"))

_EXEMPT_PATHS = {"/health"}


class RateLimiter:
    def __init__(self, limit_per_minute: int):
        self.limit = limit_per_minute
        self._lock = threading.Lock()
        self._counts: dict[tuple[str, int], int] = {}

    def allow(self, key: str, now: float | None = None) -> bool:
        if self.limit <= 0:
            return True
        window = int((now if now is not None else time.time()) // 60)
        with self._lock:
            # prune windows older than the previous one so memory stays flat
            for k in [k for k in self._counts if k[1] < window - 1]:
                del self._counts[k]
            count = self._counts.get((key, window), 0) + 1
            self._counts[(key, window)] = count
            return count <= self.limit


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, limit_per_minute: int | None = None):
        super().__init__(app)
        self.limiter = RateLimiter(
            RATE_LIMIT_PER_MINUTE if limit_per_minute is None else limit_per_minute
        )

    async def dispatch(self, request, call_next):
        if request.url.path in _EXEMPT_PATHS:
            return await call_next(request)
        client_ip = request.client.host if request.client else "unknown"
        # Honour the platform proxy's client header when present.
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            client_ip = forwarded.split(",")[0].strip() or client_ip
        if not self.limiter.allow(client_ip):
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests — slow down and retry."},
                headers={"Retry-After": "60"},
            )
        return await call_next(request)
