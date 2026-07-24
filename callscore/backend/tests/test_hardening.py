"""Wave 1.5 hardening: rate limiter and pipeline worker gating."""
from fastapi.testclient import TestClient

from app.core.ratelimit import RateLimiter
from app.workers import pipeline_worker


class TestRateLimiter:
    def test_allows_under_limit(self):
        rl = RateLimiter(5)
        assert all(rl.allow("1.2.3.4", now=1000.0) for _ in range(5))

    def test_blocks_over_limit(self):
        rl = RateLimiter(3)
        for _ in range(3):
            assert rl.allow("1.2.3.4", now=1000.0)
        assert rl.allow("1.2.3.4", now=1000.0) is False

    def test_window_resets(self):
        rl = RateLimiter(1)
        assert rl.allow("1.2.3.4", now=1000.0)
        assert rl.allow("1.2.3.4", now=1000.0) is False
        assert rl.allow("1.2.3.4", now=1061.0)  # next minute window

    def test_per_ip_isolation(self):
        rl = RateLimiter(1)
        assert rl.allow("1.1.1.1", now=1000.0)
        assert rl.allow("2.2.2.2", now=1000.0)  # other client unaffected

    def test_zero_disables(self):
        rl = RateLimiter(0)
        assert all(rl.allow("1.2.3.4", now=1000.0) for _ in range(1000))

    def test_health_exempt_from_middleware(self):
        from app.main import app
        client = TestClient(app)
        assert client.get("/health").status_code == 200


class TestWorkerGating:
    def test_inline_mode_env(self, monkeypatch):
        monkeypatch.setenv("PIPELINE_INLINE", "true")
        assert pipeline_worker.inline_mode() is True
        monkeypatch.delenv("PIPELINE_INLINE")
        assert pipeline_worker.inline_mode() is False

    def test_start_worker_noop_without_database(self, monkeypatch):
        from app.core import config
        monkeypatch.delenv("PIPELINE_INLINE", raising=False)
        monkeypatch.setattr(config, "DATABASE_URL", None)
        pipeline_worker.start_worker()  # must not raise or spawn
        assert pipeline_worker._started is False
