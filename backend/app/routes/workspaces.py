from uuid import UUID
import random

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.core.exceptions import AppError
from app.crud import workspace as workspace_crud
from app.db.models import Organization
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceListResponse,
    WorkspaceQuickCreate,
    WorkspaceRename,
    WorkspaceResponse,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])

ADJECTIVES = ["swift", "clear", "smart", "deep", "bright", "sharp", "calm", "nova", "keen", "bold", "pure", "lean", "vast", "prime"]
NOUNS = ["vault", "lens", "deck", "lab", "desk", "hub", "base", "core", "flow", "mind", "grid", "arc", "beam", "node"]


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


@router.post("/quick", response_model=WorkspaceResponse, status_code=201)
def quick_create_workspace(
    payload: WorkspaceQuickCreate,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> WorkspaceResponse:
    """
    Create a workspace without needing an organization_id.
    Looks up (or creates) a default dev organization and attaches the
    workspace to it.  Intended for MVP / local dev use — Phase 3 auth
    will replace this with user-scoped org resolution.
    """
    # Find or create a default org so the frontend never needs to manage org IDs
    org = db.query(Organization).filter(Organization.is_active.is_(True)).first()
    if org is None:
        from uuid import uuid4
        # Get the real user ID from the auth token
        user_id = uuid4()  # fallback
        if authorization and authorization.startswith("Bearer "):
            try:
                settings = get_settings()
                claims = decode_access_token(authorization.split(" ", 1)[1], settings)
                from uuid import UUID as _UUID
                user_id = _UUID(claims["sub"])
            except Exception:
                pass
        org = Organization(
            id=uuid4(),
            name="Default Organization",
            slug="default",
            owner_id=user_id,
            is_active=True,
        )
        db.add(org)
        db.commit()
        db.refresh(org)

    requested_name = (payload.name or "").strip()
    workspace_name = _friendly_name() if not requested_name or requested_name == "My Workspace" else requested_name

    workspace = workspace_crud.create_workspace(
        db,
        organization_id=org.id,
        name=workspace_name,
    )
    return WorkspaceResponse.model_validate(workspace)


@router.patch("/{workspace_id}/name", response_model=WorkspaceResponse)
def rename_workspace(
    workspace_id: UUID,
    payload: WorkspaceRename,
    db: Session = Depends(get_db),
) -> WorkspaceResponse:
    workspace = workspace_crud.get_workspace_or_404(db, workspace_id)
    workspace.name = _validate_workspace_name(payload.name)
    db.commit()
    db.refresh(workspace)
    return WorkspaceResponse.model_validate(workspace)


@router.post("", response_model=WorkspaceResponse, status_code=201)
def create_workspace(
    payload: WorkspaceCreate,
    db: Session = Depends(get_db),
) -> WorkspaceResponse:
    workspace = workspace_crud.create_workspace(
        db,
        organization_id=payload.organization_id,
        name=payload.name,
    )
    return WorkspaceResponse.model_validate(workspace)


@router.get("", response_model=WorkspaceListResponse)
def list_workspaces(
    organization_id: UUID | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    db: Session = Depends(get_db),
) -> WorkspaceListResponse:
    workspaces = workspace_crud.list_workspaces(
        db,
        organization_id=organization_id,
        skip=skip,
        limit=limit,
    )
    return WorkspaceListResponse(
        workspaces=[WorkspaceResponse.model_validate(item) for item in workspaces],
        total=len(workspaces),
    )
