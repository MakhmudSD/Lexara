"""
Shared pytest fixtures.

DATABASE_URL must be set before any app module is imported — this file is
loaded first by pytest, so the os.environ assignment here takes effect before
conftest imports any app code.
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_rag.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-key-for-tests-only-32c")

# Make PostgreSQL-specific column types work transparently with SQLite.
# Must happen before app.db.models is first imported.
from sqlalchemy import types as _sa_types
import sqlalchemy.dialects.postgresql as _pg

class _GUID(_sa_types.TypeDecorator):
    """UUID stored as CHAR(36) — works with both PostgreSQL and SQLite."""
    impl = _sa_types.String(36)
    cache_ok = True

    def __init__(self, as_uuid=True, **kw):
        super().__init__(**kw)

    def process_bind_param(self, value, dialect):
        return str(value) if value is not None else None

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        from uuid import UUID
        return value if isinstance(value, UUID) else UUID(str(value))

_pg.UUID = _GUID

import pytest
from unittest.mock import MagicMock
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.models import Base
from app.core.config import get_settings
from app.core.dependencies import get_db, get_runtime
from app.core.runtime import AppRuntime

TEST_DB_URL = "sqlite:///./test_rag.db"


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)
    eng.dispose()
    if os.path.exists("test_rag.db"):
        os.remove("test_rag.db")


@pytest.fixture()
def db(engine):
    """Transactional test session — rolls back after each test."""
    connection = engine.connect()
    transaction = connection.begin()
    Session = sessionmaker(bind=connection)
    session = Session()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def mock_runtime():
    settings = get_settings()
    settings.__dict__["jwt_secret_key"] = "test-secret-key-for-tests-only-32c"
    runtime = AppRuntime(
        settings=settings,
        vector_store=MagicMock(),
        observability=MagicMock(),
    )
    runtime.observability.add_token_usage = MagicMock()
    runtime.observability.add_conversation = MagicMock()
    runtime.observability.add_event = MagicMock()
    return runtime


@pytest.fixture()
def client(db, mock_runtime):
    """FastAPI test client with DB and runtime overrides."""
    from unittest.mock import patch
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_runtime] = lambda: mock_runtime
    # Tables already exist; patch the local reference inside main.py so the
    # startup event does not try to re-run Alembic migrations.
    with patch("app.main.run_migrations", return_value=None):
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c
    app.dependency_overrides.clear()
