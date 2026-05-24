from __future__ import annotations

from functools import lru_cache
import json
from openai import OpenAI
from app.core.config import Settings
from app.core.exceptions import AppError
from app.core.cache import get_cache, cache_key_for_text


@lru_cache(maxsize=1)
def _get_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key)


def generate_embedding(text: str, settings: Settings) -> list[float]:
    if not settings.openai_api_key:
        raise AppError(
            500,
            "missing_openai_api_key",
            "OPENAI_API_KEY is not configured on the server.",
        )

    cache = get_cache()
    cache_key = cache_key_for_text("embed", settings.embedding_model, text)
    cached = cache.get(cache_key)
    if cached:
        try:
            data = json.loads(cached)
            return data
        except Exception:
            # fall through to generate
            pass

    emb = list(
        _generate_cached_embedding(
            api_key=settings.openai_api_key,
            model=settings.embedding_model,
            text=text,
        )
    )

    try:
        cache.set(cache_key, emb, ex=settings.embedding_cache_ttl_seconds)
    except Exception:
        pass

    return emb


def generate_embeddings(texts: list[str], settings: Settings) -> list[list[float]]:
    if not texts:
        return []

    if not settings.openai_api_key:
        raise AppError(
            500,
            "missing_openai_api_key",
            "OPENAI_API_KEY is not configured on the server.",
        )

    response = _get_client(settings.openai_api_key).embeddings.create(
        model=settings.embedding_model,
        input=texts,
    )
    return [item.embedding for item in response.data]


@lru_cache(maxsize=256)
def _generate_cached_embedding(
    api_key: str,
    model: str,
    text: str,
) -> tuple[float, ...]:
    response = _get_client(api_key).embeddings.create(
        model=model,
        input=text,
    )
    return tuple(response.data[0].embedding)
