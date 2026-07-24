"""
Bearer-token verification for the CallScore service.

FieldScore and CallScore are one app with two capture engines (Bible 1.3) —
one login, one token. This module verifies the SAME HS256 JWTs that
fieldscore-backend's auth.py issues (claims: sub, org, role, exp), using the
shared JWT_SECRET. Deployment note: both Railway services must be given the
identical JWT_SECRET value or every request here 401s.

Fail-closed: if JWT_SECRET is unset, every request is rejected rather than
letting the service run open. Frontend role-hiding is a UX nicety
(researchos-dashboard CLAUDE.md) — this dependency is the enforcement.
"""
import base64
import hashlib
import hmac
import json
import os
from datetime import datetime, timezone

from fastapi import Depends, HTTPException, Request

JWT_SECRET = os.getenv("JWT_SECRET", "")

CLIENT_ROLE = "client"  # read-only external guest, mirrors fieldscore auth.py


def _b64url_decode(s: str) -> bytes:
    pad = 4 - len(s) % 4
    return base64.urlsafe_b64decode(s + "=" * pad)


def verify_token(token: str) -> dict | None:
    """Mirror of fieldscore-backend auth.py::verify_token. Returns the
    payload dict ({sub, org, role, exp}) or None."""
    if not JWT_SECRET:
        return None
    try:
        parts = token.split(".")
        if len(parts) != 3:
            return None
        header, payload, sig = parts
        sig_input = f"{header}.{payload}".encode()
        expected = hmac.new(JWT_SECRET.encode(), sig_input, hashlib.sha256).digest()
        if not hmac.compare_digest(_b64url_decode(sig), expected):
            return None
        data = json.loads(_b64url_decode(payload))
        if data.get("exp", 0) < datetime.now(timezone.utc).timestamp():
            return None
        return data
    except Exception:
        return None


def require_auth(request: Request) -> dict:
    """FastAPI dependency: any authenticated FieldScore user."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = verify_token(auth[len("Bearer "):].strip())
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    if not payload.get("org"):
        raise HTTPException(status_code=403, detail="No organisation on token")
    return payload


def require_staff(payload: dict = Depends(require_auth)) -> dict:
    """Authenticated AND not the external client role — call-mode data is
    enumerator-identifying (queue items, scorecards, overrides), which the
    client role is blocked from throughout the platform."""
    if payload.get("role", "") == CLIENT_ROLE:
        raise HTTPException(status_code=403, detail="Not permitted for this role")
    return payload
