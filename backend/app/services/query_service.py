"""Retrieval flow: embed question → FAISS search → load chunks."""

from __future__ import annotations

import hashlib
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.cache import get_retrieval_cache
from app.core.config import Settings
from app.crud import document as document_crud
from app.crud.workspace import get_workspace_or_404
from app.schemas.chat import RetrievedChunk
from app.services.embeddings import embed_query
from app.services.reranking import rerank_chunks
from app.services.vector_store import FaissVectorStore


def query_workspace(
    db: Session,
    vector_store: FaissVectorStore,
    settings: Settings,
    *,
    workspace_id: UUID,
    question: str,
    top_k: int,
) -> list[RetrievedChunk]:
    """Query one workspace and return ranked chunks."""
    get_workspace_or_404(db, workspace_id)
    cache_key = f"retrieval:{workspace_id}:{hashlib.md5(question.encode()).hexdigest()}:{top_k}"
    cached = get_retrieval_cache().get(cache_key)
    if cached is not None:
        return cached

    query_embedding = embed_query(question, settings)
    hits = vector_store.search(
        workspace_id=str(workspace_id),
        query_embedding=query_embedding,
        top_k=top_k,
    )
    if not hits:
        return []

    chunk_ids = [UUID(hit.chunk_id) for hit in hits]
    db_chunks = document_crud.get_chunks_by_ids(db, chunk_ids)
    chunk_lookup = {chunk.id: chunk for chunk in db_chunks}

    retrieved: list[RetrievedChunk] = []
    for hit in hits:
        chunk = chunk_lookup.get(UUID(hit.chunk_id))
        if chunk is None:
            continue
        if getattr(chunk, "document", None) is None or chunk.document.workspace_id != workspace_id:
            continue
        retrieved.append(
            RetrievedChunk(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                filename=chunk.document.filename if getattr(chunk, "document", None) is not None else None,
                chunk_index=chunk.chunk_index,
                text=chunk.text,
                score=hit.score,
            )
        )

    if settings.enable_reranking and retrieved:
        retrieved = rerank_chunks(question, retrieved, top_n=top_k)

    get_retrieval_cache().set(cache_key, retrieved)
    return retrieved
