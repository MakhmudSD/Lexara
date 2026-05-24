from __future__ import annotations

from app.storage.models import DocumentRecord


class InMemoryDocumentStore:
    def __init__(self):
        self._documents: dict[str, DocumentRecord] = {}

    def save_document(self, document: DocumentRecord) -> None:
        self._documents[document.document_id] = document

    def store_document(self, document: DocumentRecord) -> None:
        self.save_document(document)

    def get_document(self, document_id: str) -> DocumentRecord | None:
        return self._documents.get(document_id)

    def list_documents(self) -> list[DocumentRecord]:
        return list(self._documents.values())

    def has_documents(self) -> bool:
        return bool(self._documents)

    def total_chunks(self) -> int:
        return sum(len(document.chunks) for document in self._documents.values())
