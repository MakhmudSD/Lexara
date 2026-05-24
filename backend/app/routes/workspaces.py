from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_db
from app.crud import workspace as workspace_crud
from app.schemas.workspace import (
    WorkspaceCreate,
    WorkspaceListResponse,
    WorkspaceResponse,
)

router = APIRouter(prefix="/workspaces", tags=["workspaces"])


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
