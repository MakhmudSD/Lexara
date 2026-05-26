"""Persist token usage records to PostgreSQL."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision = "004_token_usage"
down_revision = "003_users_auth"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pgcrypto")
    op.create_table(
        "token_usage",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True, nullable=False, server_default=sa.text("gen_random_uuid()")),
        sa.Column("request_id", sa.String(length=64), nullable=True),
        sa.Column("workspace_id", sa.String(length=64), nullable=True),
        sa.Column("timestamp", sa.DateTime(), nullable=False, server_default=sa.text("now()")),
        sa.Column("model", sa.String(length=50), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("total_tokens", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("estimated_cost_usd", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("latency_ms", sa.Float(), nullable=False, server_default="0.0"),
        sa.Column("mode", sa.String(length=20), nullable=False, server_default="retrieval"),
        sa.Column("context_chunks_used", sa.Integer(), nullable=False, server_default="0"),
    )
    op.create_index("idx_token_usage_request_id", "token_usage", ["request_id"])
    op.create_index("idx_token_usage_workspace_id", "token_usage", ["workspace_id"])
    op.create_index("idx_token_usage_timestamp", "token_usage", ["timestamp"])


def downgrade() -> None:
    op.drop_index("idx_token_usage_timestamp", table_name="token_usage")
    op.drop_index("idx_token_usage_workspace_id", table_name="token_usage")
    op.drop_index("idx_token_usage_request_id", table_name="token_usage")
    op.drop_table("token_usage")
