"""make workspace organization_id optional

Revision ID: 007_workspace_org_optional
Revises: 006_password_reset
Create Date: 2026-05-27
"""
from alembic import op

revision = '007_workspace_org_optional'
down_revision = '006_password_reset'
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.alter_column('workspaces', 'organization_id', nullable=True)

def downgrade() -> None:
    op.alter_column('workspaces', 'organization_id', nullable=False)
