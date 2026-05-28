"""Database configuration and session management."""
from __future__ import annotations
import os
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session

# Load .env only in local development — Railway sets DATABASE_URL as a real env var
_db_url = os.environ.get("DATABASE_URL")
if not _db_url:
    from pathlib import Path
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    from app.core.config import get_settings
    _db_url = get_settings().database_url

if not _db_url:
    raise RuntimeError("DATABASE_URL is not set. Add it to .env or set it as an environment variable.")

DATABASE_URL = _db_url

engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
    connect_args={"connect_timeout": 10},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
