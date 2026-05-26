"""Thread-safe in-memory TTL caches used by backend services."""

import threading
import time
from typing import Any


class TTLCache:
    """Thread-safe in-memory cache with TTL expiry."""

    def __init__(self, maxsize: int = 512, ttl: int = 300):
        self._cache: dict[str, tuple[Any, float]] = {}
        self._lock = threading.Lock()
        self._maxsize = maxsize
        self._ttl = ttl

    def get(self, key: str) -> Any | None:
        """Get cache value if present and not expired."""
        with self._lock:
            if key not in self._cache:
                return None
            value, expires_at = self._cache[key]
            if time.monotonic() > expires_at:
                del self._cache[key]
                return None
            return value

    def set(self, key: str, value: Any, ttl: int | None = None) -> None:
        """Set cache value with optional custom TTL."""
        with self._lock:
            if len(self._cache) >= self._maxsize:
                oldest = min(self._cache, key=lambda k: self._cache[k][1])
                del self._cache[oldest]
            self._cache[key] = (value, time.monotonic() + (ttl or self._ttl))

    def invalidate(self, key: str) -> None:
        """Delete one cache key if present."""
        with self._lock:
            self._cache.pop(key, None)

    def clear(self) -> None:
        """Clear all cache keys."""
        with self._lock:
            self._cache.clear()

    @property
    def size(self) -> int:
        """Return number of keys in cache."""
        return len(self._cache)


_embedding_cache = TTLCache(maxsize=1024, ttl=86400)
_retrieval_cache = TTLCache(maxsize=256, ttl=300)
_workspace_cache = TTLCache(maxsize=128, ttl=60)


def get_embedding_cache() -> TTLCache:
    """Return embedding cache singleton."""
    return _embedding_cache


def get_retrieval_cache() -> TTLCache:
    """Return retrieval cache singleton."""
    return _retrieval_cache


def get_workspace_cache() -> TTLCache:
    """Return workspace cache singleton."""
    return _workspace_cache
