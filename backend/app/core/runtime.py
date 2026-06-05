from __future__ import annotations

from dataclasses import dataclass

from app.core.config import Settings
from app.observability.store import InMemoryObservabilityStore


@dataclass
class AppRuntime:
    settings: Settings
    observability: InMemoryObservabilityStore

    @classmethod
    def create(cls, settings: Settings) -> "AppRuntime":
        return cls(
            settings=settings,
            observability=InMemoryObservabilityStore(settings=settings),
        )
