"""Unit tests for workspace CRUD operations."""
import pytest
from uuid import uuid4
from app.crud import workspace as ws_crud
from app.core.exceptions import AppError


def _uid():
    return uuid4()


class TestCreateWorkspace:
    def test_creates_workspace(self, db):
        uid = _uid()
        ws = ws_crud.create_workspace(db, name="My Workspace", user_id=uid)
        assert ws.id is not None
        assert ws.name == "My Workspace"
        assert ws.is_active is True

    def test_strips_whitespace(self, db):
        ws = ws_crud.create_workspace(db, name="  trimmed  ", user_id=_uid())
        assert ws.name == "trimmed"

    def test_duplicate_name_for_same_user_raises_409(self, db):
        uid = _uid()
        ws_crud.create_workspace(db, name="duplicate", user_id=uid)
        with pytest.raises(AppError) as exc_info:
            ws_crud.create_workspace(db, name="duplicate", user_id=uid)
        assert exc_info.value.status_code == 409
        assert exc_info.value.code == "workspace_name_taken"

    def test_same_name_different_users_allowed(self, db):
        ws1 = ws_crud.create_workspace(db, name="shared-name", user_id=_uid())
        ws2 = ws_crud.create_workspace(db, name="shared-name", user_id=_uid())
        assert ws1.id != ws2.id

    def test_no_org_id_allowed(self, db):
        ws = ws_crud.create_workspace(db, name="no-org", user_id=_uid())
        assert ws.organization_id is None


class TestGetWorkspace:
    def test_get_existing(self, db):
        created = ws_crud.create_workspace(db, name="findme", user_id=_uid())
        fetched = ws_crud.get_workspace(db, created.id)
        assert fetched is not None
        assert fetched.id == created.id

    def test_get_nonexistent_returns_none(self, db):
        assert ws_crud.get_workspace(db, uuid4()) is None

    def test_get_or_404_raises_on_missing(self, db):
        with pytest.raises(AppError) as exc_info:
            ws_crud.get_workspace_or_404(db, uuid4())
        assert exc_info.value.status_code == 404
        assert exc_info.value.code == "workspace_not_found"

    def test_inactive_workspace_not_returned(self, db):
        ws = ws_crud.create_workspace(db, name="inactive", user_id=_uid())
        ws_crud.deactivate_workspace(db, ws.id)
        assert ws_crud.get_workspace(db, ws.id) is None


class TestListWorkspaces:
    def test_lists_own_workspaces(self, db):
        uid = _uid()
        ws_crud.create_workspace(db, name="ws-a", user_id=uid)
        ws_crud.create_workspace(db, name="ws-b", user_id=uid)
        results = ws_crud.list_workspaces(db, user_id=uid)
        names = [w.name for w in results]
        assert "ws-a" in names
        assert "ws-b" in names

    def test_does_not_return_other_users_workspaces(self, db):
        uid_a, uid_b = _uid(), _uid()
        ws_crud.create_workspace(db, name="alice-ws", user_id=uid_a)
        results = ws_crud.list_workspaces(db, user_id=uid_b)
        assert all(w.name != "alice-ws" for w in results)

    def test_excludes_inactive(self, db):
        uid = _uid()
        ws = ws_crud.create_workspace(db, name="gone", user_id=uid)
        ws_crud.deactivate_workspace(db, ws.id)
        names = [w.name for w in ws_crud.list_workspaces(db, user_id=uid)]
        assert "gone" not in names

    def test_filters_by_org_id(self, db):
        uid = _uid()
        org = uuid4()
        ws_crud.create_workspace(db, name="in-org", user_id=uid, organization_id=org)
        ws_crud.create_workspace(db, name="out-of-org", user_id=uid)
        results = ws_crud.list_workspaces(db, user_id=uid, organization_id=org)
        assert all(str(w.organization_id) == str(org) for w in results)

    def test_pagination(self, db):
        uid = _uid()
        for i in range(5):
            ws_crud.create_workspace(db, name=f"page-ws-{i}", user_id=uid)
        page = ws_crud.list_workspaces(db, user_id=uid, skip=0, limit=2)
        assert len(page) == 2


class TestDeactivateWorkspace:
    def test_sets_is_active_false(self, db):
        ws = ws_crud.create_workspace(db, name="to-delete", user_id=_uid())
        ws_crud.deactivate_workspace(db, ws.id)
        db.refresh(ws)
        assert ws.is_active is False

    def test_deactivate_nonexistent_raises_404(self, db):
        with pytest.raises(AppError) as exc_info:
            ws_crud.deactivate_workspace(db, uuid4())
        assert exc_info.value.status_code == 404
