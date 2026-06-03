"""Tests for KoreanLawScraper and law-sync admin routes."""
from __future__ import annotations

import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ---------------------------------------------------------------------------
# KoreanLawScraper unit tests
# ---------------------------------------------------------------------------

def _make_scraper():
    from app.services.law_apis.korean_law import KoreanLawScraper
    return KoreanLawScraper()


SAMPLE_HTML = """<html><body>
<span class="lawname">Personal Information Protection Act</span>
<div>
Article 1. Purpose
This Act aims to protect the rights of individuals.

Article 2. Definitions
"Personal information" means information about a living individual.

Article 3. Obligations of Personal Information Controllers
Controllers shall process personal information lawfully.
</div>
</body></html>"""


def test_scraper_article_markers_and_law_name():
    """KoreanLawScraper injects [ARTICLE N] and extracts .lawname from HTML."""
    import re
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(SAMPLE_HTML, "lxml")

    # Law name extraction
    el = soup.select_one(".lawname")
    assert el is not None
    law_name = el.get_text(strip=True)
    assert law_name == "Personal Information Protection Act"

    # Article marker injection (same logic as KoreanLawScraper.fetch_law_text)
    raw = soup.get_text(separator="\n")
    text = re.sub(r"\n{3,}", "\n\n", raw).strip()
    text = re.sub(r"(?m)^(Article\s+(\d+)\.)", r"[ARTICLE \2] \1", text)

    assert "[ARTICLE 1]" in text
    assert "[ARTICLE 2]" in text
    assert "[ARTICLE 3]" in text
    assert "Purpose" in text


@pytest.mark.anyio
async def test_fetch_law_text_raises_on_http_error():
    """fetch_law_text propagates httpx.HTTPStatusError on non-200 response."""
    import httpx

    scraper = _make_scraper()

    mock_resp = MagicMock()
    mock_resp.raise_for_status.side_effect = httpx.HTTPStatusError(
        "404 Not Found", request=MagicMock(), response=MagicMock()
    )
    mock_resp.text = ""

    with patch("httpx.AsyncClient.get", new=AsyncMock(return_value=mock_resp)):
        with pytest.raises(httpx.HTTPStatusError):
            await scraper.fetch_law_text(99999)


@pytest.mark.anyio
async def test_discover_and_fetch_skips_short_text():
    """discover_and_fetch skips laws whose plain text is under 500 chars."""
    scraper = _make_scraper()

    async def short_fetch(hseq: int) -> tuple[str, str]:
        return ("Short Law", "x" * 100)

    scraper.fetch_law_text = short_fetch  # type: ignore[assignment]
    results = await scraper.discover_and_fetch([1, 2, 3])
    assert results == []


@pytest.mark.anyio
async def test_discover_and_fetch_collects_valid():
    """discover_and_fetch returns entries for laws with sufficient text."""
    scraper = _make_scraper()
    long_text = "Article 1. Something important.\n" * 50  # > 500 chars

    async def long_fetch(hseq: int) -> tuple[str, str]:
        return (f"Law {hseq}", long_text)

    scraper.fetch_law_text = long_fetch  # type: ignore[assignment]
    results = await scraper.discover_and_fetch([100, 200])
    assert len(results) == 2
    assert results[0]["hseq"] == 100
    assert results[0]["char_count"] == len(long_text)


@pytest.mark.anyio
async def test_discover_and_fetch_skips_error_page():
    """discover_and_fetch skips pages containing '500 Internal Server Error'."""
    scraper = _make_scraper()
    error_text = "500 Internal Server Error " * 30  # > 500 chars but error page

    async def error_fetch(hseq: int) -> tuple[str, str]:
        return ("", error_text)

    scraper.fetch_law_text = error_fetch  # type: ignore[assignment]
    results = await scraper.discover_and_fetch([42])
    assert results == []


# ---------------------------------------------------------------------------
# Law sync route integration tests
# ---------------------------------------------------------------------------

def test_law_sync_status_requires_admin(client):
    """GET /admin/law-sync/status returns 403 for non-admin users."""
    r = client.get("/admin/law-sync/status")
    assert r.status_code == 403


def test_law_sync_status_ok_as_admin(db, mock_runtime):
    """GET /admin/law-sync/status returns 200 and a list when no laws synced."""
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
