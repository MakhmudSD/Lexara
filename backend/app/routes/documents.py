import logging
from pathlib import Path
from uuid import UUID

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, UploadFile
from sqlalchemy.orm import Session

from app.core.cache import get_retrieval_cache
from app.core.config import Settings
from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.db import SessionLocal
from app.db.models import Document
from app.core.runtime import AppRuntime
from app.crud import document as document_crud
from app.schemas.document import DocumentUploadResponse
from app.services.document_processing import process_text_document
from app.services.file_parsers.docx_parser import parse_docx_bytes
from app.services.file_parsers.pdf_parser import parse_pdf_bytes
from app.services.file_parsers.txt_parser import parse_txt_bytes
from app.services.embeddings import embed_texts

router = APIRouter(prefix="/documents", tags=["documents"])
logger = logging.getLogger(__name__)

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
    background_tasks: BackgroundTasks,
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

    document, chunks = process_text_document(
        db,
        runtime.settings,
        workspace_id=workspace_id,
        filename=filename,
        content_type=content_type,
        file_bytes=file_bytes,
        raw_text=raw_text,
    )
    get_retrieval_cache().clear()
    background_tasks.add_task(
        _process_embeddings_background,
        document_id=document.id,
        chunks=chunks,
        settings=runtime.settings,
        vector_store=runtime.vector_store,
    )

    return DocumentUploadResponse(
        id=document.id,
        workspace_id=document.workspace_id,
        organization_id=document.organization_id,
        filename=document.filename,
        content_type=document.content_type,
        file_size_bytes=document.file_size_bytes,
        chunk_count=0,
        is_processed=False,
        status="processing",
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


def _process_embeddings_background(
    *,
    document_id: UUID,
    chunks: list[str],
    settings: Settings,
    vector_store,
) -> None:
    db = SessionLocal()
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if document is None:
            logger.error("Background embedding skipped: document %s not found", document_id)
            return

        embeddings = embed_texts(chunks, settings)
        chunk_records = document_crud.create_chunks(
            db,
            document_id=document_id,
            chunks=chunks,
            embeddings=embeddings,
        )
        vector_store.add_embeddings(
            workspace_id=str(document.workspace_id),
            chunk_ids=[str(chunk.id) for chunk in chunk_records],
            embeddings=embeddings,
        )

        document_crud.mark_document_processed(db, document_id, len(chunk_records))
        db.commit()
        get_retrieval_cache().clear()
    except Exception as exc:  # pragma: no cover - background logging
        db.rollback()
        logger.exception("Background embedding failed: %s", exc)
    finally:
        db.close()
