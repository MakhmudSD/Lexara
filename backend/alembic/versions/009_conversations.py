"""Add conversations and conversation_turns tables.

Revision ID: 009_conversations
Revises: 008_make_org_id_optional
Create Date: 2026-05-27
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '009_conversations'
down_revision = '008_make_org_id_optional'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'conversations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_conversation_workspace_id', 'conversations', ['workspace_id'])
    op.create_index('idx_conversation_is_active', 'conversations', ['is_active'])

    op.create_table(
        'conversation_turns',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('conversation_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('turn_index', sa.Integer(), nullable=False),
        sa.Column('question', sa.Text(), nullable=False),
        sa.Column('answer', sa.Text(), nullable=False),
        sa.Column('sources', postgresql.JSON(), nullable=False, server_default='[]'),
        sa.Column('latency_ms', sa.Float(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['conversation_id'], ['conversations.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('conversation_id', 'turn_index',
                            name='uq_conversation_turn'),
    )
    op.create_index('idx_turn_conversation_id', 'conversation_turns',
                    ['conversation_id'])


def downgrade() -> None:
    op.drop_index('idx_turn_conversation_id')
    op.drop_table('conversation_turns')
    op.drop_index('idx_conversation_is_active')
    op.drop_index('idx_conversation_workspace_id')
    op.drop_table('conversations')
