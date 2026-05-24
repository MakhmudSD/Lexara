from collections.abc import Generator

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.core.runtime import AppRuntime
from app.db import get_db as _get_db


def get_runtime(request: Request) -> AppRuntime:
    return request.app.state.runtime


def get_request_id(request: Request) -> str:
    return request.state.request_id


def get_db() -> Generator[Session, None, None]:
    """Yield a synchronous SQLAlchemy session per request."""
    yield from _get_db()
