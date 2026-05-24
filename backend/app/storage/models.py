from __future__ import annotations

from datetime import datetime, timezone

from pydantic import BaseModel, Field


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    workspace_id: str
    index: int
    content: str


class DocumentMetadata(BaseModel):
    upload_time: str = Field(default_factory=utc_now_iso)
    size_bytes: int


class DocumentRecord(BaseModel):
    document_id: str
    workspace_id: str
    filename: str
    raw_text: str
    chunks: list[DocumentChunk]
    embeddings: list[list[float]]
    content_type: str
    metadata: DocumentMetadata
    user_id: str | None = None
