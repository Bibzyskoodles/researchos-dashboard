"""Auth layer tests: token verification mirrors fieldscore-backend's format,
routes fail closed without a valid Bearer token."""
import base64
import hashlib
import hmac
import json
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.core import auth


def _b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).decode().rstrip("=")


def make_token(secret: str, role: str = "manager", org: str = "ORG-1", exp_hours: float = 1) -> str:
    # Same construction as fieldscore-backend auth.py::generate_token.
    header = _b64url(json.dumps({"alg": "HS256", "typ": "JWT"}).encode())
    payload = _b64url(json.dumps({
        "sub": "U1", "org": org, "role": role,
        "exp": (datetime.now(timezone.utc) + timedelta(hours=exp_hours)).timestamp(),
    }).encode())
    sig = hmac.new(secret.encode(), f"{header}.{payload}".encode(), hashlib.sha256).digest()
    return f"{header}.{payload}.{_b64url(sig)}"


class TestVerifyToken:
    def test_valid_token_round_trips(self, monkeypatch):
        monkeypatch.setattr(auth, "JWT_SECRET", "s3cret")
        data = auth.verify_token(make_token("s3cret"))
        assert data and data["org"] == "ORG-1" and data["role"] == "manager"

    def test_wrong_secret_rejected(self, monkeypatch):
        monkeypatch.setattr(auth, "JWT_SECRET", "s3cret")
        assert auth.verify_token(make_token("other")) is None

    def test_expired_rejected(self, monkeypatch):
        monkeypatch.setattr(auth, "JWT_SECRET", "s3cret")
        assert auth.verify_token(make_token("s3cret", exp_hours=-1)) is None

    def test_no_secret_fails_closed(self, monkeypatch):
        monkeypatch.setattr(auth, "JWT_SECRET", "")
        assert auth.verify_token(make_token("")) is None


class TestRouteAuth:
    def _client(self):
        from app.main import app
        return TestClient(app)

    def test_unauthenticated_401(self, monkeypatch):
        monkeypatch.setattr(auth, "JWT_SECRET", "s3cret")
        r = self._client().get("/api/v1/scorecards/queue/PROJ-1")
        assert r.status_code == 401

    def test_client_role_403_on_scorecards(self, monkeypatch):
        monkeypatch.setattr(auth, "JWT_SECRET", "s3cret")
        r = self._client().get(
            "/api/v1/scorecards/queue/PROJ-1",
            headers={"Authorization": f"Bearer {make_token('s3cret', role='client')}"},
        )
        assert r.status_code == 403

    def test_health_stays_open(self):
        assert self._client().get("/health").status_code == 200
