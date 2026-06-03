"""Add description column to workspaces table

Revision ID: 018_workspace_description
Revises: 017_law_document_promulgation
Create Date: 2026-06-04
"""
revision = '018_workspace_description'
down_revision = '017_law_document_promulgation'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('workspaces', sa.Column('description', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('workspaces', 'description')
