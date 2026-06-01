"""Auth-specific workspace route tests."""
from __future__ import annotations

import pytest
from uuid import uuid4


def test_create_workspace_requires_auth(client, db, mock_runtime):
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
            r = unauth_client.post("/workspaces", json={"name": "hack-ws"})
    assert r.status_code == 401, r.text


def test_create_workspace_for_own_org_succeeds(client, mock_user):
    r = client.post(
        "/workspaces",
        json={"name": "my-ws", "organization_id": str(mock_user._test_org_id)},
    )
    assert r.status_code == 201, r.text
    assert "id" in r.json()


def test_create_workspace_for_foreign_org_returns_403(client, db, mock_user):
    from app.db.models import Organization
    other_org = Organization(
        id=uuid4(), name="Other", slug=f"other-{uuid4().hex[:6]}", is_active=True,
        owner_id=mock_user.id,
    )
    db.add(other_org)
    db.flush()
    r = client.post(
        "/workspaces",
        json={"name": "hack-ws", "organization_id": str(other_org.id)},
    )
    assert r.status_code == 403, r.text


def test_list_workspaces_filters_by_org(client, mock_user):
    client.post(
        "/workspaces",
        json={"name": "ws-filter-test", "organization_id": str(mock_user._test_org_id)},
    )
    r = client.get("/workspaces", params={"organization_id": str(mock_user._test_org_id)})
    assert r.status_code == 200, r.text
    body = r.json()
    data = body["workspaces"] if isinstance(body, dict) and "workspaces" in body else body
    assert isinstance(data, list)
    for ws in data:
        assert ws.get("organization_id") == str(mock_user._test_org_id)
