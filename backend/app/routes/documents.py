import logging
import os
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, Query, UploadFile
from fastapi.responses import FileResponse
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
from app.services import r2_service

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


@router.get("", response_model=list[DocumentUploadResponse])
def list_documents(
    workspace_id: UUID = Query(...),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
) -> list[DocumentUploadResponse]:
    docs = (
        db.query(Document)
        .filter(Document.workspace_id == workspace_id, Document.is_active == True)  # noqa: E712
        .order_by(Document.created_at.desc())
        .limit(limit)
        .all()
    )
    return docs


@router.post("/upload", response_model=DocumentUploadResponse, status_code=201)
def upload_document(
    background_tasks: BackgroundTasks,
    workspace_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> DocumentUploadResponse:
    raw_name = Path(file.filename or "").name
    if not raw_name or raw_name.startswith("."):
        raise AppError(400, "invalid_filename", "Invalid filename.")
    # Strip HTML/script tags and control characters to prevent XSS via filename
    import re
    safe_filename = re.sub(r"[<>\"'&;]", "_", raw_name)
    safe_filename = re.sub(r"[\x00-\x1f\x7f]", "", safe_filename)
    filename = safe_filename[:255]
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

    # Upload to R2 *before* text extraction so the original binary is persisted
    # even if the parsing step fails.  Key: {workspace_id}/{document_id}/{filename}
    document_id = uuid4()
    r2_path: str | None = None
    if r2_service.is_configured():
        key = f"{workspace_id}/{document_id}/{filename}"
        try:
            r2_path = r2_service.upload_to_r2(file_bytes, key, content_type)
        except Exception as exc:
            logger.error("R2 upload failed for key %s: %s", key, exc)
            raise AppError(500, "storage_error", "File could not be saved to cloud storage. Please try again.") from exc

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
        document_id=document_id,
        storage_path=r2_path,
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


@router.get("/{document_id}/download")
def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
):
    from app.crud.document import get_document_or_404
    from app.services import r2_storage

    doc = get_document_or_404(db, document_id)
    storage_path = doc.storage_path or ""

    # --- R2 path: storage_path starts with "r2://" ---
    if storage_path.startswith("r2://"):
        try:
            file_bytes = r2_storage.download_file(runtime.settings, storage_path)
        except Exception as exc:
            logger.warning("R2 download failed for doc %s: %s", document_id, exc)
            raise AppError(
                404,
                "file_not_found",
                f"File '{doc.filename}' could not be retrieved from storage.",
            )
        from fastapi.responses import Response
        return Response(
            content=file_bytes,
            media_type="application/octet-stream",
            headers={"Content-Disposition": f'attachment; filename="{doc.filename}"'},
        )

    # --- Local disk fallback: legacy paths and development ---
    upload_dir = os.getenv("UPLOADS_DATA_DIR", "data/uploads")
    possible_paths = [
        storage_path,  # absolute path stored at upload time (most common)
        os.path.join(upload_dir, str(document_id), doc.filename),
        os.path.join(upload_dir, doc.filename),
        os.path.join(upload_dir, f"{document_id}_{doc.filename}"),
    ]

    file_path = None
    for path in possible_paths:
        if path and os.path.exists(path):
            file_path = path
            break

    if not file_path:
        raise AppError(
            404,
            "file_not_found",
            f"File '{doc.filename}' is no longer available. "
            "Upload the document again or configure R2 for persistent storage.",
        )

    return FileResponse(
        path=file_path,
        filename=doc.filename,
        media_type="application/octet-stream",
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
    _attempt: int = 1,
) -> None:
    """Run embedding + vector store indexing for a document.

    Retries up to 3 times on transient failures. Railway restarts kill
    in-flight background tasks, so keep processing idempotent — chunks
    and embeddings are upserted, not duplicated.
    """
    max_attempts = 3
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
        logger.info("Background embedding done: doc=%s chunks=%d", document_id, len(chunk_records))
    except Exception as exc:  # pragma: no cover - background logging
        db.rollback()
        if _attempt < max_attempts:
            import time
            wait = 2 ** _attempt  # 2s, 4s back-off
            logger.warning(
                "Background embedding attempt %d/%d failed for doc %s, retrying in %ds: %s",
                _attempt, max_attempts, document_id, wait, exc,
            )
            time.sleep(wait)
            _process_embeddings_background(
                document_id=document_id,
                chunks=chunks,
                settings=settings,
                vector_store=vector_store,
                _attempt=_attempt + 1,
            )
        else:
            logger.exception(
                "Background embedding permanently failed after %d attempts for doc %s",
                max_attempts, document_id,
            )
    finally:
        db.close()
