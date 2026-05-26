from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class WorkspaceQuickCreate(BaseModel):
    """Used by POST /workspaces/quick — no org required from the caller."""
    name: str = Field(default="", max_length=255)


class WorkspaceCreate(BaseModel):
    organization_id: UUID
    name: str = Field(..., min_length=1, max_length=255)


class WorkspaceRename(BaseModel):
    name: str = Field(..., min_length=2, max_length=40)


class WorkspaceResponse(BaseModel):
    id: UUID
    organization_id: UUID
    name: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class WorkspaceListResponse(BaseModel):
    workspaces: list[WorkspaceResponse]
    total: int
