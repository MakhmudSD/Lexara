"""Database migration helper."""
import logging

from alembic.config import Config
from alembic import command

logger = logging.getLogger(__name__)


def run_migrations() -> None:
    """Run all pending Alembic migrations."""
    import os
    from app.core.monitoring import init_sentry

    alembic_cfg = Config()
    backend_dir = os.path.join(os.path.dirname(__file__), "../..")
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))

    from app.core.config import get_settings as _get_settings
    _settings = _get_settings()
    alembic_cfg.set_main_option("sqlalchemy.url", _settings.database_url.replace("+asyncpg", ""))
    command.upgrade(alembic_cfg, "head")
    init_sentry(_settings.sentry_dsn, _settings.environment)
    logger.info("database_migrations_completed")


def run_startup_cleanup() -> None:
    """Run cleanup once on startup."""
    try:
        from app.db import SessionLocal
        from app.services.cleanup_service import cleanup_old_records
        db = SessionLocal()
        result = cleanup_old_records(db)
        logger.info(f"Startup cleanup complete: {result}")
    except Exception as e:
        logger.warning(f"Startup cleanup skipped: {e}")
    finally:
        try:
            db.close()
        except Exception:
            pass


if __name__ == "__main__":
    run_migrations()
