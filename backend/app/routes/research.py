"""Workspace-scoped research agent endpoint."""

from __future__ import annotations

import json
import logging
import time
from datetime import datetime
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.dependencies import get_db, get_runtime
from app.core.entitlements import plan_limit, require_feature
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db.models import TokenUsage, User
from app.observability.models import TokenUsageEntry
from app.routes.workspaces import _assert_workspace_access
from app.services.research_agent.loop import _PLAN_PROMPT, _REFLECT_PROMPT, _REPORT_PROMPT

router = APIRouter(prefix="/research", tags=["research"])
logger = logging.getLogger(__name__)


def _check_research_quota(db: Session, user: User) -> None:
    """Raise 429 if user has exceeded their monthly research-run sub-quota."""
    limit = plan_limit(user, "monthly_research_runs")

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    run_count = (
        db.query(TokenUsage)
        .filter(
            TokenUsage.user_id == str(user.id),
            TokenUsage.timestamp >= month_start,
            TokenUsage.mode.in_(["research", "research_stream"]),
        )
        .count()
    )

    if run_count >= limit:
        raise AppError(
            429,
            "research_quota_exceeded",
            f"Monthly research limit ({limit}) reached. Upgrade for more.",
        )


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
    _assert_workspace_access(request.workspace_id, current_user, db)

    require_feature(current_user, "research")
    _check_research_quota(db, current_user)

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


@router.post("/stream")
async def run_research_stream(
    request: ResearchRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """SSE streaming research — all DB work done before the generator starts."""
    _assert_workspace_access(request.workspace_id, current_user, db)

    require_feature(current_user, "research")
    _check_research_quota(db, current_user)

    if not runtime.settings.openai_api_key:
        raise AppError(503, "openai_not_configured", "OpenAI API key is not configured.")

    user_id = str(current_user.id)
    workspace_id_str = str(request.workspace_id)
    workspace_id_uuid = request.workspace_id
    openai_key = runtime.settings.openai_api_key
    tavily_key = runtime.settings.tavily_api_key or ""
    chat_model = runtime.settings.chat_model
    topic = request.topic
    include_web = request.include_web
    db.close()

    async def generate():
        from openai import AsyncOpenAI
        from app.services.research_agent.tools import search_workspace_documents_fresh, search_web
        from app.services.llm_service import RESEARCH_SYSTEM_PROMPT

        client = AsyncOpenAI(api_key=openai_key)

        def sse(phase: str, **kwargs) -> str:
            return f"data: {json.dumps({'phase': phase, **kwargs}, ensure_ascii=False)}\n\n"

        try:
            yield sse("planning", message="Creating research plan…")

            plan_resp = await client.chat.completions.create(
                model=chat_model,
                messages=[{"role": "user", "content": _PLAN_PROMPT.format(topic=topic)}],
                temperature=0.3,
            )
            plan_raw = plan_resp.choices[0].message.content or "{}"
            try:
                plan_data = json.loads(plan_raw)
            except json.JSONDecodeError:
                plan_data = {"plan": plan_raw, "queries": [topic]}

            queries = plan_data.get("queries", [topic])
            yield sse("plan_complete", plan=plan_data.get("plan", ""))

            yield sse("researching", message="Searching documents and web…")
            all_chunks: list[dict] = []
            search_log: list[dict] = []
            seen: set[str] = set()

            for query in queries[:5]:
                doc_results = search_workspace_documents_fresh(workspace_id_uuid, query)
                web_results = search_web(query, tavily_key) if include_web else []
                all_chunks.extend(doc_results)
                all_chunks.extend(web_results)
                search_log.append({
                    "query": query,
                    "doc_hits": len(doc_results),
                    "web_hits": len(web_results),
                })

            unique_chunks: list[dict] = []
            for c in all_chunks:
                key = (c.get("text") or c.get("content") or "")[:120]
                if key and key not in seen:
                    seen.add(key)
                    unique_chunks.append(c)

            yield sse("searches_complete", searches=search_log)

            evidence_summary = "\n".join(
                f"- {c.get('filename') or c.get('url', 'web')}: {(c.get('text') or c.get('content', ''))[:200]}"
                for c in unique_chunks[:20]
            )

            yield sse("reflecting", message="Checking research quality…")
            reflect_resp = await client.chat.completions.create(
                model=chat_model,
                messages=[{"role": "user", "content": _REFLECT_PROMPT.format(
                    evidence_summary=evidence_summary or "(no evidence found)"
                )}],
                temperature=0.3,
            )
            reflect_raw = reflect_resp.choices[0].message.content or "{}"
            try:
                reflect_data = json.loads(reflect_raw)
            except json.JSONDecodeError:
                reflect_data = {"reflection": reflect_raw, "follow_up_queries": []}

            reflection: str = reflect_data.get("reflection", "")
            follow_ups: list[str] = reflect_data.get("follow_up_queries", [])
            verdict = "revise" if any(
                w in reflection.lower()
                for w in ["gap", "missing", "insufficient", "limited"]
            ) else "pass"

            for query in follow_ups[:2]:
                doc_results = search_workspace_documents_fresh(workspace_id_uuid, query)
                web_results = search_web(query, tavily_key) if include_web else []
                for c in doc_results + web_results:
                    key = (c.get("text") or c.get("content") or "")[:120]
                    if key and key not in seen:
                        seen.add(key)
                        unique_chunks.append(c)

            yield sse("reflect_complete", verdict=verdict)

            yield sse("writing", message="Writing final report…")
            evidence_str = "\n\n".join(
                f"Source: {c.get('filename') or c.get('url', 'web')}\n{c.get('text') or c.get('content', '')}"
                for c in unique_chunks[:15]
            )
            report_resp = await client.chat.completions.create(
                model=chat_model,
                messages=[
                    {"role": "system", "content": RESEARCH_SYSTEM_PROMPT},
                    {"role": "user", "content": _REPORT_PROMPT.format(
                        topic=topic,
                        evidence=evidence_str or "(no evidence found)",
                    )},
                ],
                temperature=0.4,
                max_tokens=1500,
            )
            report: str = report_resp.choices[0].message.content or ""

            try:
                from app.db import SessionLocal
                fresh_db = SessionLocal()
                try:
                    estimated_prompt = max(1, (len(str(plan_data)) + len(evidence_str)) // 4)
                    estimated_completion = max(0, len(report) // 4)
                    estimated_total = estimated_prompt + estimated_completion
                    fresh_db.add(TokenUsage(
                        request_id=str(uuid4()),
                        workspace_id=workspace_id_str,
                        user_id=user_id,
                        model=chat_model,
                        prompt_tokens=estimated_prompt,
                        completion_tokens=estimated_completion,
                        total_tokens=estimated_total,
                        estimated_cost_usd=round(estimated_total * 0.00000015, 6),
                        latency_ms=0,
                        mode="research_stream",
                        context_chunks_used=0,
                    ))
                    u = fresh_db.query(User).filter(User.id == user_id).first()
                    if u:
                        u.request_count = (u.request_count or 0) + 1
                    fresh_db.commit()
                except Exception:
                    fresh_db.rollback()
                finally:
                    fresh_db.close()
            except Exception:
                pass  # token logging must never break the stream

            yield sse("complete", result={
                "plan": plan_data.get("plan", ""),
                "searches": search_log,
                "reflection_verdict": verdict,
                "reflection_missing": follow_ups,
                "report": report,
            })

        except AppError as exc:
            logger.warning("research_app_error: %s", exc.code)
            yield sse("error", code=exc.code, message=exc.message)
        except Exception as exc:
            logger.exception("research_stream_error")
            yield sse("error", code="internal_error", message=str(exc))

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )
