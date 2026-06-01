"""Tests for RAG retrieval via the chat endpoint."""
from __future__ import annotations

import pytest


def _make_workspace(client, org_id: str) -> str:
    r = client.post("/workspaces", json={"name": "ret-ws", "organization_id": org_id})
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _upload_doc(client, ws_id: str) -> None:
    content = b"Lexara is a RAG SaaS platform that helps teams search documents. " * 10
    r = client.post(
        "/documents/upload",
        data={"workspace_id": ws_id},
        files={"file": ("lexara.txt", content, "text/plain")},
    )
    assert r.status_code == 201, r.text


def test_query_empty_workspace_returns_no_error(client, mock_user):
    ws_id = _make_workspace(client, str(mock_user._test_org_id))
    r = client.post("/chat/query", json={"question": "anything", "workspace_id": ws_id})
    assert r.status_code == 200, r.text


def test_query_requires_auth(client, db, mock_runtime):
    """Without auth override endpoint must return 401."""
    from unittest.mock import patch
    from app.main import create_app
    from app.core.dependencies import get_db, get_runtime

    app = create_app()
    app.dependency_overrides[get_db] = lambda: db
    app.dependency_overrides[get_runtime] = lambda: mock_runtime
    from fastapi.testclient import TestClient
    with patch("app.main.run_migrations", return_value=None):
        with TestClient(app, raise_server_exceptions=False) as unauth_client:
            r = unauth_client.post("/chat/query", json={"question": "test", "workspace_id": "00000000-0000-0000-0000-000000000000"})
    assert r.status_code == 401, r.text


def test_query_with_top_k_param(client, mock_user):
    ws_id = _make_workspace(client, str(mock_user._test_org_id))
    r = client.post("/chat/query", json={"question": "Lexara", "workspace_id": ws_id, "top_k": 1})
    assert r.status_code == 200, r.text
    sources = r.json().get("sources", [])
    assert len(sources) <= 1
