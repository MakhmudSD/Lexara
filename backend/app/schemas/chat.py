from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class ChatQueryRequest(BaseModel):
    workspace_id: UUID
    question: str = Field(..., min_length=1, max_length=4000)
    top_k: int = Field(default=5, ge=1, le=20)
    history: list[dict[str, Any]] = Field(default_factory=list)

    @field_validator("history", mode="before")
    @classmethod
    def trim_history(cls, value: Any) -> list[dict[str, Any]]:
        if not isinstance(value, list):
            return []
        return list(value)[-6:]


class RetrievedChunk(BaseModel):
    chunk_id: UUID
    document_id: UUID
    filename: str | None = None
    chunk_index: int
    text: str
    score: float


class ChatQueryResponse(BaseModel):
    answer: str | None = None
    sources: list[RetrievedChunk]
    mode: Literal["rag", "retrieval"]
