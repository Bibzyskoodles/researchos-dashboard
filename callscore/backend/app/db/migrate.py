"""
Apply SQL migrations in filename order. Every migration in migrations/ is
written to be idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS /
CREATE OR REPLACE), so running this on every deploy is safe — the same
migrate-on-startup pattern fieldscore-backend's db.init_db() uses.

Usage: python -m app.db.migrate   (needs DATABASE_URL)
"""
import logging
import pathlib
import sys

from sqlalchemy import text

from app.db import get_engine

log = logging.getLogger(__name__)

MIGRATIONS_DIR = pathlib.Path(__file__).resolve().parents[2] / "migrations"


def apply_migrations() -> list[str]:
    applied = []
    engine = get_engine()
    with engine.begin() as conn:
        for path in sorted(MIGRATIONS_DIR.glob("*.sql")):
            log.info("applying %s", path.name)
            conn.execute(text(path.read_text()))
            applied.append(path.name)
    return applied


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    names = apply_migrations()
    print(f"applied {len(names)} migration(s): {', '.join(names)}")
    sys.exit(0)
