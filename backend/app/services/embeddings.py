"""Local embedding generation using sentence-transformers."""

from __future__ import annotations

from functools import lru_cache

import numpy as np

from app.core.config import Settings
from app.core.exceptions import AppError

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover
    SentenceTransformer = None  # type: ignore[misc, assignment]


@lru_cache(maxsize=2)
def _get_model(model_name: str) -> "SentenceTransformer":
    if SentenceTransformer is None:
        raise AppError(
            500,
            "sentence_transformers_not_installed",
            "sentence-transformers is not installed on the server.",
        )
    return SentenceTransformer(model_name)


def embed_texts(texts: list[str], settings: Settings) -> list[list[float]]:
    """Generate embeddings for a batch of text chunks."""
    if not texts:
        return []

    model = _get_model(settings.local_embedding_model)
    vectors = model.encode(
        texts,
        convert_to_numpy=True,
        show_progress_bar=False,
        normalize_embeddings=True,
    )
    matrix = np.asarray(vectors, dtype="float32")
    return matrix.tolist()


def embed_query(question: str, settings: Settings) -> list[float]:
    """Generate a single normalized embedding for a user question."""
    results = embed_texts([question], settings)
    return results[0]
