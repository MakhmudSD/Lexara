"""Create law_documents table

Revision ID: 015_law_documents
Revises: 015_workspace_invites
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = "015_law_documents"
down_revision = "014_document_status"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "law_documents",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("country", sa.String(10), nullable=False),
        sa.Column("law_id", sa.String(100), nullable=False),
        sa.Column("law_name", sa.String(500), nullable=False),
        sa.Column("law_type", sa.String(100), nullable=False, server_default=""),
        sa.Column("full_text", sa.Text(), nullable=False, server_default=""),
        sa.Column(
            "workspace_id",
            UUID(as_uuid=True),
            sa.ForeignKey("workspaces.id"),
            nullable=True,
        ),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_law_documents_country", "law_documents", ["country"])
    op.create_index("ix_law_documents_law_id", "law_documents", ["law_id"], unique=True)
    op.create_index("ix_law_documents_workspace_id", "law_documents", ["workspace_id"])
    op.create_index("ix_law_documents_is_active", "law_documents", ["is_active"])


def downgrade() -> None:
    op.drop_index("ix_law_documents_is_active", table_name="law_documents")
    op.drop_index("ix_law_documents_workspace_id", table_name="law_documents")
    op.drop_index("ix_law_documents_law_id", table_name="law_documents")
    op.drop_index("ix_law_documents_country", table_name="law_documents")
    op.drop_table("law_documents")
