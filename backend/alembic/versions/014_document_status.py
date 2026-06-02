"""Add status and error_message to documents

Revision ID: 014_document_status
Revises: 013_add_user_request_count
Create Date: 2026-06-02
"""
from alembic import op
import sqlalchemy as sa

revision = "014_document_status"
down_revision = "013_add_user_request_count"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE TYPE documentstatus AS ENUM ('pending', 'processing', 'ready', 'failed')")
    op.add_column(
        "documents",
        sa.Column(
            "status",
            sa.Enum("pending", "processing", "ready", "failed", name="documentstatus"),
            nullable=False,
            server_default="processing",
        ),
    )
    op.add_column("documents", sa.Column("error_message", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("documents", "error_message")
    op.drop_column("documents", "status")
    op.execute("DROP TYPE documentstatus")
