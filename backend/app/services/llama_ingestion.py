"""LlamaIndex-backed PDF parsing and chunking.

Used for the document upload pipeline (PDFs only).
txt and docx continue through the existing chunking.py path.
"""

from __future__ import annotations

import io
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_CHARS_PER_TOKEN = 4  # rough approximation for chunk_size conversion


def parse_pdf_with_llama(file_bytes: bytes) -> str:
    """Extract text from a PDF using LlamaIndex's PDFReader.

    Falls back to pypdf on import error, and attempts OCR via pytesseract
    if text extraction yields nothing (scanned PDFs).
    """
    try:
        import tempfile, os
        from llama_index.readers.file import PDFReader

        reader = PDFReader()
        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
            tmp.write(file_bytes)
            tmp_path = tmp.name
        try:
            docs = reader.load_data(file=tmp_path)
            text = "\n\n".join(d.get_content() for d in docs if d.get_content().strip())
        finally:
            try:
                os.unlink(tmp_path)
            except OSError:
                pass

        if not text.strip():
            text = _try_ocr_fallback(file_bytes)
        return text
    except ImportError:
        logger.warning("llama_index.readers.file not available; falling back to pypdf")
        return _pypdf_fallback(file_bytes)


def chunk_with_sentence_splitter(
    text: str,
    chunk_size: int = 1500,
    chunk_overlap: int = 200,
) -> list[str]:
    """Chunk text using LlamaIndex's SentenceSplitter.

    chunk_size and chunk_overlap are in characters; internally converted to
    approximate token counts (÷4) so SentenceSplitter stays consistent with
    the rest of the system's character-budget settings.
    """
    try:
        from llama_index.core.node_parser import SentenceSplitter
        from llama_index.core.schema import Document as LlamaDocument

        token_size = max(64, chunk_size // _CHARS_PER_TOKEN)
        token_overlap = max(0, chunk_overlap // _CHARS_PER_TOKEN)

        splitter = SentenceSplitter(
            chunk_size=token_size,
            chunk_overlap=token_overlap,
        )
        doc = LlamaDocument(text=text)
        nodes = splitter.get_nodes_from_documents([doc])
        chunks = [node.get_content().strip() for node in nodes if node.get_content().strip()]
        return chunks if chunks else [text]
    except ImportError:
        logger.warning("llama_index.core not available; falling back to chunking.py")
        from app.services.chunking import chunk_text
        return chunk_text(text, chunk_size=chunk_size, overlap=chunk_overlap)


def _pypdf_fallback(file_bytes: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = []
    for i, page in enumerate(reader.pages, start=1):
        t = (page.extract_text() or "").strip()
        if t:
            pages.append(f"[PAGE {i}]\n{t}")
    return "\n\n".join(pages)


def _try_ocr_fallback(file_bytes: bytes) -> str:
    """Attempt OCR via pytesseract + pdf2image for scanned PDFs.

    Returns empty string if either library is not installed or OCR fails.
    """
    try:
        from pdf2image import convert_from_bytes  # type: ignore
        import pytesseract  # type: ignore

        images = convert_from_bytes(file_bytes)
        pages = []
        for i, img in enumerate(images, start=1):
            t = pytesseract.image_to_string(img).strip()
            if t:
                pages.append(f"[PAGE {i}]\n{t}")
        return "\n\n".join(pages)
    except ImportError:
        return ""
    except Exception as exc:
        logger.warning("OCR fallback failed: %s", exc)
        return ""
