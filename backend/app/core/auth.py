from __future__ import annotations

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db.models import User
from app.services.auth_service import decode_access_token


async def get_current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(401, "missing_token", "Authorization token is required.")
    token = authorization.split(" ", 1)[1].strip()
    claims = decode_access_token(token, runtime.settings)
    user = db.query(User).filter(User.id == claims.get("sub")).first()
    if user is None or not user.is_active:
        raise AppError(401, "invalid_token", "Invalid or expired token.")
    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if str(current_user.role) != "admin":
        raise AppError(403, "forbidden", "Admin access required.")
    return current_user
