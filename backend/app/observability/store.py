from __future__ import annotations

import logging
import time
from collections import deque

from app.core.config import Settings
from app.observability.events import build_event
from app.observability.models import (
    LogEntry,
    RequestHistoryEntry,
    RetrievalHistoryEntry,
)

logger = logging.getLogger("rag_saas")
logging.basicConfig(level=logging.INFO)


class InMemoryObservabilityStore:
    def __init__(self, settings: Settings):
        self._logs: deque[LogEntry] = deque(maxlen=settings.max_log_entries)
        self._requests: deque[RequestHistoryEntry] = deque(
            maxlen=settings.max_request_entries
        )
        self._retrievals: deque[RetrievalHistoryEntry] = deque(
            maxlen=settings.max_retrieval_entries
        )
        self.started_at = time.time()

    def add_log(
        self,
        request_id: str,
        level: str,
        stage: str,
        message: str,
        metadata: dict | None = None,
        workspace_id: str | None = None,
        document_id: str | None = None,
    ) -> None:
        entry = build_event(
            request_id=request_id,
            level=level,
            event_type="log",
            stage=stage,
            message=message,
            metadata=metadata or {},
            workspace_id=workspace_id,
            document_id=document_id,
        )
        self._logs.append(entry)
        logger.info(
            "request_id=%s workspace_id=%s document_id=%s stage=%s message=%s metadata=%s",
            request_id,
            entry.workspace_id,
            entry.document_id,
            stage,
            message,
            entry.metadata,
        )

    def add_event(
        self,
        request_id: str,
        event_type: str,
        stage: str,
        message: str,
        metadata: dict | None = None,
        workspace_id: str | None = None,
        document_id: str | None = None,
        level: str = "INFO",
    ) -> None:
        entry = build_event(
            request_id=request_id,
            level=level,
            event_type=event_type,
            stage=stage,
            message=message,
            metadata=metadata or {},
            workspace_id=workspace_id,
            document_id=document_id,
        )
        self._logs.append(entry)
        logger.info(
            "request_id=%s workspace_id=%s document_id=%s event_type=%s stage=%s message=%s metadata=%s",
            request_id,
            entry.workspace_id,
            entry.document_id,
            event_type,
            stage,
            message,
            entry.metadata,
        )

    def add_request(
        self,
        request_id: str,
        method: str,
        path: str,
        status_code: int,
        duration_ms: float,
        workspace_id: str | None = None,
        document_id: str | None = None,
    ) -> None:
        self._requests.append(
            RequestHistoryEntry(
                request_id=request_id,
                method=method,
                path=path,
                status_code=status_code,
                duration_ms=duration_ms,
                workspace_id=workspace_id,
                document_id=document_id,
            )
        )

    def add_retrieval(self, entry: RetrievalHistoryEntry) -> None:
        self._retrievals.append(entry)

    def list_logs(self) -> list[LogEntry]:
        return list(self._logs)

    def list_requests(self) -> list[RequestHistoryEntry]:
        return list(self._requests)

    def list_retrievals(self) -> list[RetrievalHistoryEntry]:
        return list(self._retrievals)
