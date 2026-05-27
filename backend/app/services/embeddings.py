"""Compatibility wrapper for embedding generation."""

from app.services.embedding_service import embed_query, embed_texts

__all__ = ["embed_query", "embed_texts"]
