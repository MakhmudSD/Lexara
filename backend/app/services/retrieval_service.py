from __future__ import annotations

import numpy as np
from pydantic import BaseModel

from app.schemas.document import DocumentChunk


class RetrievalMatch(BaseModel):
    document_id: str
    chunk_id: str
    text: str
    score: float


def cosine_similarity(vector_a: list[float], vector_b: list[float]) -> float:
    a = np.array(vector_a, dtype=float)
    b = np.array(vector_b, dtype=float)
    denominator = np.linalg.norm(a) * np.linalg.norm(b)
    if denominator == 0:
        return 0.0
    return float(np.dot(a, b) / denominator)


def retrieve_top_chunks(
    question_embedding: list[float],
    document_chunks: list[DocumentChunk],
    document_embeddings: list[list[float]],
    top_k: int = 3,
) -> list[RetrievalMatch]:
    if len(document_chunks) != len(document_embeddings):
        raise ValueError("Document chunks and document embeddings must have the same length.")

    scored_chunks = [
        RetrievalMatch(
            document_id=chunk.document_id,
            chunk_id=chunk.chunk_id,
            text=chunk.content,
            score=cosine_similarity(question_embedding, embedding),
        )
        for chunk, embedding in zip(document_chunks, document_embeddings)
    ]
    scored_chunks.sort(key=lambda item: item.score, reverse=True)
    return scored_chunks[:top_k]
