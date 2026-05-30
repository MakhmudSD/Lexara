"""End-to-end document ingestion helpers."""

from __future__ import annotations

import logging
from pathlib import Path
from uuid import UUID

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
) -> tuple[Document, list[str]]:
    """Persist the uploaded document and return chunks for background indexing.

    Storage strategy (in priority order):
    1. Cloudflare R2 — if R2_* env vars are set, upload the original file bytes
       and set storage_path = "r2://<bucket>/<workspace_id>/<doc_id>/<filename>"
    2. Local disk fallback — write raw_text to uploads_data_dir as .txt.
       storage_path = absolute local path.  Works in development and on servers
       that mount persistent volumes.
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
        storage_path="pending",
        raw_text=raw_text,
    )
    document.chunk_count = 0
    document.is_processed = False

    # --- Storage: R2 first, local fallback ---
    from app.services import r2_storage

    if r2_storage.is_configured(settings):
        try:
            document.storage_path = r2_storage.upload_file(
                settings,
                workspace_id=str(workspace.id),
                document_id=str(document.id),
                filename=filename,
                data=file_bytes,
                content_type=content_type,
            )
        except Exception as exc:
            logger.error("R2 upload failed for %s/%s: %s", workspace.id, document.id, exc)
            raise AppError(500, "storage_error", "File could not be saved to cloud storage. Please try again.") from exc
    else:
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
