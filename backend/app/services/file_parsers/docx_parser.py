from __future__ import annotations

from io import BytesIO

from app.core.exceptions import AppError

try:
    from docx import Document
except ImportError:  # pragma: no cover
    Document = None


def parse_docx_bytes(file_bytes: bytes) -> str:
    if Document is None:
        raise AppError(
            500,
            "docx_parser_unavailable",
            "DOCX support is not installed on the server.",
        )
    try:
        document = Document(BytesIO(file_bytes))
        return "\n".join(paragraph.text for paragraph in document.paragraphs if paragraph.text)
    except AppError:
        raise
    except Exception as exc:
        raise AppError(
            400,
            "corrupt_file",
            "Unable to read this file — it may be corrupted or not a valid DOCX.",
        ) from exc
