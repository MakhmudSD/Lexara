from __future__ import annotations

from typing import Any

from app.observability.models import LogEntry


def build_event(
    *,
    request_id: str,
    event_type: str,
    stage: str,
    message: str,
    metadata: dict[str, Any] | None = None,
    workspace_id: str | None = None,
    document_id: str | None = None,
    level: str = "INFO",
) -> LogEntry:
    payload = {"event_type": event_type, **(metadata or {})}
    return LogEntry(
        request_id=request_id,
        level=level,
        stage=stage,
        message=message,
        workspace_id=workspace_id,
        document_id=document_id,
        metadata=payload,
    )
