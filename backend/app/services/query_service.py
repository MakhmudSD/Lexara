"""Retrieval-only query flow: embed question → FAISS search → load chunks."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.exceptions import AppError
from app.crud import document as document_crud
from app.crud.workspace import get_workspace_or_404
from app.schemas.chat import ChatQueryResponse, RetrievedChunk
from app.services.embeddings import embed_query
from app.services.vector_store import FaissVectorStore


def query_workspace(
    db: Session,
    vector_store: FaissVectorStore,
    settings: Settings,
    *,
    workspace_id: UUID,
    question: str,
    top_k: int,
) -> ChatQueryResponse:
    get_workspace_or_404(db, workspace_id)

    query_embedding = embed_query(question, settings)
    hits = vector_store.search(
        workspace_id=str(workspace_id),
        query_embedding=query_embedding,
        top_k=top_k,
    )
    if not hits:
        return ChatQueryResponse(
            workspace_id=workspace_id,
            question=question,
            top_k=top_k,
            chunks=[],
        )

    chunk_ids = [UUID(hit.chunk_id) for hit in hits]
    db_chunks = document_crud.get_chunks_by_ids(db, chunk_ids)
    chunk_lookup = {chunk.id: chunk for chunk in db_chunks}

    retrieved: list[RetrievedChunk] = []
    for hit in hits:
        chunk = chunk_lookup.get(UUID(hit.chunk_id))
        if chunk is None:
            continue
        retrieved.append(
            RetrievedChunk(
                chunk_id=chunk.id,
                document_id=chunk.document_id,
                chunk_index=chunk.chunk_index,
                text=chunk.text,
                score=hit.score,
            )
        )

    return ChatQueryResponse(
        workspace_id=workspace_id,
        question=question,
        top_k=top_k,
        chunks=retrieved,
    )
