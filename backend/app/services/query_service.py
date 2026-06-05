"""Retrieval flow: embed question → pgvector hybrid search → rerank."""

from __future__ import annotations

import hashlib
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.cache import get_retrieval_cache
from app.core.config import Settings
from app.crud.workspace import get_workspace_or_404
from app.schemas.chat import RetrievedChunk
from app.services.embedding_service import embed_query
from app.services.pgvector_store import search_bm25_pgvector
from app.services.reranking import rerank_chunks


def query_workspace(
    db: Session,
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

    # When embeddings are not configured we keep retrieval non-fatal and
    # return an empty result set instead of surfacing a 500 to callers.
    if not settings.openai_api_key:
        return []

    query_embedding = embed_query(question, settings)
    hits = search_bm25_pgvector(
        db=db,
        workspace_id=workspace_id,
        query=question,
        query_embedding=query_embedding,
        top_k=top_k,
    )
    if not hits:
        return []

    retrieved: list[RetrievedChunk] = []
    for hit in hits:
        if hit.get("document_id") is None:
            continue
        retrieved.append(
            RetrievedChunk(
                chunk_id=UUID(str(hit["chunk_id"])),
                document_id=UUID(str(hit["document_id"])),
                filename=hit.get("filename"),
                chunk_index=int(hit["chunk_index"]),
                text=hit["text"],
                score=float(hit.get("score") or 0.0),
            )
        )

    if settings.enable_reranking and retrieved:
        retrieved = rerank_chunks(question, retrieved, top_n=top_k)

    get_retrieval_cache().set(cache_key, retrieved)
    return retrieved
