from uuid import UUID, uuid4
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.db.models import Document, DocumentChunk


def create_document(
    db: Session,
    *,
    organization_id: UUID,
    workspace_id: UUID,
    filename: str,
    content_type: str,
    file_size_bytes: int,
    storage_path: str,
    raw_text: str,
    document_id: Optional[UUID] = None,
) -> Document:
    document = Document(
        id=document_id or uuid4(),
        organization_id=organization_id,
        workspace_id=workspace_id,
        filename=filename,
        content_type=content_type,
        file_size_bytes=file_size_bytes,
        storage_path=storage_path,
        chunk_count=0,
        is_processed=False,
        is_active=True,
        document_metadata={"raw_text": raw_text},
    )
    db.add(document)
    db.flush()
    return document


def create_chunks(
    db: Session,
    *,
    document_id: UUID,
    chunks: list[str],
    embeddings: list[list[float]],
) -> list[DocumentChunk]:
    records: list[DocumentChunk] = []
    for index, (text, embedding) in enumerate(zip(chunks, embeddings)):
        record = DocumentChunk(
            document_id=document_id,
            chunk_index=index,
            text=text,
            embedding=embedding,
            has_embedding=True,
        )
        db.add(record)
        records.append(record)
    db.flush()
    return records


def mark_document_processed(db: Session, document_id: UUID, chunk_count: int) -> Document | None:
    document = db.query(Document).filter(Document.id == document_id).first()
    if document is None:
        return None
    document.chunk_count = chunk_count
    document.is_processed = True
    db.flush()
    return document


def get_chunks_by_ids(db: Session, chunk_ids: list[UUID]) -> list[DocumentChunk]:
    if not chunk_ids:
        return []
    return db.query(DocumentChunk).filter(DocumentChunk.id.in_(chunk_ids)).all()


def get_document_or_404(db: Session, document_id: UUID) -> Document:
    doc = db.query(Document).filter(
        Document.id == document_id,
        Document.is_active.is_(True),
    ).first()
    if not doc:
        raise AppError(404, "document_not_found", "Document not found.")
    return doc


def get_workspace_chunks_with_embeddings(db: Session, workspace_id: UUID) -> list[DocumentChunk]:
    return (
        db.query(DocumentChunk)
        .join(Document, Document.id == DocumentChunk.document_id)
        .filter(
            Document.workspace_id == workspace_id,
            Document.is_active.is_(True),
            DocumentChunk.has_embedding.is_(True),
        )
        .order_by(DocumentChunk.created_at.asc())
        .all()
    )
