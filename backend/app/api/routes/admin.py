from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, Response
from sqlalchemy.orm import Session

from app.api.schemas.admin import (
    AdminDocumentResponse,
    ConversationResponse,
    HealthResponse,
    LogEntryResponse,
    RequestHistoryResponse,
    RetrievalHistoryResponse,
    TokenSummaryResponse,
    TokenUsageResponse,
    UserAdminResponse,
    UserRoleUpdate,
    UserStatusUpdate,
)
from app.core.auth import require_admin
from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db.models import TokenUsage, User
from app.services.admin_service import (
    get_documents,
    get_health_status,
    get_logs,
    get_request_history,
    get_retrieval_history,
)
from app.services.cleanup_service import cleanup_old_records

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/logs", response_model=list[LogEntryResponse])
async def admin_logs(
    runtime: AppRuntime = Depends(get_runtime),
    _claims: dict = Depends(require_admin),
) -> list[LogEntryResponse]:
    return get_logs(runtime)


@router.get("/requests", response_model=list[RequestHistoryResponse])
async def admin_requests(
    runtime: AppRuntime = Depends(get_runtime),
    _claims: dict = Depends(require_admin),
) -> list[RequestHistoryResponse]:
    return get_request_history(runtime)


@router.get("/documents", response_model=list[AdminDocumentResponse])
async def admin_documents(
    runtime: AppRuntime = Depends(get_runtime),
    _claims: dict = Depends(require_admin),
) -> list[AdminDocumentResponse]:
    return get_documents(runtime)


@router.get("/retrievals", response_model=list[RetrievalHistoryResponse])
async def admin_retrievals(
    runtime: AppRuntime = Depends(get_runtime),
    _claims: dict = Depends(require_admin),
) -> list[RetrievalHistoryResponse]:
    return get_retrieval_history(runtime)


@router.get("/health", response_model=HealthResponse)
async def admin_health(
    runtime: AppRuntime = Depends(get_runtime),
    _claims: dict = Depends(require_admin),
) -> HealthResponse:
    return get_health_status(runtime)


@router.get("/token-usage", response_model=list[TokenUsageResponse])
async def admin_token_usage(
    db: Session = Depends(get_db),
    _claims: dict = Depends(require_admin),
) -> list[TokenUsageResponse]:
    rows = db.query(TokenUsage).order_by(TokenUsage.timestamp.desc()).limit(500).all()
    return [
        TokenUsageResponse(
            request_id=row.request_id or "",
            workspace_id=row.workspace_id,
            timestamp=row.timestamp.isoformat(),
            model=row.model,
            prompt_tokens=row.prompt_tokens,
            completion_tokens=row.completion_tokens,
            total_tokens=row.total_tokens,
            estimated_cost_usd=row.estimated_cost_usd,
            latency_ms=row.latency_ms,
            mode=row.mode,
            context_chunks_used=row.context_chunks_used,
        )
        for row in rows
    ]


@router.get("/token-summary", response_model=TokenSummaryResponse)
async def admin_token_summary(
    db: Session = Depends(get_db),
    _claims: dict = Depends(require_admin),
) -> TokenSummaryResponse:
    rows = db.query(TokenUsage).all()
    total_requests = len(rows)
    total_tokens = sum(item.total_tokens for item in rows)
    total_cost_usd = round(sum(item.estimated_cost_usd for item in rows), 4)
    avg_latency_ms = round(sum(item.latency_ms for item in rows) / total_requests, 3) if total_requests else 0.0
    by_workspace: dict = {}
    by_model: dict = {}
    for row in rows:
        workspace_key = row.workspace_id or "unknown"
        if workspace_key not in by_workspace:
            by_workspace[workspace_key] = {"tokens": 0, "cost": 0.0, "requests": 0}
        by_workspace[workspace_key]["tokens"] += row.total_tokens
        by_workspace[workspace_key]["cost"] += row.estimated_cost_usd
        by_workspace[workspace_key]["requests"] += 1

        if row.model not in by_model:
            by_model[row.model] = {"tokens": 0, "cost": 0.0, "requests": 0}
        by_model[row.model]["tokens"] += row.total_tokens
        by_model[row.model]["cost"] += row.estimated_cost_usd
        by_model[row.model]["requests"] += 1

    for values in by_workspace.values():
        values["cost"] = round(values["cost"], 4)
    for values in by_model.values():
        values["cost"] = round(values["cost"], 4)

    return TokenSummaryResponse(
        total_requests=total_requests,
        total_tokens=total_tokens,
        total_cost_usd=total_cost_usd,
        by_workspace=by_workspace,
        by_model=by_model,
        avg_latency_ms=avg_latency_ms,
    )


@router.get("/conversations")
def admin_conversations(
    runtime: AppRuntime = Depends(get_runtime),
    limit: int = 200,
    _claims: dict = Depends(require_admin),
) -> list:
    entries = runtime.observability.list_conversations()
    return [
        {
            "request_id": e.request_id,
            "workspace_id": e.workspace_id,
            "timestamp": e.timestamp,
            "question": e.question,
            "answer": e.answer,
            "mode": e.mode,
            "sources": e.sources,
            "top_score": e.top_score,
            "history_turns": e.history_turns,
            "latency_ms": e.latency_ms,
        }
        for e in entries[:limit]
    ]


@router.post("/cleanup")
async def admin_cleanup(
    db: Session = Depends(get_db),
    _claims: dict = Depends(require_admin),
) -> dict[str, int]:
    results = cleanup_old_records(db)
    return {
        "token_usage_deleted": int(results.get("token_usage_deleted", 0)),
        "reset_tokens_deleted": int(results.get("reset_tokens_deleted", 0)),
    }


@router.get("/users", response_model=list[UserAdminResponse])
async def admin_users(
    db: Session = Depends(get_db),
    _claims: dict = Depends(require_admin),
) -> list[UserAdminResponse]:
    rows = db.query(User).filter(User.deleted_at.is_(None)).order_by(User.created_at.desc()).all()
    return [
        UserAdminResponse(
            user_id=str(row.id),
            email=row.email,
            full_name=row.full_name or "",
            role=row.role,
            is_active=row.is_active,
            created_at=row.created_at.isoformat(),
        )
        for row in rows
    ]


@router.patch("/users/{user_id}/role", response_model=UserAdminResponse)
async def admin_update_user_role(
    user_id: str,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    _claims: dict = Depends(require_admin),
) -> UserAdminResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise AppError(404, "user_not_found", "User not found.")
    user.role = payload.role
    db.commit()
    db.refresh(user)
    return UserAdminResponse(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name or "",
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.patch("/users/{user_id}/status", response_model=UserAdminResponse)
async def admin_update_user_status(
    user_id: str,
    payload: UserStatusUpdate,
    db: Session = Depends(get_db),
    _claims: dict = Depends(require_admin),
) -> UserAdminResponse:
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise AppError(404, "user_not_found", "User not found.")
    user.is_active = payload.is_active
    db.commit()
    db.refresh(user)
    return UserAdminResponse(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name or "",
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat(),
    )


@router.delete("/users/{user_id}", status_code=204)
async def admin_delete_user(
    user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
) -> Response:
    current_user_id = current_user.id
    if str(current_user_id) == str(user_id):
        raise AppError(400, "cannot_delete_self", "You cannot delete your own account.")

    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise AppError(404, "user_not_found", "User not found.")

    user.is_active = False
    user.deleted_at = datetime.utcnow()
    db.commit()
    return Response(status_code=204)


@router.post("/embeddings/rebuild", status_code=202)
async def admin_embeddings_rebuild(
    background_tasks: BackgroundTasks,
    runtime: AppRuntime = Depends(get_runtime),
    _claims: dict = Depends(require_admin),
) -> dict:
    """Kick off async re-embedding of all workspace chunks (returns 202 immediately)."""
    import logging
    from app.services.embedding_service import embed_texts
    from app.db.models import Document, DocumentChunk, Workspace
    from app.services.pgvector_store import store_chunk_embedding
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    logger = logging.getLogger(__name__)
    settings = runtime.settings

    def _do_rebuild() -> None:
        engine = create_engine(settings.database_url)
        Session = sessionmaker(bind=engine)
        with Session() as session:
            workspaces = session.query(Workspace).filter(Workspace.is_active.is_(True)).all()
            count = 0
            for workspace in workspaces:
                chunks = (
                    session.query(DocumentChunk)
                    .join(Document, Document.id == DocumentChunk.document_id)
                    .filter(Document.workspace_id == workspace.id)
                    .order_by(DocumentChunk.created_at.asc())
                    .all()
                )
                if not chunks:
                    continue
                texts = [chunk.text for chunk in chunks]
                embeddings = embed_texts(texts, settings)
                for chunk, embedding in zip(chunks, embeddings):
                    chunk.embedding = embedding
                    store_chunk_embedding(
                        db=session,
                        chunk_id=chunk.id,
                        chunk_text=chunk.text,
                        metadata={"workspace_id": str(workspace.id)},
                        settings=settings,
                    )
                session.commit()
                count += 1
            logger.info("embedding_rebuild_complete workspaces=%d model=%s", count, settings.local_embedding_model)

    background_tasks.add_task(_do_rebuild)
    return {"status": "rebuilding", "model": settings.local_embedding_model}
