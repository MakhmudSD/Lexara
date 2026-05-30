import os
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.admin import router as admin_router
from app.core.config import get_settings
from app.core.exceptions import register_exception_handlers
from app.core.limiter import limiter
from app.core.middleware import RequestContextMiddleware
from app.core.runtime import AppRuntime
from app.db.migrate import run_migrations
from app.routes import auth_router, chat_router, documents_router, health_router, workspaces_router
from app.routes.billing import router as billing_router, webhook_router
from app.routes.support import router as support_router, admin_router as support_admin_router
from app.routes.workspaces import org_workspace_router

logger = logging.getLogger(__name__)
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    "https://lexara-top.vercel.app",
    "https://lexara-mvp.vercel.app",
    "http://127.0.0.1:5173",
]


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

    env_origins = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", "").split(",") if origin.strip()]
    allowed_origins = list(dict.fromkeys([*ALLOWED_ORIGINS, *env_origins]))

    # Register rate-limiter state so @limiter.limit() decorators work
    app.state.limiter = limiter
    try:
        from slowapi.errors import RateLimitExceeded
        from slowapi import _rate_limit_exceeded_handler
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    except ImportError:
        pass

    app.add_middleware(RequestContextMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
        expose_headers=["X-Request-ID"],
    )
    register_exception_handlers(app)

    app.include_router(health_router)
    app.include_router(workspaces_router)
    app.include_router(org_workspace_router)
    app.include_router(documents_router)
    app.include_router(chat_router)
    app.include_router(admin_router)
    app.include_router(auth_router)
    app.include_router(billing_router)
    app.include_router(webhook_router)
    app.include_router(support_router)
    app.include_router(support_admin_router)

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
