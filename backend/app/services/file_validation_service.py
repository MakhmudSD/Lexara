from __future__ import annotations

from dataclasses import dataclass

from app.core.exceptions import AppError


@dataclass(frozen=True)
class SupportedFileType:
    extension: str
    content_types: set[str]


SUPPORTED_FILE_TYPES = {
    ".pdf": SupportedFileType(".pdf", {"application/pdf"}),
    ".docx": SupportedFileType(
        ".docx",
        {
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/octet-stream",
        },
    ),
    ".txt": SupportedFileType(".txt", {"text/plain", "application/octet-stream"}),
}


def validate_upload(
    filename: str | None,
    content_type: str | None,
    file_bytes: bytes,
    max_size_bytes: int,
) -> str:
    safe_filename = (filename or "").strip()
    if not safe_filename:
        raise AppError(400, "missing_filename", "Uploaded file must include a filename.")

    if "/" in safe_filename or "\\" in safe_filename:
        raise AppError(400, "invalid_filename", "Unsafe file paths are not allowed in uploads.")

    extension = _resolve_extension(safe_filename)
    supported_file_type = SUPPORTED_FILE_TYPES.get(extension)
    if supported_file_type is None:
        raise AppError(400, "invalid_file_extension", "Only PDF, DOCX, and TXT files are supported.")

    if content_type not in supported_file_type.content_types:
        raise AppError(400, "invalid_content_type", f"Uploaded content type is not valid for {extension} files.")

    if not file_bytes:
        raise AppError(400, "empty_file", "Uploaded file is empty.")

    if len(file_bytes) > max_size_bytes:
        raise AppError(413, "file_too_large", "Uploaded file exceeds the maximum allowed size.")

    return extension


def _resolve_extension(filename: str) -> str:
    parts = filename.lower().rsplit(".", 1)
    if len(parts) != 2:
        raise AppError(400, "missing_file_extension", "Uploaded file must have an extension.")
    return f".{parts[1]}"
