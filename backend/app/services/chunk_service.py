from app.core.exceptions import AppError


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 100) -> list[str]:
    if chunk_size <= 0:
        raise AppError(400, "invalid_chunk_size", "Chunk size must be greater than zero.")
    if overlap < 0 or overlap >= chunk_size:
        raise AppError(
            400,
            "invalid_chunk_overlap",
            "Chunk overlap must be zero or a positive value smaller than chunk size.",
        )

    chunks: list[str] = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = min(start + chunk_size, text_length)
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap
        if end == text_length:
            break

    return chunks
