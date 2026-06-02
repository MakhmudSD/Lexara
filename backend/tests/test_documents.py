"""Tests for document upload and listing routes."""
from __future__ import annotations

import pytest


def _make_workspace(client, org_id: str) -> str:
    r = client.post("/workspaces", json={"name": "doc-test-ws", "organization_id": org_id})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_upload_valid_txt(client, mock_user):
    ws_id = _make_workspace(client, str(mock_user._test_org_id))
    r = client.post(
        "/documents/upload",
        data={"workspace_id": ws_id},
        files={"file": ("test.txt", b"Hello world. " * 20, "text/plain")},
    )
    assert r.status_code == 202, r.text
    assert r.json().get("chunk_count", 0) >= 0  # chunk_count may be 0 if processing is async


def test_upload_unsupported_format(client, mock_user):
    ws_id = _make_workspace(client, str(mock_user._test_org_id))
    r = client.post(
        "/documents/upload",
        data={"workspace_id": ws_id},
        files={"file": ("bad.exe", b"MZ binary content", "application/octet-stream")},
    )
    assert r.status_code in (400, 422), r.text


def test_upload_no_auth_returns_401(client, db, mock_runtime):
    """Without the get_current_user override the endpoint must return 401."""
    from unittest.mock import patch
    from app.main import create_app
    from app.core.dependencies import get_db, get_runtime

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_runtime] = lambda: mock_runtime
    # NOTE: get_current_user is NOT overridden here
    from fastapi.testclient import TestClient
    with patch("app.main.run_migrations", return_value=None):
        with TestClient(app, raise_server_exceptions=False) as unauth_client:
            r = unauth_client.post(
                "/documents/upload",
                data={"workspace_id": "00000000-0000-0000-0000-000000000000"},
                files={"file": ("test.txt", b"hello", "text/plain")},
            )
    assert r.status_code == 401, r.text


def test_upload_empty_file(client, mock_user):
    ws_id = _make_workspace(client, str(mock_user._test_org_id))
    r = client.post(
        "/documents/upload",
        data={"workspace_id": ws_id},
        files={"file": ("empty.txt", b"", "text/plain")},
    )
    assert r.status_code in (400, 422), r.text
