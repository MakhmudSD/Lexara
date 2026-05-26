from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.core.cache import get_retrieval_cache
from app.schemas.document import DocumentUploadResponse
from app.services.document_processing import process_text_document
from app.services.file_parsers.docx_parser import parse_docx_bytes
from app.services.file_parsers.pdf_parser import parse_pdf_bytes
from app.services.file_parsers.txt_parser import parse_txt_bytes

router = APIRouter(prefix="/documents", tags=["documents"])

ALLOWED_EXTENSIONS = {".txt", ".pdf", ".docx"}
ALLOWED_CONTENT_TYPES = {
    ".txt": {"text/plain", "application/octet-stream"},
    ".pdf": {"application/pdf"},
    ".docx": {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/octet-stream",
    },
}


@router.post("/upload", response_model=DocumentUploadResponse, status_code=201)
def upload_document(
    workspace_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> DocumentUploadResponse:
    safe_filename = Path(file.filename or "").name
    if not safe_filename or safe_filename.startswith("."):
        raise AppError(400, "invalid_filename", "Invalid filename.")
    filename = safe_filename
    extension = _file_extension(filename)
    if extension not in ALLOWED_EXTENSIONS:
        raise AppError(
            400,
            "unsupported_file_type",
            "Only .txt, .pdf, and .docx files are supported.",
        )

    content_type = (file.content_type or "application/octet-stream").lower()
    allowed_content_types = ALLOWED_CONTENT_TYPES[extension]
    if content_type not in allowed_content_types and not (
        extension == ".txt" and content_type.startswith("text/")
    ):
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

    raw_text = _parse_uploaded_file(extension, file_bytes)
    if not raw_text.strip():
        raise AppError(400, "empty_document", "The uploaded document did not contain extractable text.")

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
    get_retrieval_cache().clear()

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


def _parse_uploaded_file(extension: str, file_bytes: bytes) -> str:
    parsers = {
        ".txt": parse_txt_bytes,
        ".pdf": parse_pdf_bytes,
        ".docx": parse_docx_bytes,
    }
    parser = parsers.get(extension)
    if parser is None:
        raise AppError(400, "unsupported_file_type", "Unsupported uploaded file type.")
    return parser(file_bytes)
