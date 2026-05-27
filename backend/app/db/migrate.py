"""Database migration helper."""

import logging

from alembic.config import Config
from alembic import command
from app.core.config import get_settings
from app.core.monitoring import init_sentry
from app.db import SessionLocal
from app.services.cleanup_service import cleanup_old_records

logger = logging.getLogger(__name__)

def run_migrations() -> None:
    """Run all pending Alembic migrations."""
    settings = get_settings()

    import os
    alembic_cfg = Config()
    backend_dir = os.path.join(os.path.dirname(__file__), "../..")
    alembic_cfg.set_main_option("script_location", os.path.join(backend_dir, "alembic"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url.replace("+asyncpg", ""))
    command.upgrade(alembic_cfg, "head")
    init_sentry(settings.sentry_dsn, settings.environment)
#    run_startup_cleanup()
    logger.info("database_migrations_completed")
    import threading
    def _bg_rebuild():
        try:
            from app.services.faiss_rebuild import rebuild_faiss_from_db as _rebuild
            from app.db import SessionLocal as _SessionLocal
            from app.core.config import get_settings as _get_settings
            _db = _SessionLocal()
            n = _rebuild(_db, _get_settings())
            _db.close()
            logger.info(f"FAISS rebuild complete: {n} workspaces indexed")
        except Exception as _e:
            logger.warning(f"FAISS rebuild skipped: {_e}")
    threading.Thread(target=_bg_rebuild, daemon=True).start()
    logger.info("FAISS rebuild started in background")
    import threading
    def _bg_rebuild():
        try:
            from app.services.faiss_rebuild import rebuild_faiss_from_db as _rebuild
            from app.db import SessionLocal as _SessionLocal
            from app.core.config import get_settings as _get_settings
            _db = _SessionLocal()
            n = _rebuild(_db, _get_settings())
            _db.close()
            logger.info(f"FAISS rebuild complete: {n} workspaces indexed")
        except Exception as _e:
            logger.warning(f"FAISS rebuild skipped: {_e}")
    threading.Thread(target=_bg_rebuild, daemon=True).start()
    logger.info("FAISS rebuild started in background")


def run_startup_cleanup() -> None:
    """Run cleanup once on startup. Safe, fast, idempotent."""
    try:
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
