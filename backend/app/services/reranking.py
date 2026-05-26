from __future__ import annotations

from functools import lru_cache
from app.schemas.chat import RetrievedChunk


@lru_cache(maxsize=1)
def _get_reranker():
    from sentence_transformers import CrossEncoder
    return CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2')


def rerank_chunks(
    question: str,
    chunks: list[RetrievedChunk],
    top_n: int | None = None,
) -> list[RetrievedChunk]:
    """Rerank chunks using a cross-encoder. Returns sorted by relevance."""
    if not chunks:
        return chunks

    try:
        reranker = _get_reranker()
        pairs = [(question, c.text) for c in chunks]
        scores = reranker.predict(pairs)
        ranked = sorted(
            zip(chunks, scores),
            key=lambda x: x[1],
            reverse=True,
        )
        result = [c for c, _ in ranked]
        # Update scores with cross-encoder scores (normalized 0-1)
        import numpy as np

        norm_scores = 1 / (1 + np.exp(-scores))  # sigmoid
        for chunk, score in zip(result, sorted(norm_scores, reverse=True)):
            chunk.score = float(score)
        return result[:top_n] if top_n else result
    except Exception:
        return chunks  # graceful fallback if reranker unavailable
