"""Workspace invites table (stub for branch compatibility)
Revision ID: 015_workspace_invites
Revises: 014_document_status
Create Date: 2026-06-03
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = '015_workspace_invites'
down_revision = '014_document_status'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.create_table(
        'workspace_invites',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', UUID(as_uuid=True), nullable=False),
        sa.Column('token', sa.String(64), nullable=False, unique=True),
        sa.Column('created_by', UUID(as_uuid=True), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), default=True, nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )

def downgrade() -> None:
    op.drop_table('workspace_invites')
