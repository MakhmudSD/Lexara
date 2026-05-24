"""Redis cache helper with graceful fallback to in-memory null cache."""
from __future__ import annotations

import json
import logging
from typing import Any, Optional
from hashlib import sha256

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class NullCache:
    def get(self, key: str) -> Optional[str]:
        return None

    def set(self, key: str, value: Any, ex: int | None = None):
        return None


class RedisCache:
    def __init__(self, redis_client):
        self.client = redis_client

    def get(self, key: str) -> Optional[str]:
        try:
            value = self.client.get(key)
            if value is None:
                return None
            if isinstance(value, bytes):
                return value.decode('utf-8')
            return value
        except Exception as e:
            logger.exception("Redis GET failed: %s", e)
            return None

    def set(self, key: str, value: Any, ex: int | None = None):
        try:
            if not isinstance(value, (str, bytes)):
                value = json.dumps(value)
            self.client.set(key, value, ex=ex)
        except Exception as e:
            logger.exception("Redis SET failed: %s", e)


_cache = None


def get_cache() -> Any:
    global _cache
    if _cache is not None:
        return _cache

    settings = get_settings()
    redis_url = getattr(settings, 'redis_url', None)
    if not redis_url:
        logger.info('No REDIS_URL configured, using NullCache')
        _cache = NullCache()
        return _cache

    try:
        import redis
        redis_client = redis.from_url(redis_url, decode_responses=False)
        # Try ping
        redis_client.ping()
        _cache = RedisCache(redis_client)
        logger.info('Connected to Redis at %s', redis_url)
    except Exception as e:
        logger.exception('Failed to connect to Redis (%s). Using NullCache. Error: %s', redis_url, e)
        _cache = NullCache()
    return _cache


def cache_key_for_text(prefix: str, model: str, text: str) -> str:
    h = sha256(text.encode('utf-8')).hexdigest()
    return f"{prefix}:{model}:{h}"
