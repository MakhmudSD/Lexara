from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ChatRequest(BaseModel):
    workspace_id: str = Field(..., min_length=1)
    user_id: str | None = Field(default=None, min_length=1, max_length=128)
    question: str = Field(..., min_length=1, max_length=4000)
    top_k: int = Field(default=3, ge=1, le=20)
    debug: bool = False


class ChatSource(BaseModel):
    document_id: str
    chunk_id: str
    filename: str
    score: float
    text: str


class PipelineStepResponse(BaseModel):
    stage: str
    status: str
    latency_ms: float
    metadata: dict[str, Any] = Field(default_factory=dict)


class ChatDebugResponse(BaseModel):
    chunks_used: list[str]
    scores: list[float]
    latency: dict[str, float]
    pipeline_steps: list[PipelineStepResponse]


class ChatResponse(BaseModel):
    request_id: str
    answer: str
    sources: list[ChatSource]
    latency: dict[str, float]
    retrieval_scores: list[float]
    metadata: dict[str, Any] = Field(default_factory=dict)
    debug: ChatDebugResponse | None = None
