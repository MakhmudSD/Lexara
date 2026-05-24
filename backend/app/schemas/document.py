from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class DocumentUploadResponse(BaseModel):
    id: UUID
    workspace_id: UUID
    organization_id: UUID
    filename: str
    content_type: str
    file_size_bytes: int
    chunk_count: int
    is_processed: bool
    status: str = "indexed"
    created_at: datetime

    model_config = {"from_attributes": True}
