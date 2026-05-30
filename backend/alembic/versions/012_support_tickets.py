"""Add support_tickets table.

Revision ID: 012_support_tickets
Revises: 011_user_subscription_id
Create Date: 2026-05-30
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '012_support_tickets'
down_revision = '011_user_subscription_id'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'support_tickets',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('answer', sa.Text(), nullable=True),
        sa.Column('answered_by', postgresql.UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('is_public', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('answered_at', sa.DateTime(), nullable=True),
    )
    op.create_index('idx_support_ticket_user_id', 'support_tickets', ['user_id'])
    op.create_index('idx_support_ticket_is_public', 'support_tickets', ['is_public'])


def downgrade() -> None:
    op.drop_index('idx_support_ticket_is_public')
    op.drop_index('idx_support_ticket_user_id')
    op.drop_table('support_tickets')
