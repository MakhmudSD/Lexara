from __future__ import annotations

from io import BytesIO

from pypdf import PdfReader


def extract_text_from_pdf_bytes(file_bytes: bytes) -> str:
    reader = PdfReader(BytesIO(file_bytes))
    return "\n".join(filter(None, (page.extract_text() for page in reader.pages)))
