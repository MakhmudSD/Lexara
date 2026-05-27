"""make organization_id optional across all tables

Revision ID: 008_make_org_id_optional
Revises: 007_workspace_org_optional
Create Date: 2026-05-27
"""
from alembic import op

revision = '008_make_org_id_optional'
down_revision = '007_workspace_org_optional'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.alter_column('documents', 'organization_id', nullable=True)
    op.alter_column('document_chunks', 'organization_id', nullable=True)

def downgrade() -> None:
    op.alter_column('documents', 'organization_id', nullable=False)
    op.alter_column('document_chunks', 'organization_id', nullable=False)
