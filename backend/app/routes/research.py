"""Workspace-scoped research agent endpoint."""

from __future__ import annotations

import json
import logging
import time
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
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


def _sse(phase: str, **kwargs) -> str:
    return f"data: {json.dumps({'phase': phase, **kwargs}, ensure_ascii=False)}\n\n"


def _log_token_usage(
    db: Session,
    runtime: AppRuntime,
    uid: str,
    workspace_id: UUID,
    plan_text: str,
    report_text: str,
    latency_ms: float,
) -> None:
    estimated_prompt_tokens = max(1, (len(plan_text) + len(report_text)) // 4)
    estimated_completion_tokens = max(0, len(report_text) // 4)
    estimated_total = estimated_prompt_tokens + estimated_completion_tokens
    estimated_cost = round(estimated_total * 0.00000015, 6)
    request_id = str(uuid4())
    runtime.observability.add_token_usage(
        TokenUsageEntry(
            request_id=request_id,
            workspace_id=str(workspace_id),
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
                workspace_id=str(workspace_id),
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
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("failed_to_persist_research_stream_token_usage")


@router.post("/stream")
async def run_research_stream(
    request: ResearchRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Streaming research that emits SSE phase events as the loop progresses."""
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

    uid = str(current_user.id)

    async def generate():
        from openai import AsyncOpenAI
        from app.services.research_agent.loop import (
            _PLAN_PROMPT, _REFLECT_PROMPT, _REPORT_PROMPT,
        )
        from app.services.research_agent.tools import search_workspace_documents, search_web

        client = AsyncOpenAI(api_key=runtime.settings.openai_api_key)
        started_at = time.perf_counter()

        try:
            # Phase 1: Plan
            yield _sse("planning", message="Creating research plan…")
            plan_resp = await client.chat.completions.create(
                model=runtime.settings.chat_model,
                messages=[{"role": "user", "content": _PLAN_PROMPT.format(topic=request.topic)}],
                temperature=0.3,
            )
            plan_raw = plan_resp.choices[0].message.content or "{}"
            try:
                plan_data = json.loads(plan_raw)
            except json.JSONDecodeError:
                plan_data = {"plan": plan_raw, "queries": [request.topic]}

            plan_text: str = plan_data.get("plan", "")
            queries: list[str] = plan_data.get("queries", [request.topic])
            yield _sse("plan_complete", plan=plan_text, queries=queries)

            # Phase 2: Research
            yield _sse("researching", message="Searching documents and web…")
            all_chunks: list[dict] = []
            search_log: list[dict] = []
            seen: set[str] = set()

            for query in queries[:5]:
                doc_results = search_workspace_documents(db, request.workspace_id, query, runtime.settings)
                web_results = search_web(query, runtime.settings.tavily_api_key) if request.include_web else []
                all_chunks.extend(doc_results)
                all_chunks.extend(web_results)
                search_log.append({"query": query, "doc_hits": len(doc_results), "web_hits": len(web_results)})

            unique_chunks: list[dict] = []
            for c in all_chunks:
                key = (c.get("text") or c.get("content") or "")[:120]
                if key and key not in seen:
                    seen.add(key)
                    unique_chunks.append(c)

            yield _sse("searches_complete", searches=search_log)

            # Phase 3: Reflect
            yield _sse("reflecting", message="Checking research quality…")
            evidence_summary = "\n".join(
                f"- {c.get('filename') or c.get('url', 'web')}: {(c.get('text') or c.get('content', ''))[:200]}"
                for c in unique_chunks[:20]
            )
            reflect_resp = await client.chat.completions.create(
                model=runtime.settings.chat_model,
                messages=[{"role": "user", "content": _REFLECT_PROMPT.format(evidence_summary=evidence_summary or "(no evidence found)")}],
                temperature=0.3,
            )
            reflect_raw = reflect_resp.choices[0].message.content or "{}"
            try:
                reflect_data = json.loads(reflect_raw)
            except json.JSONDecodeError:
                reflect_data = {"reflection": reflect_raw, "follow_up_queries": []}

            reflection: str = reflect_data.get("reflection", "")
            follow_ups: list[str] = reflect_data.get("follow_up_queries", [])

            for query in follow_ups[:2]:
                doc_results = search_workspace_documents(db, request.workspace_id, query, runtime.settings)
                web_results = search_web(query, runtime.settings.tavily_api_key) if request.include_web else []
                for c in doc_results + web_results:
                    key = (c.get("text") or c.get("content") or "")[:120]
                    if key and key not in seen:
                        seen.add(key)
                        unique_chunks.append(c)

            yield _sse("reflect_complete", reflection=reflection)

            # Phase 4: Write
            yield _sse("writing", message="Writing final report…")
            evidence_str = "\n\n".join(
                f"Source: {c.get('filename') or c.get('url', 'web')}\n{c.get('text') or c.get('content', '')}"
                for c in unique_chunks[:15]
            )
            report_resp = await client.chat.completions.create(
                model=runtime.settings.chat_model,
                messages=[{"role": "user", "content": _REPORT_PROMPT.format(topic=request.topic, evidence=evidence_str or "(no evidence found)")}],
                temperature=0.4,
                max_tokens=1500,
            )
            report: str = report_resp.choices[0].message.content or ""

            latency_ms = round((time.perf_counter() - started_at) * 1000, 3)
            _log_token_usage(db, runtime, uid, request.workspace_id, plan_text, report, latency_ms)
            current_user.request_count = (current_user.request_count or 0) + 1
            try:
                db.commit()
            except Exception:
                db.rollback()

            yield _sse("complete", result={
                "plan": plan_text,
                "searches": search_log,
                "reflection": reflection,
                "report": report,
            })

        except Exception as exc:
            logger.exception("research_stream_error")
            yield _sse("error", message=str(exc))

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
