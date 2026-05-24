from pydantic import BaseModel, Field


class UploadFormData(BaseModel):
    user_id: str | None = Field(default=None, min_length=1, max_length=128)
    workspace_id: str | None = Field(default=None, min_length=1, max_length=128)


class UploadResponse(BaseModel):
    request_id: str
    document_id: str
    workspace_id: str
    filename: str
    chunk_count: int
    content_type: str
    status: str
    user_id: str | None = None
