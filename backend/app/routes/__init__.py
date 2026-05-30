from app.routes.auth import router as auth_router
from app.routes.chat import router as chat_router
from app.routes.documents import router as documents_router
from app.routes.health import router as health_router
from app.routes.workspaces import router as workspaces_router

__all__ = [
    "auth_router",
    "chat_router",
    "documents_router",
    "health_router",
    "workspaces_router",
]

