import logging
import os
import tempfile
from pathlib import Path
from uuid import UUID, uuid4

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.cache import get_retrieval_cache
from app.core.config import Settings
from app.core.dependencies import get_db, get_runtime
from app.core.entitlements import plan_limit
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db import SessionLocal
from app.db.models import Document, DocumentStatus, OrganizationMember, User, Workspace
from app.crud import document as document_crud
from app.schemas.document import DocumentUploadResponse
from app.services.file_parsers.docx_parser import parse_docx_bytes
from app.services.file_parsers.pdf_parser import parse_pdf_bytes
from app.services.file_parsers.txt_parser import parse_txt_bytes
from app.services.embedding_service import embed_texts
from app.services.pgvector_store import store_chunk_embedding
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


def _assert_workspace_access(workspace_id, user, db: Session) -> None:
    """Raise 403/404 if caller cannot access this workspace."""
    from uuid import UUID
    from app.db.models import UserWorkspace

    ws_id = workspace_id if isinstance(workspace_id, UUID) else UUID(str(workspace_id))

    ws = db.query(Workspace).filter(Workspace.id == ws_id).first()

    if ws is None:
        raise AppError(404, "workspace_not_found", "Workspace not found.")

    # Check direct workspace membership first
    workspace_member = (
        db.query(UserWorkspace)
        .filter(
            UserWorkspace.workspace_id == ws_id,
            UserWorkspace.user_id == user.id,
        )
        .first()
    )

    if workspace_member:
        return

    # Fall back to organization membership
    if ws.organization_id is not None:
        org_member = (
            db.query(OrganizationMember)
            .filter(
                OrganizationMember.organization_id == ws.organization_id,
                OrganizationMember.user_id == user.id,
            )
            .first()
        )

        if org_member:
            return

    raise AppError(
        403,
        "forbidden",
        "You do not have access to this workspace.",
    )
    """Raise 403/404 if caller cannot access this workspace."""
    from uuid import UUID
    ws_id = workspace_id if isinstance(workspace_id, UUID) else UUID(str(workspace_id))
    ws = db.query(Workspace).filter(Workspace.id == ws_id).first()
    if ws is None:
        raise AppError(404, "workspace_not_found", "Workspace not found.")
    if ws.organization_id is not None:
        member = db.query(OrganizationMember).filter(
            OrganizationMember.organization_id == ws.organization_id,
            OrganizationMember.user_id == user.id,
        ).first()
        if member is None:
            raise AppError(403, "forbidden", "You do not have access to this workspace.")


@router.get("", response_model=list[DocumentUploadResponse])
def list_documents(
    workspace_id: UUID = Query(...),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DocumentUploadResponse]:
    _assert_workspace_access(workspace_id, current_user, db)
    docs = (
        db.query(Document)
        .filter(Document.workspace_id == workspace_id, Document.is_active == True)  # noqa: E712
        .order_by(Document.created_at.desc())
        .limit(limit)
        .all()
    )
    return docs


@router.post("/upload", response_model=DocumentUploadResponse, status_code=202)
def upload_document(
    background_tasks: BackgroundTasks,
    workspace_id: UUID = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    runtime = Depends(get_runtime),
    current_user: User = Depends(get_current_user),
) -> JSONResponse:
    _assert_workspace_access(workspace_id, current_user, db)

    # enforce plan document limit per workspace
    doc_count = (
        db.query(Document)
        .filter(
            Document.workspace_id == workspace_id,
            Document.is_active == True,  # noqa: E712
        )
        .count()
    )
    max_docs = plan_limit(current_user, "max_documents_per_workspace")
    if doc_count >= max_docs:
        raise AppError(
            403,
            "document_limit_reached",
            f"Your plan allows {max_docs} document(s) per workspace. Upgrade for more.",
        )

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

    # Quick parse to verify the file has extractable text before accepting
    raw_text = _parse_uploaded_file(extension, file_bytes)
    if not raw_text.strip():
        raise AppError(400, "empty_document", "The uploaded document did not contain extractable text.")

    # Upload to R2 so the original binary is persisted.
    # Key: {workspace_id}/{document_id}/{filename}
    document_id = uuid4()
    r2_path: str | None = None
    if r2_service.is_configured():
        key = f"{workspace_id}/{document_id}/{filename}"
        try:
            r2_path = r2_service.upload_to_r2(file_bytes, key, content_type)
        except Exception as exc:
            logger.error("R2 upload failed for key %s: %s", key, exc)
            raise AppError(500, "storage_error", "File could not be saved to cloud storage. Please try again.") from exc

    # Resolve organization_id for this workspace
    from app.crud.workspace import get_workspace_or_404
    workspace = get_workspace_or_404(db, workspace_id)

    # Create the Document row immediately with PROCESSING status
    document = document_crud.create_document(
        db,
        organization_id=workspace.organization_id,
        workspace_id=workspace.id,
        filename=filename,
        content_type=content_type,
        file_size_bytes=len(file_bytes),
        storage_path=r2_path or "pending",
        raw_text=raw_text,
        document_id=document_id,
        status=DocumentStatus.PROCESSING,
    )
    db.commit()
    db.refresh(document)

    # Persist file bytes to a temp file for the background task to consume
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=extension)
    tmp.write(file_bytes)
    tmp.flush()
    tmp.close()
    temp_path = tmp.name

    background_tasks.add_task(
        _ingest_document_background,
        document_id=document.id,
        temp_path=temp_path,
        workspace_id=workspace_id,
        raw_text=raw_text,
        settings=runtime.settings,
    )

    response_data = DocumentUploadResponse(
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
    return JSONResponse(status_code=202, content=response_data.model_dump(mode="json"))


@router.delete("/{document_id}", status_code=204)
def delete_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    from app.crud.document import get_document_or_404
    from app.db.models import DocumentChunk

    doc = get_document_or_404(db, document_id)
    _assert_workspace_access(doc.workspace_id, current_user, db)

    db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).delete()
    db.delete(doc)
    db.commit()


@router.get("/{document_id}/download")
def download_document(
    document_id: UUID,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
    current_user: User = Depends(get_current_user),
):
    from app.crud.document import get_document_or_404
    from app.services import r2_storage

    doc = get_document_or_404(db, document_id)
    _assert_workspace_access(doc.workspace_id, current_user, db)
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


@router.get("/{document_id}/status")
def get_document_status(
    document_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Poll the processing status of a document."""
    doc = db.query(Document).filter(Document.id == document_id, Document.is_active == True).first()  # noqa: E712
    if doc is None:
        raise HTTPException(status_code=404, detail="Document not found")
    _assert_workspace_access(doc.workspace_id, current_user, db)
    return {
        "id": str(doc.id),
        "filename": doc.filename,
        "status": doc.status.value if doc.status else "processing",
        "chunk_count": doc.chunk_count,
        "error_message": doc.error_message,
    }


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


def _ingest_document_background(
    *,
    document_id: UUID,
    temp_path: str,
    workspace_id: UUID,
    raw_text: str,
    settings: Settings,
    _attempt: int = 1,
) -> None:
    """Chunk, embed, and index a document. Runs after the 202 response is returned.

    Uses its own DB session (cannot share the request session). Retries up to 3
    times on transient failures. On permanent failure the document status is set
    to FAILED and the error message is persisted.
    """
    import os as _os
    from app.services.chunking import chunk_text

    max_attempts = 3
    db = SessionLocal()
    try:
        document = db.query(Document).filter(Document.id == document_id).first()
        if document is None:
            logger.error("Background ingestion skipped: document %s not found", document_id)
            return

        _ext = _os.path.splitext(temp_path)[1].lower() if temp_path else ""
        if _ext == ".pdf":
            from app.services.llama_ingestion import chunk_with_sentence_splitter
            chunks = chunk_with_sentence_splitter(
                raw_text,
                chunk_size=settings.default_chunk_size,
                chunk_overlap=settings.default_chunk_overlap,
            )
        else:
            chunks = chunk_text(
                raw_text,
                chunk_size=settings.default_chunk_size,
                overlap=settings.default_chunk_overlap,
            )
        if not chunks:
            raise ValueError("No chunks were generated from the document text.")

        embeddings = embed_texts(chunks, settings)
        chunk_records = document_crud.create_chunks(
            db,
            document_id=document_id,
            chunks=chunks,
            embeddings=embeddings,
        )

        for chunk_record, chunk_text in zip(chunk_records, chunks):
            store_chunk_embedding(
                db=db,
                chunk_id=chunk_record.id,
                chunk_text=chunk_text,
                metadata={"workspace_id": str(document.workspace_id)},
                settings=settings,
            )

        document_crud.mark_document_processed(db, document_id, len(chunk_records))
        db.commit()
        get_retrieval_cache().clear()
        logger.info("Background ingestion done: doc=%s chunks=%d", document_id, len(chunk_records))
    except Exception as exc:
        db.rollback()
        if _attempt < max_attempts:
            import time
            wait = 2 ** _attempt  # 2s, 4s back-off
            logger.warning(
                "Background ingestion attempt %d/%d failed for doc %s, retrying in %ds: %s",
                _attempt, max_attempts, document_id, wait, exc,
            )
            time.sleep(wait)
            _ingest_document_background(
                document_id=document_id,
                temp_path=temp_path,
                workspace_id=workspace_id,
                raw_text=raw_text,
                settings=settings,
                _attempt=_attempt + 1,
            )
        else:
            logger.exception(
                "Background ingestion permanently failed after %d attempts for doc %s: %s",
                max_attempts, document_id, exc,
            )
            # Persist failure status so callers can poll the status endpoint
            try:
                fail_db = SessionLocal()
                document_crud.mark_document_failed(fail_db, document_id, str(exc))
                fail_db.commit()
                fail_db.close()
            except Exception:
                logger.exception("Failed to persist FAILED status for doc %s", document_id)
    finally:
        db.close()
        # Clean up the temp file
        try:
            import os as _os
            if _os.path.exists(temp_path):
                _os.unlink(temp_path)
        except Exception:
            pass
