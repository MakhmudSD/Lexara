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
from uuid import uuid4
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.db.models import Base, User, Organization, OrganizationMember
from app.core.config import get_settings
from app.core.dependencies import get_db, get_runtime
from app.core.runtime import AppRuntime
from app.core.auth import get_current_user

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
def mock_user(db):
    """Create a test user with an organization membership."""
    from app.services.auth_service import hash_password
    # Create user first so owner_id FK can be satisfied
    user = User(
        id=uuid4(),
        email=f"test-{uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("password123"),
        full_name="Test User",
        is_active=True,
    )
    db.add(user)
    db.flush()
    org = Organization(
        id=uuid4(),
        name="Test Org",
        slug=f"test-org-{uuid4().hex[:8]}",
        owner_id=user.id,
        is_active=True,
    )
    db.add(org)
    db.flush()
    member = OrganizationMember(
        id=uuid4(),
        organization_id=org.id,
        user_id=user.id,
        role="member",
    )
    db.add(member)
    db.flush()
    user._test_org_id = org.id
    return user


@pytest.fixture()
def client(db, mock_runtime, mock_user):
    """FastAPI test client with DB, runtime, and auth overrides."""
    from unittest.mock import patch
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_runtime] = lambda: mock_runtime
    app.dependency_overrides[get_current_user] = lambda: mock_user
    # Tables already exist; patch the local reference inside main.py so the
    # startup event does not try to re-run Alembic migrations.
    with patch("app.main.run_migrations", return_value=None):
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def auth_client(db, mock_runtime):
    """FastAPI test client with DB and runtime overrides but WITHOUT auth override.

    Use this fixture for tests that exercise the real JWT authentication flow
    (e.g. /auth/me, token-based tests).
    """
    from unittest.mock import patch
    from app.main import create_app

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_runtime] = lambda: mock_runtime
    # get_current_user is intentionally NOT overridden here
    with patch("app.main.run_migrations", return_value=None):
        with TestClient(app, raise_server_exceptions=False) as c:
            yield c
    app.dependency_overrides.clear()
