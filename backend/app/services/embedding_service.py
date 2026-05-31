"""Embedding generation via OpenAI API (text-embedding-3-small)."""

from __future__ import annotations

import hashlib

import openai

from app.core.cache import get_embedding_cache
from app.core.config import Settings
from app.core.exceptions import AppError

OPENAI_EMBEDDING_MODEL = "text-embedding-3-small"


def _get_model(model_name: str = OPENAI_EMBEDDING_MODEL) -> str:
    """No-op shim kept for startup warmup compatibility — returns model name."""
    return model_name


def _embed_via_openai(texts: list[str], settings: Settings) -> list[list[float]]:
    if not settings.openai_api_key:
        raise AppError(
            500,
            "openai_not_configured",
            "OPENAI_API_KEY is required for embeddings.",
        )
    client = openai.OpenAI(api_key=settings.openai_api_key)
    response = client.embeddings.create(
        model=settings.embedding_model,
        input=texts,
    )
    return [item.embedding for item in response.data]


def embed_texts(texts: list[str], settings: Settings) -> list[list[float]]:
    """Generate embeddings for a batch of text chunks (document-side)."""
    if not texts:
        return []
    return _embed_via_openai(texts, settings)


def embed_query(question: str, settings: Settings) -> list[float]:
    """Generate a single embedding for a user question (query-side)."""
    cache = get_embedding_cache()
    key = f"emb:{settings.embedding_model}:{hashlib.sha256(question.encode()).hexdigest()}"
    cached = cache.get(key)
    if cached is not None:
        return cached
    result = _embed_via_openai([question], settings)[0]
    cache.set(key, result)
    return result
