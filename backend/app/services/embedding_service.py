"""Local embedding generation using sentence-transformers."""

from __future__ import annotations

import hashlib
import numpy as np

from app.core.cache import get_embedding_cache
from app.core.config import Settings
from app.core.exceptions import AppError

try:
    from sentence_transformers import SentenceTransformer
except ImportError:  # pragma: no cover
    SentenceTransformer = None  # type: ignore[misc, assignment]

MODEL_NAME = "all-MiniLM-L6-v2"
_model: SentenceTransformer | None = None
_model_name: str | None = None


def _get_model(model_name: str = MODEL_NAME) -> "SentenceTransformer":
    """Load the embedding model only on first use."""
    global _model, _model_name

    if SentenceTransformer is None:
        raise AppError(
            500,
            "sentence_transformers_not_installed",
            "sentence-transformers is not installed on the server.",
        )

    if _model is None or _model_name != model_name:
        _model = SentenceTransformer(model_name)
        _model_name = model_name
    return _model


def embed_texts(texts: list[str], settings: Settings) -> list[list[float]]:
    """Generate embeddings for a batch of text chunks."""
    if not texts:
        return []

    model = _get_model(settings.local_embedding_model or MODEL_NAME)
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
    cache = get_embedding_cache()
    key = f"emb:{settings.local_embedding_model}:{hashlib.sha256(question.encode('utf-8')).hexdigest()}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    result = embed_texts([question], settings)[0]
    cache.set(key, result)
    return result
