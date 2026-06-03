"""Merge law_documents and workspace_invites heads
Revision ID: 016_merge_heads
Revises: 015_law_documents, 015_workspace_invites
Create Date: 2026-06-03
"""
revision = '016_merge_heads'
down_revision = ('015_law_documents', '015_workspace_invites')
branch_labels = None
depends_on = None

def upgrade() -> None:
    pass

def downgrade() -> None:
    pass
