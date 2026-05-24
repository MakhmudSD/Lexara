"""Text chunking for document ingestion."""

from app.core.exceptions import AppError


def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 100,
) -> list[str]:
    """
    Split text into overlapping chunks while preserving reasonable continuity.

    Chunks are character-based for MVP simplicity. Overlap helps avoid cutting
    sentences or concepts at boundaries.
    """
    if chunk_size <= 0:
        raise AppError(400, "invalid_chunk_size", "Chunk size must be greater than zero.")
    if overlap < 0 or overlap >= chunk_size:
        raise AppError(
            400,
            "invalid_chunk_overlap",
            "Chunk overlap must be zero or a positive value smaller than chunk size.",
        )

    normalized = text.strip()
    if not normalized:
        return []

    chunks: list[str] = []
    start = 0
    text_length = len(normalized)

    while start < text_length:
        end = min(start + chunk_size, text_length)
        chunk = normalized[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= text_length:
            break
        start = end - overlap

    return chunks
