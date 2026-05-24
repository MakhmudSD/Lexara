from __future__ import annotations

import time
import uuid

from fastapi import UploadFile

from app.api.schemas.upload import UploadResponse
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.observability.models import PipelineStepEntry
from app.services.chunk_service import chunk_text
from app.services.embedding_service import generate_embeddings
from app.services.file_parsers.docx_parser import parse_docx_bytes
from app.services.file_parsers.pdf_parser import parse_pdf_bytes
from app.services.file_parsers.txt_parser import parse_txt_bytes
from app.services.file_validation_service import validate_upload
from app.storage.models import DocumentChunk, DocumentMetadata, DocumentRecord


async def handle_upload(
    runtime: AppRuntime,
    upload: UploadFile,
    user_id: str | None,
    workspace_id: str | None,
    request_id: str,
) -> UploadResponse:
    stage_metrics: list[PipelineStepEntry] = []
    resolved_workspace_id = workspace_id or str(uuid.uuid4())

    upload_started = time.perf_counter()
    file_bytes = await upload.read()
    file_extension = validate_upload(
        filename=upload.filename,
        content_type=upload.content_type,
        file_bytes=file_bytes,
        max_size_bytes=runtime.settings.max_upload_size_bytes,
    )
    upload_latency = round((time.perf_counter() - upload_started) * 1000, 3)
    stage_metrics.append(
        PipelineStepEntry(
            stage="upload",
            status="completed",
            latency_ms=upload_latency,
            metadata={"filename": upload.filename or "unknown"},
        )
    )
    runtime.observability.add_event(
        request_id=request_id,
        event_type="upload_validated",
        stage="upload",
        message="Validated uploaded document.",
        metadata={
            "filename": upload.filename,
            "size_bytes": len(file_bytes),
            "extension": file_extension,
            "user_id": user_id,
            "workspace_id": resolved_workspace_id,
        },
        workspace_id=resolved_workspace_id,
    )

    extraction_started = time.perf_counter()
    extracted_text = _parse_uploaded_file(file_extension=file_extension, file_bytes=file_bytes)
    if not extracted_text.strip():
        raise AppError(400, "empty_document", "The uploaded document did not contain extractable text.")
    extraction_latency = round((time.perf_counter() - extraction_started) * 1000, 3)
    stage_metrics.append(
        PipelineStepEntry(
            stage="extraction",
            status="completed",
            latency_ms=extraction_latency,
            metadata={"characters": len(extracted_text)},
        )
    )
    runtime.observability.add_event(
        request_id=request_id,
        event_type="text_extracted",
        stage="extraction",
        message="Extracted text from uploaded document.",
        metadata={"characters": len(extracted_text), "latency_ms": extraction_latency},
        workspace_id=resolved_workspace_id,
    )

    chunking_started = time.perf_counter()
    chunks = chunk_text(
        extracted_text,
        chunk_size=runtime.settings.default_chunk_size,
        overlap=runtime.settings.default_chunk_overlap,
    )
    if not chunks:
        raise AppError(400, "no_chunks_generated", "No chunks were generated from the uploaded document.")
    chunking_latency = round((time.perf_counter() - chunking_started) * 1000, 3)
    stage_metrics.append(
        PipelineStepEntry(
            stage="chunking",
            status="completed",
            latency_ms=chunking_latency,
            metadata={"chunk_count": len(chunks)},
        )
    )
    runtime.observability.add_event(
        request_id=request_id,
        event_type="chunks_created",
        stage="chunking",
        message="Split document into chunks.",
        metadata={"chunk_count": len(chunks), "latency_ms": chunking_latency},
        workspace_id=resolved_workspace_id,
    )

    embedding_started = time.perf_counter()
    embeddings = generate_embeddings(chunks, runtime.settings)
    embedding_latency = round((time.perf_counter() - embedding_started) * 1000, 3)
    stage_metrics.append(
        PipelineStepEntry(
            stage="embedding",
            status="completed",
            latency_ms=embedding_latency,
            metadata={"embedding_count": len(embeddings)},
        )
    )
    runtime.observability.add_event(
        request_id=request_id,
        event_type="embeddings_generated",
        stage="embedding",
        message="Generated embeddings for document chunks.",
        metadata={"embedding_count": len(embeddings), "latency_ms": embedding_latency},
        workspace_id=resolved_workspace_id,
    )

    document_id = str(uuid.uuid4())
    document = DocumentRecord(
        document_id=document_id,
        workspace_id=resolved_workspace_id,
        filename=upload.filename or f"uploaded{file_extension}",
        raw_text=extracted_text,
        chunks=[
            DocumentChunk(
                chunk_id=f"{document_id}:{index}",
                document_id=document_id,
                workspace_id=resolved_workspace_id,
                index=index,
                content=chunk,
            )
            for index, chunk in enumerate(chunks)
        ],
        embeddings=embeddings,
        content_type=upload.content_type or "application/octet-stream",
        metadata=DocumentMetadata(size_bytes=len(file_bytes)),
        user_id=user_id,
    )
    runtime.documents.save_document(document)
    runtime.vector_store.add_document_embeddings(
        document_id=document_id,
        workspace_id=resolved_workspace_id,
        embeddings=document.embeddings,
        chunk_ids=[chunk.chunk_id for chunk in document.chunks],
        index_positions=[chunk.index for chunk in document.chunks],
        user_id=user_id,
    )

    runtime.observability.add_event(
        request_id=request_id,
        event_type="document_indexed",
        stage="upload",
        message="Indexed uploaded document.",
        metadata={
            "document_id": document_id,
            "workspace_id": resolved_workspace_id,
            "chunk_count": len(document.chunks),
            "user_id": user_id,
            "pipeline_steps": [
                step.model_dump() if hasattr(step, "model_dump") else step.dict()
                for step in stage_metrics
            ],
        },
        workspace_id=resolved_workspace_id,
        document_id=document_id,
    )

    return UploadResponse(
        request_id=request_id,
        document_id=document_id,
        workspace_id=resolved_workspace_id,
        filename=document.filename,
        chunk_count=len(document.chunks),
        content_type=document.content_type,
        status="indexed",
        user_id=user_id,
    )


def _parse_uploaded_file(file_extension: str, file_bytes: bytes) -> str:
    parsers = {
        ".pdf": parse_pdf_bytes,
        ".docx": parse_docx_bytes,
        ".txt": parse_txt_bytes,
    }
    parser = parsers.get(file_extension)
    if parser is None:
        raise AppError(400, "unsupported_file_type", "Unsupported uploaded file type.")
    return parser(file_bytes)
