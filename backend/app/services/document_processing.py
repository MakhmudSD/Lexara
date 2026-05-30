"""End-to-end document ingestion helpers."""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import UUID
from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import AppError
from app.crud import document as document_crud
from app.crud.workspace import get_workspace_or_404
from app.db.models import Document
from app.services.chunking import chunk_text

logger = logging.getLogger(__name__)


def process_text_document(
    db: Session,
    settings: Settings,
    *,
    workspace_id: UUID,
    filename: str,
    content_type: str,
    raw_text: str,
    file_bytes: bytes,
    document_id: Optional[UUID] = None,
    storage_path: Optional[str] = None,
) -> tuple[Document, list[str]]:
    """Persist the uploaded document and return chunks for background indexing.

    If *document_id* and *storage_path* are supplied (pre-uploaded by the route
    handler via r2_service), they are used directly and no further upload is done.

    Otherwise falls back to local disk (development / no-R2 environments).
    """
    workspace = get_workspace_or_404(db, workspace_id)

    if not raw_text.strip():
        raise AppError(400, "empty_document", "The uploaded document did not contain text.")

    document = document_crud.create_document(
        db,
        organization_id=workspace.organization_id,
        workspace_id=workspace.id,
        filename=filename,
        content_type=content_type,
        file_size_bytes=len(file_bytes),
        storage_path=storage_path or "pending",
        raw_text=raw_text,
        document_id=document_id,
    )
    document.chunk_count = 0
    document.is_processed = False

    # Only write local fallback when no storage_path was pre-computed by the route
    if not storage_path:
        document.storage_path = _write_local(settings, workspace.id, document.id, raw_text)

    chunks = chunk_text(
        raw_text,
        chunk_size=settings.default_chunk_size,
        overlap=settings.default_chunk_overlap,
    )
    if not chunks:
        raise AppError(400, "no_chunks_generated", "No chunks were generated from the document.")

    db.commit()
    db.refresh(document)
    return document, chunks


def _write_local(settings: Settings, workspace_id: UUID, document_id: UUID, raw_text: str) -> str:
    """Write raw_text to local disk and return the absolute path."""
    uploads_dir = Path(settings.uploads_data_dir)
    local_path = uploads_dir / str(workspace_id) / f"{document_id}.txt"
    local_path.parent.mkdir(parents=True, exist_ok=True)
    local_path.write_text(raw_text, encoding="utf-8")
    return str(local_path)
