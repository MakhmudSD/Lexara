"""Workspace-scoped research agent endpoint."""

from __future__ import annotations

import logging
import time
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db.models import OrganizationMember, TokenUsage, User, Workspace
from app.observability.models import TokenUsageEntry

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

    started_at = time.perf_counter()
    result = await run_research_loop(
        topic=request.topic,
        workspace_id=request.workspace_id,
        db=db,
        settings=runtime.settings,
        include_web=request.include_web,
    )
    latency_ms = round((time.perf_counter() - started_at) * 1000, 3)

    report_text = result.get("report", "")
    plan_text = str(result.get("plan", ""))
    estimated_prompt_tokens = max(1, (len(plan_text) + len(report_text)) // 4)
    estimated_completion_tokens = max(0, len(report_text) // 4)
    estimated_total = estimated_prompt_tokens + estimated_completion_tokens
    estimated_cost = round(estimated_total * 0.00000015, 6)

    request_id = str(uuid4())
    uid = str(current_user.id)
    runtime.observability.add_token_usage(
        TokenUsageEntry(
            request_id=request_id,
            workspace_id=str(request.workspace_id),
            model="gpt-4o-mini",
            prompt_tokens=estimated_prompt_tokens,
            completion_tokens=estimated_completion_tokens,
            total_tokens=estimated_total,
            estimated_cost_usd=estimated_cost,
            latency_ms=latency_ms,
            mode="research",
            context_chunks_used=0,
        )
    )
    try:
        db.add(
            TokenUsage(
                request_id=request_id,
                workspace_id=str(request.workspace_id),
                user_id=uid,
                model="gpt-4o-mini",
                prompt_tokens=estimated_prompt_tokens,
                completion_tokens=estimated_completion_tokens,
                total_tokens=estimated_total,
                estimated_cost_usd=estimated_cost,
                latency_ms=latency_ms,
                mode="research",
                context_chunks_used=0,
            )
        )
        current_user.request_count = (current_user.request_count or 0) + 1
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("failed_to_persist_research_token_usage")

    return ResearchResponse(**result)
