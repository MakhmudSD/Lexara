from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class LogEntryResponse(BaseModel):
    request_id: str
    timestamp: str
    level: str
    stage: str
    message: str
    metadata: dict[str, Any] = Field(default_factory=dict)


class RequestHistoryResponse(BaseModel):
    request_id: str
    method: str
    path: str
    status_code: int
    duration_ms: float
    timestamp: str
    workspace_id: str | None = None
    document_id: str | None = None


class RetrievalItemResponse(BaseModel):
    document_id: str
    chunk_id: str
    score: float
    chunk_text: str


class RetrievalHistoryResponse(BaseModel):
    request_id: str
    workspace_id: str | None = None
    question: str
    top_k: int
    latency_ms: float | None = None
    timestamp: str
    results: list[RetrievalItemResponse]


class AdminDocumentResponse(BaseModel):
    document_id: str
    workspace_id: str
    filename: str
    content_type: str
    user_id: str | None = None
    chunk_count: int
    upload_time: str
    file_size: int


class HealthResponse(BaseModel):
    status: str
    uptime_seconds: float
    openai_configured: bool
    indexed_documents: int
    indexed_chunks: int
    persistence_backend: str
    vector_backend: str
    total_logs: int
    total_requests: int
    total_retrievals: int


class TokenUsageResponse(BaseModel):
    request_id: str
    workspace_id: str | None = None
    timestamp: str
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float
    latency_ms: float
    mode: str
    context_chunks_used: int


class TokenSummaryResponse(BaseModel):
    total_requests: int
    total_tokens: int
    total_cost_usd: float
    by_workspace: dict
    by_model: dict
    avg_latency_ms: float


class ConversationResponse(BaseModel):
    request_id: str
    workspace_id: str | None = None
    timestamp: str
    question: str
    answer: str | None = None
    mode: str
    sources: list[str]
    top_score: float | None = None
    history_turns: int
    latency_ms: float | None = None


class UserAdminResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str


class UserRoleUpdate(BaseModel):
    role: str = Field(..., pattern="^(user|admin)$")


class UserStatusUpdate(BaseModel):
    is_active: bool
