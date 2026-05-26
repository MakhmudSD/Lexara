"""Auth foundation - user role/password updates and user_workspaces."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "003_users_auth"
down_revision = "001_initial"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column("password_hash", new_column_name="hashed_password")
        batch_op.add_column(sa.Column("role", sa.String(length=20), nullable=False, server_default="user"))

    op.create_table(
        "user_workspaces",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("workspace_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False, server_default="owner"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "workspace_id", name="uq_user_workspace"),
    )
    op.create_index("idx_user_workspace_user_id", "user_workspaces", ["user_id"])
    op.create_index("idx_user_workspace_workspace_id", "user_workspaces", ["workspace_id"])


def downgrade() -> None:
    op.drop_index("idx_user_workspace_workspace_id", table_name="user_workspaces")
    op.drop_index("idx_user_workspace_user_id", table_name="user_workspaces")
    op.drop_table("user_workspaces")

    with op.batch_alter_table("users") as batch_op:
        batch_op.drop_column("role")
        batch_op.alter_column("hashed_password", new_column_name="password_hash")
