import json
import logging
import time
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.config import PLAN_LIMITS
from app.core.dependencies import get_db, get_request_id, get_runtime
from app.core.exceptions import AppError
from app.observability.models import ConversationEntry, TokenUsageEntry
from app.core.runtime import AppRuntime
from app.db.models import TokenUsage
from app.schemas.chat import ChatQueryRequest, ChatQueryResponse
from app.services.llm_service import (
    build_token_usage_data,
    generate_answer,
    generate_answer_stream,
)
from app.services.query_service import query_workspace

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)


def _check_quota(db: Session, user_id: str | None) -> None:
    """Raise 429 if user has exceeded their monthly query limit."""
    if not user_id:
        return
    from app.db.models import User
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return

    plan = user.plan or "free"
    if user.plan_expires_at and user.plan_expires_at < datetime.utcnow():
        plan = "free"

    monthly_limit = PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])["monthly_queries"]

    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    monthly_count = (
        db.query(TokenUsage)
        .filter(
            TokenUsage.user_id == user_id,
            TokenUsage.timestamp >= month_start,
        )
        .count()
    )

    if monthly_count >= monthly_limit:
        raise AppError(
            429,
            "monthly_quota_exceeded",
            f"Oylik so'rovlar limiti ({monthly_limit}) tugadi. "
            "Ko'proq so'rov uchun rejangizni yangilang.",
        )


def _serialize_sources(sources: list) -> list[dict]:
    return [source.model_dump(mode="json") for source in sources]


def _sse_payload(event_type: str, data) -> str:
    return f"data: {json.dumps({'type': event_type, 'data': data}, ensure_ascii=False)}\n\n"


@router.post("/query", response_model=ChatQueryResponse)
async def chat_query(
    payload: ChatQueryRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
    request_id: str = Depends(get_request_id),
) -> ChatQueryResponse:
    _check_quota(db, str(payload.user_id) if payload.user_id else None)
    started_at = time.perf_counter()
    retrieved_chunks = query_workspace(
        db,
        runtime.vector_store,
        runtime.settings,
        workspace_id=payload.workspace_id,
        question=payload.question,
        top_k=payload.top_k,
    )

    answer = None
    mode = "retrieval" if not retrieved_chunks else "rag"
    if retrieved_chunks:
        answer, usage = await generate_answer(
            payload.question,
            [chunk.text for chunk in retrieved_chunks],
            runtime.settings,
            history=payload.history,
            top_score=retrieved_chunks[0].score if retrieved_chunks else None,
        )
        runtime.observability.add_token_usage(
            TokenUsageEntry(
                request_id=request_id,
                workspace_id=str(payload.workspace_id),
                model=usage.model,
                prompt_tokens=usage.prompt_tokens,
                completion_tokens=usage.completion_tokens,
                total_tokens=usage.total_tokens,
                estimated_cost_usd=usage.estimated_cost_usd,
                latency_ms=usage.latency_ms,
                mode="rag",
                context_chunks_used=usage.context_chunks_used,
            )
        )
        try:
            db.add(
                TokenUsage(
                    request_id=request_id,
                    workspace_id=str(payload.workspace_id),
                    user_id=str(payload.user_id) if payload.user_id else None,
                    model=usage.model,
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens,
                    total_tokens=usage.total_tokens,
                    estimated_cost_usd=usage.estimated_cost_usd,
                    latency_ms=usage.latency_ms,
                    mode="rag",
                    context_chunks_used=usage.context_chunks_used,
                )
            )
            db.commit()
        except Exception:
            db.rollback()
            logger.exception("failed_to_persist_token_usage")
        runtime.observability.add_conversation(
            ConversationEntry(
                request_id=request_id,
                workspace_id=str(payload.workspace_id),
                question=payload.question,
                answer=answer,
                mode="rag",
                sources=[chunk.filename or str(chunk.document_id) for chunk in retrieved_chunks],
                top_score=retrieved_chunks[0].score if retrieved_chunks else None,
                history_turns=len(payload.history or []),
                latency_ms=usage.latency_ms,
            )
        )
    else:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 3)
        # Conversation logging is opt-in by default. In production, add a
        # user-consent flag and exclude PII per your privacy policy.
        # Under GDPR/PDPA: users must consent before conversation content is stored.
        runtime.observability.add_conversation(
            ConversationEntry(
                request_id=request_id,
                workspace_id=str(payload.workspace_id),
                question=payload.question,
                answer="",
                mode="retrieval",
                sources=[],
                top_score=None,
                history_turns=len(payload.history or []),
                latency_ms=duration_ms,
            )
        )

    return ChatQueryResponse(
        answer=answer,
        sources=retrieved_chunks,
        mode=mode,
    )


@router.post("", response_model=ChatQueryResponse)
async def chat_root(
    payload: ChatQueryRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
    request_id: str = Depends(get_request_id),
) -> ChatQueryResponse:
    return await chat_query(
        payload=payload,
        db=db,
        runtime=runtime,
        request_id=request_id,
    )


@router.post("/stream")
async def chat_stream(
    payload: ChatQueryRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
    request_id: str = Depends(get_request_id),
) -> StreamingResponse:
    _check_quota(db, str(payload.user_id) if payload.user_id else None)
    sources = query_workspace(
        db,
        runtime.vector_store,
        runtime.settings,
        workspace_id=payload.workspace_id,
        question=payload.question,
        top_k=payload.top_k,
    )
    serialized_sources = _serialize_sources(sources)

    async def event_stream():
        started_at = time.perf_counter()
        streamed_answer_parts: list[str] = []
        mode = "retrieval"
        try:
            yield _sse_payload("sources", serialized_sources)

            logger.info(
                "stream_check openai_key=%s sources=%d workspace=%s",
                "set" if runtime.settings.openai_api_key else "MISSING",
                len(sources),
                payload.workspace_id,
            )
            if not runtime.settings.openai_api_key or not sources:
                duration_ms = round((time.perf_counter() - started_at) * 1000, 3)
                runtime.observability.add_conversation(
                    ConversationEntry(
                        request_id=request_id,
                        workspace_id=str(payload.workspace_id),
                        question=payload.question,
                        answer=None,
                        mode="retrieval",
                        sources=[chunk.filename or str(chunk.document_id) for chunk in sources],
                        top_score=sources[0].score if sources else None,
                        history_turns=len(payload.history or []),
                        latency_ms=duration_ms,
                    )
                )
                yield _sse_payload("done", {"mode": "retrieval", "latency_ms": duration_ms})
                return

            mode = "rag"
            async for delta in generate_answer_stream(
                payload.question,
                [chunk.text for chunk in sources],
                runtime.settings,
                history=payload.history,
                top_score=sources[0].score if sources else None,
            ):
                streamed_answer_parts.append(delta)
                yield _sse_payload("delta", delta)

            duration_ms = round((time.perf_counter() - started_at) * 1000, 3)
            usage = build_token_usage_data(
                model=runtime.settings.chat_model,
                prompt_tokens=max(
                    1,
                    (
                        len(payload.question)
                        + sum(len(chunk.text) for chunk in sources)
                        + sum(len(str(item.get("content", ""))) for item in payload.history[-6:])
                    )
                    // 4,
                ),
                answer_text="".join(streamed_answer_parts),
                latency_ms=duration_ms,
                context_chunks_used=len(sources),
            )
            runtime.observability.add_token_usage(
                TokenUsageEntry(
                    request_id=request_id,
                    workspace_id=str(payload.workspace_id),
                    model=usage.model,
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens,
                    total_tokens=usage.total_tokens,
                    estimated_cost_usd=usage.estimated_cost_usd,
                    latency_ms=usage.latency_ms,
                    mode="rag",
                    context_chunks_used=usage.context_chunks_used,
                )
            )
            try:
                db.add(
                    TokenUsage(
                        request_id=request_id,
                        workspace_id=str(payload.workspace_id),
                        user_id=str(payload.user_id) if payload.user_id else None,
                        model=usage.model,
                        prompt_tokens=usage.prompt_tokens,
                        completion_tokens=usage.completion_tokens,
                        total_tokens=usage.total_tokens,
                        estimated_cost_usd=usage.estimated_cost_usd,
                        latency_ms=usage.latency_ms,
                        mode="rag",
                        context_chunks_used=usage.context_chunks_used,
                    )
                )
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("failed_to_persist_stream_token_usage")
            # Conversation logging is opt-in by default. In production, add a
            # user-consent flag and exclude PII per your privacy policy.
            # Under GDPR/PDPA: users must consent before conversation content is stored.
            runtime.observability.add_conversation(
                ConversationEntry(
                    request_id=request_id,
                    workspace_id=str(payload.workspace_id),
                    question=payload.question,
                    answer="".join(streamed_answer_parts),
                    mode=mode,
                    sources=[chunk.filename or str(chunk.document_id) for chunk in sources],
                    top_score=sources[0].score if sources else None,
                    history_turns=len(payload.history or []),
                    latency_ms=duration_ms,
                )
            )
            yield _sse_payload("done", {"mode": "rag", "latency_ms": duration_ms})
        except AppError as exc:
            yield _sse_payload("error", exc.message)
        except Exception as exc:
            yield _sse_payload("error", str(exc))

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
