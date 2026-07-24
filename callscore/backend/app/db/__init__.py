"""
Database engine + session management.

Data residency note (Bible Part 5.4): in a multi-region deployment the
engine must be selected per organization.region. This module exposes a
single engine for the MVP but keeps creation behind get_engine() so a
region-keyed registry can replace it without touching callers.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core import config


class Base(DeclarativeBase):
    pass


_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        if not config.DATABASE_URL:
            raise RuntimeError("DATABASE_URL is not configured")
        _engine = create_engine(config.DATABASE_URL, pool_pre_ping=True)
    return _engine


def get_sessionmaker() -> sessionmaker:
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(bind=get_engine(), expire_on_commit=False)
    return _SessionLocal


def get_db():
    """FastAPI dependency: yields a Session, always closes it."""
    db: Session = get_sessionmaker()()
    try:
        yield db
    finally:
        db.close()
