from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentChunk(BaseModel):
    chunk_id: str
    document_id: str
    workspace_id: str
    index: int
    content: str


class DocumentUploadResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    organization_id: UUID | None = None
    filename: str
    content_type: str
    file_size_bytes: int
    chunk_count: int
    is_processed: bool
    status: str = "processing"
    created_at: datetime

    model_config = {"from_attributes": True}
