"""Database migration helper."""

from alembic.config import Config
from alembic import command
from app.core.config import get_settings


def run_migrations():
    """Run all pending Alembic migrations."""
    settings = get_settings()
    
    alembic_cfg = Config("alembic.ini")
    alembic_cfg.set_main_option(
    "sqlalchemy.url",
    settings.database_url.replace("+asyncpg", "")
)    
    command.upgrade(alembic_cfg, "head")
    print("✅ Database migrations completed successfully")


if __name__ == "__main__":
    run_migrations()
