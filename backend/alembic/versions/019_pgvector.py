"""Add pgvector extension and chunks metadata column

Revision ID: 019
Revises: 018
"""

from alembic import op

revision = "019"
down_revision = '018_workspace_description'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Enable pgvector extension.
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # Add metadata column to document_chunks table if not exists.
    op.execute(
        """
        ALTER TABLE document_chunks
        ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb
        """
    )

    # Add pgvector embedding column (1536 dims for text-embedding-3-small).
    op.execute(
        """
        ALTER TABLE document_chunks
        ADD COLUMN IF NOT EXISTS pgvector_embedding vector(1536)
        """
    )

    # Create HNSW index for fast similarity search.
    op.execute(
        """
        CREATE INDEX IF NOT EXISTS document_chunks_pgvector_idx
        ON document_chunks
        USING hnsw (pgvector_embedding vector_cosine_ops)
        WITH (m = 16, ef_construction = 64)
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS document_chunks_pgvector_idx")
    op.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS pgvector_embedding")
    op.execute("ALTER TABLE document_chunks DROP COLUMN IF EXISTS metadata")
