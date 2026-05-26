from __future__ import annotations

import logging
import time
from collections import deque

from app.core.config import Settings
from app.observability.events import build_event
from app.observability.models import (
    ConversationEntry,
    LogEntry,
    RequestHistoryEntry,
    RetrievalHistoryEntry,
    TokenUsageEntry,
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
        self._token_usage: deque[TokenUsageEntry] = deque(maxlen=500)
        self._conversations: deque[ConversationEntry] = deque(maxlen=200)
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

    def add_token_usage(self, entry: TokenUsageEntry) -> None:
        self._token_usage.append(entry)

    def list_token_usage(self) -> list[TokenUsageEntry]:
        return list(self._token_usage)

    def get_token_summary(self) -> dict:
        entries = list(self._token_usage)
        total_requests = len(entries)
        total_tokens = sum(item.total_tokens for item in entries)
        total_cost = sum(item.estimated_cost_usd for item in entries)
        avg_latency_ms = (
            round(sum(item.latency_ms for item in entries) / total_requests, 3)
            if total_requests
            else 0.0
        )

        by_workspace: dict[str, dict[str, float | int]] = {}
        by_model: dict[str, dict[str, float | int]] = {}

        for item in entries:
            workspace_key = item.workspace_id or "unknown"
            workspace_stats = by_workspace.setdefault(
                workspace_key,
                {"tokens": 0, "cost": 0.0, "requests": 0},
            )
            workspace_stats["tokens"] += item.total_tokens
            workspace_stats["cost"] += item.estimated_cost_usd
            workspace_stats["requests"] += 1

            model_stats = by_model.setdefault(
                item.model,
                {"tokens": 0, "cost": 0.0, "requests": 0},
            )
            model_stats["tokens"] += item.total_tokens
            model_stats["cost"] += item.estimated_cost_usd
            model_stats["requests"] += 1

        for stats in by_workspace.values():
            stats["cost"] = round(float(stats["cost"]), 4)
        for stats in by_model.values():
            stats["cost"] = round(float(stats["cost"]), 4)

        return {
            "total_requests": total_requests,
            "total_tokens": total_tokens,
            "total_cost_usd": round(total_cost, 4),
            "by_workspace": by_workspace,
            "by_model": by_model,
            "avg_latency_ms": avg_latency_ms,
        }

    def add_conversation(self, entry: ConversationEntry) -> None:
        self._conversations.append(entry)

    def list_conversations(self) -> list[ConversationEntry]:
        return list(reversed(self._conversations))
