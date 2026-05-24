from fastapi import FastAPI
import logging

from app.api.routes.admin import router as admin_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.middleware import RequestContextMiddleware
from app.core.runtime import AppRuntime
from app.db.migrate import run_migrations
from app.routes import chat_router, documents_router, health_router, workspaces_router

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    settings = get_settings()
    runtime = AppRuntime.create(settings=settings)

    app = FastAPI(
        title="RAG SaaS API",
        version="2.0.0",
        description="Production-ready FastAPI backend for document Q&A.",
    )
    app.state.runtime = runtime
    app.state.settings = settings

    app.add_middleware(RequestContextMiddleware)
    register_exception_handlers(app)

    # MVP RAG flow (PostgreSQL + FAISS + sentence-transformers)
    app.include_router(health_router)
    app.include_router(workspaces_router)
    app.include_router(documents_router)
    app.include_router(chat_router)

    # Legacy admin/observability routes (optional)
    app.include_router(admin_router)

    @app.on_event("startup")
    def startup_event() -> None:
        try:
            logger.info("Starting RAG SaaS Backend...")
            logger.info("Running database migrations...")
            run_migrations()
            runtime.vector_store.base_dir.mkdir(parents=True, exist_ok=True)
            logger.info("Backend initialized successfully")
        except Exception as exc:
            logger.error("Startup failed: %s", exc)
            raise

    @app.on_event("shutdown")
    def shutdown_event() -> None:
        logger.info("Shutting down backend...")

    return app


app = create_app()
