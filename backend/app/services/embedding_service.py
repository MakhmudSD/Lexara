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


# OpenAI's embeddings endpoint caps a single request at 300k input tokens.
# No tiktoken dependency here, so this uses a conservative chars-per-token
# floor (CJK text runs closer to 1-2 chars/token, well under the ~4 chars/
# token typical for English) to stay under the real limit even for
# Korean/Japanese-heavy documents, which this app explicitly supports.
_MAX_BATCH_CHARS = 400_000


def embed_texts(texts: list[str], settings: Settings) -> list[list[float]]:
    """Generate embeddings for a batch of text chunks (document-side).

    Splits into multiple requests when the combined text would exceed
    OpenAI's per-request token cap — a single large document (many chunks)
    used to be sent as one request and fail outright once its total size
    passed that cap.
    """
    if not texts:
        return []

    batches: list[list[str]] = []
    current: list[str] = []
    current_chars = 0
    for text in texts:
        text_len = len(text)
        if current and current_chars + text_len > _MAX_BATCH_CHARS:
            batches.append(current)
            current = []
            current_chars = 0
        current.append(text)
        current_chars += text_len
    if current:
        batches.append(current)

    embeddings: list[list[float]] = []
    for batch in batches:
        embeddings.extend(_embed_via_openai(batch, settings))
    return embeddings


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
