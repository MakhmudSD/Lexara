"""pgvector-backed hybrid retrieval helpers."""

from __future__ import annotations

import json
from uuid import UUID

from sqlalchemy import text as sql_text
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.services.embedding_service import embed_query


def _vector_literal(values: list[float]) -> str:
    """Format a Python embedding as pgvector text input."""
    return "[" + ",".join(str(float(value)) for value in values) + "]"


def store_chunk_embedding(
    db: Session,
    chunk_id: UUID,
    chunk_text: str,
    metadata: dict,
    settings: Settings,
) -> None:
    """Embed a chunk and persist it to the pgvector column."""
    embedding = embed_query(chunk_text, settings)
    db.execute(
        sql_text(
            """
            UPDATE document_chunks
            SET pgvector_embedding = CAST(:embedding AS vector),
                metadata = CAST(:metadata AS jsonb)
            WHERE id = :chunk_id
            """
        ),
        {
            "embedding": _vector_literal(embedding),
            "metadata": json.dumps(metadata or {}),
            "chunk_id": str(chunk_id),
        },
    )
    db.commit()


def search_pgvector(
    db: Session,
    workspace_id: UUID,
    query_embedding: list[float],
    top_k: int,
) -> list[dict]:
    """Semantic similarity search scoped to one workspace."""
    rows = db.execute(
        sql_text(
            """
            SELECT
                dc.id AS chunk_id,
                dc.document_id,
                dc.text,
                dc.chunk_index,
                dc.metadata,
                d.filename,
                1 - (dc.pgvector_embedding <=> CAST(:embedding AS vector)) AS score
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE d.workspace_id = :workspace_id
              AND dc.pgvector_embedding IS NOT NULL
            ORDER BY dc.pgvector_embedding <=> CAST(:embedding AS vector)
            LIMIT :limit
            """
        ),
        {
            "embedding": _vector_literal(query_embedding),
            "workspace_id": str(workspace_id),
            "limit": top_k * 4,
        },
    ).fetchall()
    return [dict(row._mapping) for row in rows]


def search_bm25_pgvector(
    db: Session,
    workspace_id: UUID,
    query: str,
    query_embedding: list[float],
    top_k: int,
) -> list[dict]:
    """Hybrid BM25 + semantic retrieval with Reciprocal Rank Fusion."""
    from rank_bm25 import BM25Okapi

    all_rows = db.execute(
        sql_text(
            """
            SELECT
                dc.id AS chunk_id,
                dc.document_id,
                dc.text,
                dc.chunk_index,
                dc.metadata,
                d.filename
            FROM document_chunks dc
            JOIN documents d ON dc.document_id = d.id
            WHERE d.workspace_id = :workspace_id
              AND dc.pgvector_embedding IS NOT NULL
            """
        ),
        {"workspace_id": str(workspace_id)},
    ).fetchall()

    if not all_rows:
        return []

    all_dicts = [dict(row._mapping) for row in all_rows]

    tokenized = [row["text"].lower().split() for row in all_dicts]
    bm25 = BM25Okapi(tokenized)
    bm25_scores = bm25.get_scores(query.lower().split())
    bm25_ranked = sorted(range(len(all_dicts)), key=lambda i: bm25_scores[i], reverse=True)
    bm25_rank = {all_dicts[i]["chunk_id"]: rank for rank, i in enumerate(bm25_ranked)}

    semantic_rows = search_pgvector(db, workspace_id, query_embedding, top_k)
    semantic_rank = {row["chunk_id"]: rank for rank, row in enumerate(semantic_rows)}

    k = 60
    all_ids = set(bm25_rank) | set(semantic_rank)
    rrf_scores: dict[UUID, float] = {}
    for cid in all_ids:
        score = 0.0
        if cid in bm25_rank:
            score += 1 / (k + bm25_rank[cid])
        if cid in semantic_rank:
            score += 1 / (k + semantic_rank[cid])
        rrf_scores[cid] = score

    lookup = {row["chunk_id"]: row for row in all_dicts}
    for row in semantic_rows:
        lookup[row["chunk_id"]] = row

    top_ids = sorted(rrf_scores, key=rrf_scores.get, reverse=True)[:top_k]
    results: list[dict] = []
    for cid in top_ids:
        row = lookup.get(cid)
        if row is not None:
            results.append(row)
    return results
