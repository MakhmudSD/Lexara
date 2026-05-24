"""Document repository for database operations."""

from uuid import UUID
from typing import Optional, List
from sqlalchemy.orm import Session
from app.db.models import Document, DocumentChunk
from app.repositories import BaseRepository


class DocumentRepository(BaseRepository[Document]):
    """Repository for Document model."""
    
    def __init__(self, db: Session):
        super().__init__(db, Document)
    
    def get_by_workspace(self, workspace_id: UUID, skip: int = 0, limit: int = 100) -> List[Document]:
        """Get documents in a workspace."""
        return self.db.query(Document).filter(
            Document.workspace_id == workspace_id,
            Document.is_active == True
        ).offset(skip).limit(limit).all()
    
    def get_by_organization(self, org_id: UUID, skip: int = 0, limit: int = 100) -> List[Document]:
        """Get documents in an organization."""
        return self.db.query(Document).filter(
            Document.organization_id == org_id,
            Document.is_active == True
        ).offset(skip).limit(limit).all()
    
    def create_document(
        self,
        organization_id: UUID,
        workspace_id: UUID,
        filename: str,
        content_type: str,
        file_size_bytes: int,
        storage_path: str,
    ) -> Document:
        """Create a new document."""
        return self.create(
            organization_id=organization_id,
            workspace_id=workspace_id,
            filename=filename,
            content_type=content_type,
            file_size_bytes=file_size_bytes,
            storage_path=storage_path,
            is_active=True,
            is_processed=False,
            chunk_count=0,
        )
    
    def get_unprocessed_documents(self) -> List[Document]:
        """Get documents that haven't been processed yet."""
        return self.db.query(Document).filter(
            Document.is_processed == False,
            Document.is_active == True
        ).all()


class DocumentChunkRepository(BaseRepository[DocumentChunk]):
    """Repository for DocumentChunk model."""
    
    def __init__(self, db: Session):
        super().__init__(db, DocumentChunk)
    
    def get_by_document(self, document_id: UUID) -> List[DocumentChunk]:
        """Get all chunks for a document."""
        return self.db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id
        ).order_by(DocumentChunk.chunk_index).all()
    
    def get_with_embeddings(self, document_id: UUID) -> List[DocumentChunk]:
        """Get chunks with embeddings."""
        return self.db.query(DocumentChunk).filter(
            DocumentChunk.document_id == document_id,
            DocumentChunk.has_embedding == True
        ).all()
    
    def create_chunk(
        self,
        document_id: UUID,
        chunk_index: int,
        text: str,
    ) -> DocumentChunk:
        """Create a new chunk."""
        return self.create(
            document_id=document_id,
            chunk_index=chunk_index,
            text=text,
            has_embedding=False,
        )
    
    def update_chunk_embedding(self, chunk_id: UUID, embedding: List[float]) -> Optional[DocumentChunk]:
        """Update chunk with embedding."""
        chunk = self.get_by_id(chunk_id)
        if chunk:
            chunk.embedding = embedding
            chunk.has_embedding = True
            self.db.commit()
            self.db.refresh(chunk)
        return chunk
