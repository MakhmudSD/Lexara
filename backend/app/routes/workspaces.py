from uuid import UUID
import random

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.dependencies import get_db
from app.core.entitlements import plan_limit
from app.core.exceptions import AppError
from app.crud import workspace as workspace_crud
from app.crud.organization import get_org_by_slug
from app.db.models import OrganizationMember, User, UserWorkspace, Workspace
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceListResponse,
    WorkspaceQuickCreate,
    WorkspaceRename,
    WorkspaceResponse,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])
org_workspace_router = APIRouter(prefix="/orgs/{org_slug}/workspaces", tags=["workspaces"])

ADJECTIVES = ["swift", "clear", "smart", "deep", "bright", "sharp", "calm", "nova", "keen", "bold", "pure", "lean", "vast", "prime"]
NOUNS = ["vault", "lens", "deck", "lab", "desk", "hub", "base", "core", "flow", "mind", "grid", "arc", "beam", "node"]


class WorkspaceNamePayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)


def _friendly_name() -> str:
    return f"{random.choice(ADJECTIVES)}-{random.choice(NOUNS)}-{random.randint(100, 999)}"


def _validate_workspace_name(name: str) -> str:
    forbidden = set('<>:"/\\|?*')
    normalized = name.strip()
    if len(normalized) < 2 or len(normalized) > 40:
        raise AppError(400, "invalid_workspace_name", "Workspace name must be between 2 and 40 characters.")
    if any(character in forbidden for character in normalized):
        raise AppError(400, "invalid_workspace_name", "Workspace name contains invalid characters.")
    return normalized


def _resolve_org(org_slug: str, db: Session) -> UUID:
    org = get_org_by_slug(db, slug=org_slug)
    if org is None:
        raise HTTPException(status_code=404, detail=f"Organization '{org_slug}' not found.")
    return org.id


def _assert_org_membership(organization_id, user: User, db: Session) -> None:
    """Raise 403 if user is not a member of the given organization."""
    if organization_id is None:
        return
    from uuid import UUID
    org_id = organization_id if isinstance(organization_id, UUID) else UUID(str(organization_id))
    member = db.query(OrganizationMember).filter(
        OrganizationMember.organization_id == org_id,
        OrganizationMember.user_id == user.id,
    ).first()
    if member is None:
        raise AppError(403, "forbidden", "You are not a member of this organization.")


def _assert_workspace_access(workspace_id, user: User, db: Session) -> None:
    """Raise 403/404 if user cannot access the given workspace.

    Opt-out: access is denied unless the user is a direct workspace member
    (UserWorkspace row) OR a member of the workspace's organization.
    """
    from uuid import UUID
    ws_id = workspace_id if isinstance(workspace_id, UUID) else UUID(str(workspace_id))
    ws = db.query(Workspace).filter(Workspace.id == ws_id).first()
    if ws is None:
        raise AppError(404, "workspace_not_found", "Workspace not found.")

    uw = db.query(UserWorkspace).filter(
        UserWorkspace.workspace_id == ws_id,
        UserWorkspace.user_id == user.id,
    ).first()
    if uw is not None:
        return

    if ws.organization_id is not None:
        _assert_org_membership(ws.organization_id, user, db)
        return

    raise AppError(403, "forbidden", "You do not have access to this workspace.")


@router.post("/quick", response_model=WorkspaceResponse, status_code=201)
def quick_create_workspace(
    payload: WorkspaceQuickCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceResponse:
    """
    Create a workspace without needing an organization_id.
    Looks up (or creates) a default dev organization and attaches the
    workspace to it.  Intended for MVP / local dev use — Phase 3 auth
    will replace this with user-scoped org resolution.
    """
    requested_name = (payload.name or "").strip()
    workspace_name = _friendly_name() if not requested_name or requested_name == "My Workspace" else requested_name

    # enforce plan workspace limit
    existing_count = workspace_crud.count_billable_workspaces(db, current_user.id)
    max_ws = plan_limit(current_user, "max_workspaces")
    if existing_count >= max_ws:
        raise AppError(
            403,
            "workspace_limit_reached",
            f"Your plan allows {max_ws} workspace(s). Upgrade to create more.",
        )

    workspace = workspace_crud.create_workspace(
        db,
        name=workspace_name,
        user_id=current_user.id,
        organization_id=None,
    )
    return WorkspaceResponse.model_validate(workspace)


@router.patch("/{workspace_id}/name", response_model=WorkspaceResponse)
def rename_workspace(
    workspace_id: UUID = Path(...),
    payload: WorkspaceRename = ...,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceResponse:
    _assert_workspace_access(workspace_id, current_user, db)
    workspace = workspace_crud.get_workspace_or_404(db, workspace_id)
    workspace.name = _validate_workspace_name(payload.name)
    db.commit()
    db.refresh(workspace)
    return WorkspaceResponse.model_validate(workspace)


@router.delete("/{workspace_id}", status_code=204)
def delete_workspace(
    workspace_id: UUID = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Soft-delete a workspace (sets is_active = False).
    Returns 204 No Content on success.
    The workspace no longer appears in list_workspaces or accepts queries.
    """
    _assert_workspace_access(workspace_id, current_user, db)
    workspace_crud.deactivate_workspace(db, workspace_id)


@router.post("", response_model=WorkspaceResponse, status_code=201)
def create_workspace(
    payload: WorkspaceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceResponse:
    _assert_org_membership(payload.organization_id, current_user, db)
    # enforce plan workspace limit
    existing_count = workspace_crud.count_billable_workspaces(db, current_user.id)
    max_ws = plan_limit(current_user, "max_workspaces")
    if existing_count >= max_ws:
        raise AppError(
            403,
            "workspace_limit_reached",
            f"Your plan allows {max_ws} workspace(s). Upgrade to create more.",
        )
    workspace = workspace_crud.create_workspace(
        db,
        name=payload.name,
        user_id=current_user.id,
        organization_id=payload.organization_id,
    )
    return WorkspaceResponse.model_validate(workspace)


@router.get("", response_model=WorkspaceListResponse)
def list_workspaces(
    organization_id: UUID | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceListResponse:
    if organization_id is not None:
        _assert_org_membership(organization_id, current_user, db)
    workspaces = workspace_crud.list_workspaces(
        db,
        user_id=current_user.id,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
    )
    return WorkspaceListResponse(
        workspaces=[WorkspaceResponse.model_validate(item) for item in workspaces],
        total=len(workspaces),
    )


@org_workspace_router.get("", response_model=WorkspaceListResponse)
def list_org_workspaces(
    org_slug: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceListResponse:
    org_id = _resolve_org(org_slug, db)
    _assert_org_membership(org_id, current_user, db)
    workspaces = workspace_crud.list_workspaces(db, user_id=current_user.id, organization_id=org_id)
    return WorkspaceListResponse(
        workspaces=[WorkspaceResponse.model_validate(workspace) for workspace in workspaces],
        total=len(workspaces),
    )


@org_workspace_router.post("", response_model=WorkspaceResponse, status_code=201)
def create_org_workspace(
    body: WorkspaceNamePayload,
    org_slug: str = Path(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> WorkspaceResponse:
    org_id = _resolve_org(org_slug, db)
    _assert_org_membership(org_id, current_user, db)
    # enforce plan workspace limit
    existing_count = workspace_crud.count_billable_workspaces(db, current_user.id)
    max_ws = plan_limit(current_user, "max_workspaces")
    if existing_count >= max_ws:
        raise AppError(
            403,
            "workspace_limit_reached",
            f"Your plan allows {max_ws} workspace(s). Upgrade to create more.",
        )
    workspace = workspace_crud.create_workspace(
        db,
        name=body.name,
        user_id=current_user.id,
        organization_id=org_id,
    )
    return WorkspaceResponse.model_validate(workspace)
