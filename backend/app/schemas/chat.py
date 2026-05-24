from uuid import UUID

from pydantic import BaseModel, Field


class ChatQueryRequest(BaseModel):
    workspace_id: UUID
    question: str = Field(..., min_length=1, max_length=4000)
    top_k: int = Field(default=5, ge=1, le=20)


class RetrievedChunk(BaseModel):
    chunk_id: UUID
    document_id: UUID
    chunk_index: int
    text: str
    score: float


class ChatQueryResponse(BaseModel):
    workspace_id: UUID
    question: str
    top_k: int
    chunks: list[RetrievedChunk]
