"""Workspace-scoped research agent endpoint."""

from __future__ import annotations

import logging
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db.models import OrganizationMember, User, Workspace

router = APIRouter(prefix="/research", tags=["research"])
logger = logging.getLogger(__name__)


class ResearchRequest(BaseModel):
    topic: str = Field(..., min_length=3, max_length=1000)
    workspace_id: UUID
    include_web: bool = True


class ResearchResponse(BaseModel):
    plan: str
    searches: list[dict]
    reflection: str
    report: str


@router.post("", response_model=ResearchResponse)
async def run_research(
    request: ResearchRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
    current_user: User = Depends(get_current_user),
) -> ResearchResponse:
    """Run the Plan → Research → Reflect → Write loop for a workspace-scoped topic."""
    ws = db.query(Workspace).filter(Workspace.id == request.workspace_id).first()
    if ws is None:
        raise AppError(404, "workspace_not_found", "Workspace not found.")
    if ws.organization_id is not None:
        member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == ws.organization_id,
            OrganizationMember.user_id == current_user.id,
        ).first()
        if member is None:
            raise AppError(403, "forbidden", "You do not have access to this workspace.")

    if not runtime.settings.openai_api_key:
        raise AppError(503, "openai_not_configured", "OpenAI API key is not configured.")

    from app.services.research_agent.loop import run_research_loop

    result = await run_research_loop(
        topic=request.topic,
        workspace_id=request.workspace_id,
        db=db,
        settings=runtime.settings,
        include_web=request.include_web,
    )
    return ResearchResponse(**result)
