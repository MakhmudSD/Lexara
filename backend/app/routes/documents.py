from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.schemas.document import DocumentUploadResponse
from app.services.document_processing import process_text_document

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".txt"}
ALLOWED_CONTENT_TYPES = {"text/plain", "application/octet-stream"}


@router.post("/upload", response_model=DocumentUploadResponse, status_code=201)
def upload_document(
    workspace_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> DocumentUploadResponse:
    filename = file.filename or "upload.txt"
    extension = _file_extension(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise AppError(
            400,
            "unsupported_file_type",
            "Only .txt files are supported in this MVP.",
        )

    content_type = file.content_type or "text/plain"
    if content_type not in ALLOWED_CONTENT_TYPES and not content_type.startswith("text/"):
        raise AppError(
            400,
            "unsupported_content_type",
            f"Unsupported content type: {content_type}",
        )

    file_bytes = file.file.read()
    if not file_bytes:
        raise AppError(400, "empty_file", "Uploaded file is empty.")
    if len(file_bytes) > runtime.settings.max_upload_size_bytes:
        raise AppError(400, "file_too_large", "Uploaded file exceeds the maximum allowed size.")

    try:
        raw_text = file_bytes.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise AppError(
            400,
            "invalid_text_encoding",
            "Text file must be UTF-8 encoded.",
        ) from exc

    document = process_text_document(
        db,
        runtime.vector_store,
        runtime.settings,
        workspace_id=workspace_id,
        filename=filename,
        content_type=content_type,
        file_bytes=file_bytes,
        raw_text=raw_text,
    )

    return DocumentUploadResponse(
        id=document.id,
        workspace_id=document.workspace_id,
        organization_id=document.organization_id,
        filename=document.filename,
        content_type=document.content_type,
        file_size_bytes=document.file_size_bytes,
        chunk_count=document.chunk_count,
        is_processed=document.is_processed,
        created_at=document.created_at,
    )


def _file_extension(filename: str) -> str:
    dot_index = filename.rfind(".")
    if dot_index == -1:
        return ""
    return filename[dot_index:].lower()
