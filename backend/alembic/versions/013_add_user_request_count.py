"""Add request_count to users table.

Revision ID: 013_add_user_request_count
Revises: 012_support_tickets
Create Date: 2026-06-01
"""
from alembic import op
import sqlalchemy as sa

revision = '013_add_user_request_count'
down_revision = '012_support_tickets'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('request_count', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('users', 'request_count')
