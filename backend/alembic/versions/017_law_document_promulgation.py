"""Add promulgation_date and law_version to law_documents

Revision ID: 017_law_document_promulgation
Revises: 016_merge_heads
Create Date: 2026-06-03
"""
revision = '017_law_document_promulgation'
down_revision = '016_merge_heads'
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.add_column('law_documents', sa.Column('promulgation_date', sa.String(50), nullable=True))
    op.add_column('law_documents', sa.Column('law_version', sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column('law_documents', 'law_version')
    op.drop_column('law_documents', 'promulgation_date')
