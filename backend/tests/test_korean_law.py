"""Tests for the Korean law service and law-sync admin routes."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# KoreanLawService unit tests
# ---------------------------------------------------------------------------

class _FakeSettings:
    korean_law_api_key = "test-key"
    korean_law_api_base_url = "http://fake-api.example.com/1170000/law"


def _make_service():
    from app.services.law_apis.korean_law import KoreanLawService
    return KoreanLawService(_FakeSettings())


def test_parse_search_results_standard_keys():
    """_parse_search_results handles the expected data.go.kr JSON structure."""
    svc = _make_service()
    data = {
        "LawSearch": {
            "law": [
                {
                    "법령ID": "LAW001",
                    "법령명한글": "근로기준법",
                    "법령구분명": "법률",
                    "공포일자": "20230101",
                }
            ]
        }
    }
    results = svc._parse_search_results(data)
    assert len(results) == 1
    assert results[0]["law_id"] == "LAW001"
    assert results[0]["law_name"] == "근로기준법"
    assert results[0]["law_type"] == "법률"
    assert results[0]["promulgation_date"] == "20230101"


def test_format_law_text_injects_article_markers():
    """_format_law_text produces [ARTICLE N] headers for each article."""
    svc = _make_service()
    data = {
        "법령": {
            "조문": [
                {"조문제목": "총칙", "조문내용": "이 법은 근로 조건을 정한다."},
                {"조문제목": "근로시간", "조문내용": "주 40시간을 초과할 수 없다."},
            ]
        }
    }
    text = svc._format_law_text(data)
    assert "[ARTICLE 1] 총칙" in text
    assert "이 법은 근로 조건을 정한다." in text
    assert "[ARTICLE 2] 근로시간" in text
    assert "주 40시간을 초과할 수 없다." in text


@pytest.mark.anyio
async def test_search_laws_returns_empty_on_http_error():
    """search_laws catches exceptions and returns an empty list."""
    import httpx

    svc = _make_service()

    async def _raise(*args, **kwargs):
        raise httpx.ConnectError("network down")

    with patch("httpx.AsyncClient.get", new=AsyncMock(side_effect=_raise)):
        results = await svc.search_laws("근로기준법")

    assert results == []


@pytest.mark.anyio
async def test_fetch_and_format_empty_when_no_results():
    """fetch_and_format returns '' when search finds nothing."""
    svc = _make_service()

    with patch.object(svc, "search_laws", new=AsyncMock(return_value=[])):
        text = await svc.fetch_and_format("nonexistent law")

    assert text == ""


# ---------------------------------------------------------------------------
# Law sync route integration tests
# ---------------------------------------------------------------------------

def test_law_sync_status_requires_admin(client):
    """GET /admin/law-sync/status returns 200 when admin is mocked."""
    r = client.get("/admin/law-sync/status")
    # The test client uses mock_user who is a regular member, so require_admin
    # will reject unless we override. With the default client fixture (which
    # overrides get_current_user with mock_user whose role is "member") we
    # expect a 403.
    assert r.status_code == 403


def test_law_sync_korean_requires_admin(client):
    """POST /admin/law-sync/korean returns 403 for non-admin users."""
    r = client.post("/admin/law-sync/korean", json={"query": "근로기준법", "max_laws": 1})
    assert r.status_code == 403


def test_law_sync_status_ok_as_admin(db, mock_runtime):
    """GET /admin/law-sync/status returns 200 and an empty list when no laws synced."""
    from unittest.mock import patch
    from fastapi.testclient import TestClient
    from app.main import create_app
    from app.core.dependencies import get_db, get_runtime
    from app.core.auth import require_admin
    from app.db.models import User
    from uuid import uuid4

    admin_user = User(
        id=uuid4(),
        email="admin@test.com",
        hashed_password="x",
        role="admin",
        is_active=True,
    )

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_runtime] = lambda: mock_runtime
    app.dependency_overrides[require_admin] = lambda: admin_user

    with patch("app.main.run_migrations", return_value=None):
        with TestClient(app, raise_server_exceptions=False) as c:
            r = c.get("/admin/law-sync/status")

    assert r.status_code == 200
    assert isinstance(r.json(), list)
