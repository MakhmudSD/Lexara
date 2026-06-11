import time

from sqlalchemy.orm import Session

from app.schemas.admin import AdminDocumentResponse, HealthResponse
from app.core.runtime import AppRuntime
from app.db import SessionLocal
from app.db.models import Document, DocumentChunk


def get_logs(runtime: AppRuntime):
    return runtime.observability.list_logs()


def get_request_history(runtime: AppRuntime):
    return runtime.observability.list_requests()


def get_retrieval_history(runtime: AppRuntime):
    return runtime.observability.list_retrievals()


def get_documents(runtime: AppRuntime) -> list[AdminDocumentResponse]:
    db: Session = SessionLocal()
    try:
        documents = db.query(Document).filter(Document.is_active.is_(True)).all()
        return [
            AdminDocumentResponse(
                document_id=str(document.id),
                workspace_id=str(document.workspace_id),
                filename=document.filename,
                content_type=document.content_type,
                user_id=None,
                chunk_count=document.chunk_count,
                upload_time=document.created_at.isoformat(),
                file_size=document.file_size_bytes,
            )
            for document in documents
        ]
    finally:
        db.close()


def get_health_status(runtime: AppRuntime) -> HealthResponse:
    uptime_seconds = round(time.time() - runtime.observability.started_at, 3)
    db: Session = SessionLocal()
    try:
        doc_count = db.query(Document).filter(Document.is_active.is_(True)).count()
        chunk_count = db.query(DocumentChunk).filter(DocumentChunk.has_embedding.is_(True)).count()
    finally:
        db.close()

    return HealthResponse(
        status="ok",
        uptime_seconds=uptime_seconds,
        openai_configured=runtime.settings.openai_configured,
        indexed_documents=doc_count,
        indexed_chunks=chunk_count,
        persistence_backend="postgresql",
        vector_backend="pgvector",
        total_logs=len(runtime.observability.list_logs()),
        total_requests=len(runtime.observability.list_requests()),
        total_retrievals=len(runtime.observability.list_retrievals()),
    )
