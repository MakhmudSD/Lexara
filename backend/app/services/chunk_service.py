"""Legacy chunking helper kept for compatibility."""

from __future__ import annotations

import re

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

    normalized = text.strip()
    if not normalized:
        return []

    sentences = re.split(r"(?<=[.!?])\s+", normalized)
    sentences = [sentence.strip() for sentence in sentences if sentence.strip()]

    if not sentences:
        return []

    chunks: list[str] = []
    current: list[str] = []
    current_len = 0

    for sentence in sentences:
        sentence_len = len(sentence)
        if current and current_len + sentence_len > chunk_size:
            chunks.append(" ".join(current))

            overlap_sentences: list[str] = []
            overlap_len = 0
            for current_sentence in reversed(current):
                current_sentence_len = len(current_sentence)
                if overlap_len + current_sentence_len <= overlap:
                    overlap_sentences.insert(0, current_sentence)
                    overlap_len += current_sentence_len
                else:
                    break

            current = overlap_sentences
            current_len = overlap_len

        current.append(sentence)
        current_len += sentence_len

    if current:
        chunks.append(" ".join(current))

    return chunks
