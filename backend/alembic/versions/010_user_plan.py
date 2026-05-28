"""Add plan, plan_expires_at, referral_code to users; add user_id to token_usage; add referrals table.

Revision ID: 010_user_plan
Revises: 009_conversations
Create Date: 2026-05-28
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '010_user_plan'
down_revision = '009_conversations'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add plan fields to users
    op.add_column('users', sa.Column('plan', sa.String(50), nullable=False, server_default='free'))
    op.add_column('users', sa.Column('plan_expires_at', sa.DateTime(), nullable=True))
    op.add_column('users', sa.Column('referral_code', sa.String(20), nullable=True))
    op.create_index('idx_user_referral_code', 'users', ['referral_code'], unique=True)

    # Add user_id to token_usage for per-user quota counting
    op.add_column('token_usage', sa.Column('user_id', sa.String(64), nullable=True))
    op.create_index('idx_token_usage_user_id', 'token_usage', ['user_id'])

    # Create referrals table
    op.create_table(
        'referrals',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referrer_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('referred_user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('code', sa.String(20), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('converted_at', sa.DateTime(), nullable=True),
        sa.Column('rewarded_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['referrer_id'], ['users.id']),
        sa.ForeignKeyConstraint(['referred_user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_referral_code'),
    )
    op.create_index('idx_referral_referrer_id', 'referrals', ['referrer_id'])
    op.create_index('idx_referral_code', 'referrals', ['code'])
    op.create_index('idx_referral_status', 'referrals', ['status'])


def downgrade() -> None:
    op.drop_index('idx_referral_status')
    op.drop_index('idx_referral_code')
    op.drop_index('idx_referral_referrer_id')
    op.drop_table('referrals')
    op.drop_index('idx_token_usage_user_id')
    op.drop_column('token_usage', 'user_id')
    op.drop_index('idx_user_referral_code')
    op.drop_column('users', 'referral_code')
    op.drop_column('users', 'plan_expires_at')
    op.drop_column('users', 'plan')
