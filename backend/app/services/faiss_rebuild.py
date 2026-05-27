"""Rebuild FAISS indexes from PostgreSQL chunks on startup."""
from __future__ import annotations
import logging
from sqlalchemy.orm import Session
from app.core.config import Settings

logger = logging.getLogger(__name__)


def rebuild_faiss_from_db(db: Session, settings: Settings) -> int:
    """Re-embed all chunks from DB into FAISS. Returns number of workspaces rebuilt."""
    from app.db.models import Document, DocumentChunk, Workspace
    from app.services.embeddings import embed_texts
    from app.services.vector_store import FaissVectorStore

    store = FaissVectorStore(settings=settings)
    workspaces = db.query(Workspace).filter(Workspace.is_active.is_(True)).all()
    rebuilt = 0

    for ws in workspaces:
        chunks = (
            db.query(DocumentChunk)
            .join(Document, Document.id == DocumentChunk.document_id)
            .filter(Document.workspace_id == ws.id)
            .all()
        )
        if not chunks:
            continue
        try:
            texts = [c.text for c in chunks]
            chunk_ids = [str(c.id) for c in chunks]
            embeddings = embed_texts(texts, settings)
            store.add_vectors(
                workspace_id=str(ws.id),
                chunk_ids=chunk_ids,
                embeddings=embeddings,
            )
            logger.info(f"Rebuilt FAISS for workspace {ws.id}: {len(chunks)} chunks")
            rebuilt += 1
        except Exception as e:
            logger.warning(f"Failed to rebuild FAISS for workspace {ws.id}: {e}")

    return rebuilt
