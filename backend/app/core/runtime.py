from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings
from app.observability.store import InMemoryObservabilityStore
from app.services.vector_store import FaissVectorStore


@dataclass
class AppRuntime:
    settings: Settings
    vector_store: FaissVectorStore
    observability: InMemoryObservabilityStore

    @classmethod
    def create(cls, settings: Settings) -> "AppRuntime":
        vector_store = FaissVectorStore(settings=settings)
        vector_store.validate_dimensions()
        return cls(
            settings=settings,
            vector_store=vector_store,
            observability=InMemoryObservabilityStore(settings=settings),
        )
