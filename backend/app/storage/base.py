from __future__ import annotations

from typing import Protocol

from app.storage.models import DocumentChunk, DocumentRecord


class DocumentStore(Protocol):
    def save_document(self, document: DocumentRecord) -> None: ...

    def get_document(
        self,
        document_id: str,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> DocumentRecord | None: ...

    def list_documents(
        self,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> list[DocumentRecord]: ...

    def get_document_chunks(
        self,
        document_id: str,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> list[DocumentChunk]: ...

    def get_document_embeddings(
        self,
        document_id: str,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> list[list[float]]: ...

    def get_workspace_documents(
        self,
        workspace_id: str,
        user_id: str | None = None,
    ) -> list[DocumentRecord]: ...

    def get_workspace_chunks(
        self,
        workspace_id: str,
        user_id: str | None = None,
    ) -> list[DocumentChunk]: ...

    def get_workspace_embeddings(
        self,
        workspace_id: str,
        user_id: str | None = None,
    ) -> list[list[float]]: ...

    def get_chunks_by_ids(
        self,
        workspace_id: str,
        chunk_ids: list[str],
        user_id: str | None = None,
    ) -> list[DocumentChunk]: ...

    def has_documents(
        self,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> bool: ...

    def total_chunks(
        self,
        user_id: str | None = None,
        workspace_id: str | None = None,
    ) -> int: ...
