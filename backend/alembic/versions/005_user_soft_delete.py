"""Add soft delete support to users."""

from alembic import op
import sqlalchemy as sa


revision = "005_user_soft_delete"
down_revision = "004_token_usage"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("deleted_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "deleted_at")
