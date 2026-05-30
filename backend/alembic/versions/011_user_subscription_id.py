"""Add subscription_id to users table.

Revision ID: 011_user_subscription_id
Revises: 010_user_plan
Create Date: 2026-05-30
"""
from alembic import op
import sqlalchemy as sa

revision = '011_user_subscription_id'
down_revision = '010_user_plan'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('subscription_id', sa.String(100), nullable=True))
    op.create_index('idx_user_subscription_id', 'users', ['subscription_id'])


def downgrade() -> None:
    op.drop_index('idx_user_subscription_id')
    op.drop_column('users', 'subscription_id')
