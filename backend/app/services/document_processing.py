"""End-to-end document ingestion: chunk → embed → PostgreSQL → FAISS."""

from __future__ import annotations

from pathlib import Path
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import AppError
from app.crud import document as document_crud
from app.crud.workspace import get_workspace_or_404
from app.db.models import Document
from app.services.chunking import chunk_text
from app.services.embeddings import embed_texts
from app.services.vector_store import FaissVectorStore


def process_text_document(
    db: Session,
    vector_store: FaissVectorStore,
    settings: Settings,
    *,
    workspace_id: UUID,
    filename: str,
    content_type: str,
    raw_text: str,
    file_bytes: bytes,
) -> Document:
    workspace = get_workspace_or_404(db, workspace_id)

    if not raw_text.strip():
        raise AppError(400, "empty_document", "The uploaded document did not contain text.")

    uploads_dir = Path(settings.uploads_data_dir)
    uploads_dir.mkdir(parents=True, exist_ok=True)

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

    storage_path = uploads_dir / str(workspace.id) / f"{document.id}.txt"
    storage_path.parent.mkdir(parents=True, exist_ok=True)
    storage_path.write_text(raw_text, encoding="utf-8")
    document.storage_path = str(storage_path)

    chunks = chunk_text(
        raw_text,
        chunk_size=settings.default_chunk_size,
        overlap=settings.default_chunk_overlap,
    )
    if not chunks:
        raise AppError(400, "no_chunks_generated", "No chunks were generated from the document.")

    embeddings = embed_texts(chunks, settings)
    chunk_records = document_crud.create_chunks(
        db,
        document_id=document.id,
        chunks=chunks,
        embeddings=embeddings,
    )

    vector_store.add_embeddings(
        workspace_id=str(workspace.id),
        chunk_ids=[str(chunk.id) for chunk in chunk_records],
        embeddings=embeddings,
    )

    document_crud.mark_document_processed(db, document.id, len(chunk_records))
    db.commit()
    db.refresh(document)
    return document
