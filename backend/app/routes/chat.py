import json
import logging
import time
from datetime import datetime

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.entitlements import effective_plan, plan_limit
from app.core.dependencies import get_db, get_request_id, get_runtime
from app.core.exceptions import AppError
from app.observability.models import ConversationEntry, TokenUsageEntry
from app.db.models import Organization, TokenUsage, User, Workspace
from app.schemas.chat import ChatQueryRequest, ChatQueryResponse
from app.services.llm_service import (
    LEGAL_SYSTEM_PROMPT,
    build_token_usage_data,
    generate_answer,
    generate_answer_stream,
)
from app.services.query_service import query_workspace

router = APIRouter(prefix="/chat", tags=["chat"])
logger = logging.getLogger(__name__)

LEGAL_SYSTEM_PREFIX = (
    "You are a legal research assistant. Answer questions based strictly on the "
    "provided statute excerpts. Always cite the specific article number (e.g., "
    "Article 15, Paragraph 2). Never speculate beyond the provided text. If the "
    "article is not in the provided excerpts, say so clearly."
)


def _is_legal_workspace(db: Session, workspace_id) -> bool:
    """Returns True if workspace belongs to the Lexara Legal org. Uses LEXARA_LEGAL_ORG_ID env var if set; falls back to case-insensitive name check."""
    import os
    ws = db.query(Workspace).filter(Workspace.id == workspace_id).first()
    if not ws or not ws.organization_id:
        return False
    org = db.query(Organization).filter(Organization.id == ws.organization_id).first()
    if org is None:
        return False
    legal_org_id = os.getenv("LEXARA_LEGAL_ORG_ID", "")
    if legal_org_id:
        return str(org.id) == legal_org_id
    return "legal" in org.name.lower()


def _check_quota(db: Session, user_id: str | None) -> "User | None":
    """Raise 429 if user has exceeded their monthly query limit. Returns the loaded user."""
    if not user_id:
        return None
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        return None

    plan = effective_plan(user)

    monthly_limit = plan_limit(user, "monthly_queries")

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
    return user


def _check_legal_quota(db: Session, user_id: str, user: User) -> None:
    """Raise 429 for Free users who exceed 5 legal queries/month."""
    if effective_plan(user) != "free":
        return  # only Free users have a separate legal cap
    limit = 5
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    legal_count = (
        db.query(TokenUsage)
        .filter(
            TokenUsage.user_id == user_id,
            TokenUsage.timestamp >= month_start,
            TokenUsage.mode == "legal",
        )
        .count()
    )
    if legal_count >= limit:
        raise AppError(
            429,
            "legal_quota_exceeded",
            f"Free plan allows {limit} legal queries/month. Upgrade for unlimited access.",
        )


def _serialize_sources(sources: list) -> list[dict]:
    return [source.model_dump(mode="json") for source in sources]


def _sse_payload(event_type: str, data) -> str:
    return f"data: {json.dumps({'type': event_type, 'data': data}, ensure_ascii=False)}\n\n"


@router.post("/query", response_model=ChatQueryResponse)
async def chat_query(
    payload: ChatQueryRequest,
    db: Session = Depends(get_db),
    runtime = Depends(get_runtime),
    request_id: str = Depends(get_request_id),
    current_user: User = Depends(get_current_user),
) -> ChatQueryResponse:
    uid = str(current_user.id)
    quota_user = _check_quota(db, uid)
    started_at = time.perf_counter()
    retrieved_chunks = query_workspace(
        db,
        runtime.settings,
        workspace_id=payload.workspace_id,
        question=payload.question,
        top_k=payload.top_k,
    )
    is_legal = _is_legal_workspace(db, payload.workspace_id)
    if is_legal:
        _check_legal_quota(db, uid, quota_user or current_user)
    context_texts = [chunk.text for chunk in retrieved_chunks]

    answer = None
    mode = "retrieval" if not retrieved_chunks else "rag"
    if retrieved_chunks:
        answer, usage = await generate_answer(
            payload.question,
            [f"[Excerpt {i+1}]\n{text}" for i, text in enumerate(context_texts)],
            runtime.settings,
            history=payload.history,
            top_score=retrieved_chunks[0].score if retrieved_chunks else None,
            system_prompt_override=LEGAL_SYSTEM_PROMPT if is_legal else None,
        )
        query_mode = "legal" if is_legal else "rag"
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
                mode=query_mode,
                context_chunks_used=usage.context_chunks_used,
            )
        )
        try:
            db.add(
                TokenUsage(
                    request_id=request_id,
                    workspace_id=str(payload.workspace_id),
                    user_id=uid,
                    model=usage.model,
                    prompt_tokens=usage.prompt_tokens,
                    completion_tokens=usage.completion_tokens,
                    total_tokens=usage.total_tokens,
                    estimated_cost_usd=usage.estimated_cost_usd,
                    latency_ms=usage.latency_ms,
                    mode=query_mode,
                    context_chunks_used=usage.context_chunks_used,
                )
            )
            if quota_user:
                quota_user.request_count = (quota_user.request_count or 0) + 1
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
                mode=query_mode,
                sources=[chunk.filename or str(chunk.document_id) for chunk in retrieved_chunks],
                top_score=retrieved_chunks[0].score if retrieved_chunks else None,
                history_turns=len(payload.history or []),
                latency_ms=usage.latency_ms,
            )
        )
    else:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 3)
        if quota_user:
            try:
                quota_user.request_count = (quota_user.request_count or 0) + 1
                db.commit()
            except Exception:
                db.rollback()
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
    runtime = Depends(get_runtime),
    request_id: str = Depends(get_request_id),
    current_user: User = Depends(get_current_user),
) -> ChatQueryResponse:
    return await chat_query(
        payload=payload,
        db=db,
        runtime=runtime,
        request_id=request_id,
        current_user=current_user,
    )


@router.post("/stream")
async def chat_stream(
    payload: ChatQueryRequest,
    db: Session = Depends(get_db),
    runtime = Depends(get_runtime),
    request_id: str = Depends(get_request_id),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    uid = str(current_user.id)
    quota_user = _check_quota(db, uid)
    sources = query_workspace(
        db,
        runtime.settings,
        workspace_id=payload.workspace_id,
        question=payload.question,
        top_k=payload.top_k,
    )
    is_legal = _is_legal_workspace(db, payload.workspace_id)
    if is_legal:
        _check_legal_quota(db, uid, quota_user or current_user)
    stream_context_texts = [chunk.text for chunk in sources]
    serialized_sources = _serialize_sources(sources)
    stream_mode = "legal" if is_legal else "rag"

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
                [f"[Excerpt {i+1}]\n{text}" for i, text in enumerate(stream_context_texts)],
                runtime.settings,
                history=payload.history,
                top_score=sources[0].score if sources else None,
                system_prompt_override=LEGAL_SYSTEM_PROMPT if is_legal else None,
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
                    mode=stream_mode,
                    context_chunks_used=usage.context_chunks_used,
                )
            )
            try:
                db.add(
                    TokenUsage(
                        request_id=request_id,
                        workspace_id=str(payload.workspace_id),
                        user_id=uid,
                        model=usage.model,
                        prompt_tokens=usage.prompt_tokens,
                        completion_tokens=usage.completion_tokens,
                        total_tokens=usage.total_tokens,
                        estimated_cost_usd=usage.estimated_cost_usd,
                        latency_ms=usage.latency_ms,
                        mode=stream_mode,
                        context_chunks_used=usage.context_chunks_used,
                    )
                )
                if quota_user:
                    quota_user.request_count = (quota_user.request_count or 0) + 1
                db.commit()
            except Exception:
                db.rollback()
                logger.exception("failed_to_persist_stream_token_usage")
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
            yield _sse_payload("done", {"mode": stream_mode, "latency_ms": duration_ms})
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
