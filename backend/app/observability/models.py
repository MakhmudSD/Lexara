from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class LogEntry(BaseModel):
    request_id: str
    timestamp: str = Field(default_factory=utc_now_iso)
    level: str
    stage: str
    message: str
    workspace_id: str | None = None
    document_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class RequestHistoryEntry(BaseModel):
    request_id: str
    method: str
    path: str
    status_code: int
    duration_ms: float
    timestamp: str = Field(default_factory=utc_now_iso)
    workspace_id: str | None = None
    document_id: str | None = None


class RetrievalResultEntry(BaseModel):
    document_id: str
    chunk_id: str
    score: float
    chunk_text: str


class RetrievalHistoryEntry(BaseModel):
    request_id: str
    workspace_id: str | None = None
    question: str
    top_k: int
    latency_ms: float | None = None
    timestamp: str = Field(default_factory=utc_now_iso)
    results: list[RetrievalResultEntry]


class PipelineStepEntry(BaseModel):
    stage: str
    status: str
    latency_ms: float
    metadata: dict[str, Any] = Field(default_factory=dict)
