"""Integration tests for workspace HTTP endpoints."""
import pytest


class TestQuickCreate:
    def test_creates_with_given_name(self, client):
        r = client.post("/workspaces/quick", json={"name": "my-space"})
        assert r.status_code == 201
        assert r.json()["name"] == "my-space"
        assert r.json()["is_active"] is True

    def test_creates_random_name_when_empty(self, client):
        r = client.post("/workspaces/quick", json={"name": ""})
        assert r.status_code == 201
        assert len(r.json()["name"]) > 0

    def test_creates_random_name_for_my_workspace(self, client):
        r = client.post("/workspaces/quick", json={"name": "My Workspace"})
        assert r.status_code == 201
        # Generic placeholder name is replaced with a random one
        assert r.json()["name"] != "My Workspace"


class TestCreateWorkspace:
    def test_creates_workspace(self, client):
        r = client.post("/workspaces", json={"name": "project-alpha"})
        assert r.status_code == 201
        assert r.json()["name"] == "project-alpha"

    def test_missing_name_rejected(self, client):
        r = client.post("/workspaces", json={})
        assert r.status_code == 422


class TestListWorkspaces:
    def test_returns_list(self, client):
        client.post("/workspaces", json={"name": "list-ws-1"})
        client.post("/workspaces", json={"name": "list-ws-2"})
        r = client.get("/workspaces")
        assert r.status_code == 200
        data = r.json()
        assert "workspaces" in data
        assert "total" in data
        names = [w["name"] for w in data["workspaces"]]
        assert "list-ws-1" in names
        assert "list-ws-2" in names

    def test_pagination_params(self, client):
        for i in range(3):
            client.post("/workspaces", json={"name": f"pag-ws-{i}"})
        r = client.get("/workspaces?limit=2&skip=0")
        assert r.status_code == 200
        assert len(r.json()["workspaces"]) <= 2


class TestRenameWorkspace:
    def test_renames_successfully(self, client):
        ws_id = client.post("/workspaces", json={"name": "old-name"}).json()["id"]
        r = client.patch(f"/workspaces/{ws_id}/name", json={"name": "new-name"})
        assert r.status_code == 200
        assert r.json()["name"] == "new-name"

    def test_name_too_short_rejected(self, client):
        ws_id = client.post("/workspaces", json={"name": "rename-me"}).json()["id"]
        # Pydantic min_length=2 rejects single-char names with 422;
        # a whitespace-padded single char passes Pydantic but fails the custom
        # _validate_workspace_name check with 400.
        r = client.patch(f"/workspaces/{ws_id}/name", json={"name": " x"})
        assert r.status_code == 400

    def test_name_too_long_rejected(self, client):
        ws_id = client.post("/workspaces", json={"name": "rename-me-long"}).json()["id"]
        # Stripping cannot lengthen a string, so a 41-char stripped name is
        # impossible when raw is ≤40.  Pydantic's max_length=40 catches 41+
        # raw chars first and returns 422.
        r = client.patch(f"/workspaces/{ws_id}/name", json={"name": "a" * 41})
        assert r.status_code == 422

    def test_forbidden_chars_rejected(self, client):
        ws_id = client.post("/workspaces", json={"name": "valid-name"}).json()["id"]
        r = client.patch(f"/workspaces/{ws_id}/name", json={"name": "bad/name"})
        assert r.status_code == 400

    def test_nonexistent_workspace_returns_404(self, client):
        from uuid import uuid4
        r = client.patch(f"/workspaces/{uuid4()}/name", json={"name": "whatever"})
        assert r.status_code == 404


class TestDeleteWorkspace:
    def test_soft_deletes(self, client):
        ws_id = client.post("/workspaces", json={"name": "deleteme"}).json()["id"]
        r = client.delete(f"/workspaces/{ws_id}")
        assert r.status_code == 204
        # Workspace no longer appears in list
        names = [w["name"] for w in client.get("/workspaces").json()["workspaces"]]
        assert "deleteme" not in names

    def test_deleting_nonexistent_returns_404(self, client):
        from uuid import uuid4
        r = client.delete(f"/workspaces/{uuid4()}")
        assert r.status_code == 404
