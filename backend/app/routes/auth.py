from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4
import secrets

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

try:  # pragma: no cover - optional dependency fallback for local builds
    from slowapi import Limiter
    from slowapi.util import get_remote_address
except ImportError:  # pragma: no cover
    class _NoopLimiter:
        def limit(self, *_args, **_kwargs):
            def decorator(func):
                return func

            return decorator

    def get_remote_address(request):  # type: ignore[override]
        return getattr(getattr(request, "client", None), "host", "unknown")

    limiter = _NoopLimiter()
else:
    limiter = Limiter(key_func=get_remote_address)

from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db.models import PasswordResetToken, TokenUsage, User, Workspace
from app.schemas.auth import (
    AuthResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    UserResponse,
)
from app.services.auth_service import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _auth_response(user: User, runtime: AppRuntime) -> AuthResponse:
    token = create_access_token(str(user.id), user.role, user.email, runtime.settings)
    return AuthResponse(
        access_token=token,
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name or "",
        role=user.role,
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    request: Request,
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> AuthResponse:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise AppError(409, "email_in_use", "A user with this email already exists.")

    user = User(
        id=uuid4(),
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role="user",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _auth_response(user, runtime)


@router.post("/login", response_model=AuthResponse)
def login(
    request: Request,
    payload: LoginRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> AuthResponse:
    user = db.query(User).filter(User.email == payload.email).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise AppError(401, "invalid_credentials", "Invalid email or password.")
    if not user.is_active:
        raise AppError(401, "inactive_user", "This account is inactive.")
    return _auth_response(user, runtime)


@router.get("/me", response_model=UserResponse)
def me(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> UserResponse:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(401, "missing_token", "Authorization token is required.")

    token = authorization.split(" ", 1)[1].strip()
    claims = decode_access_token(token, runtime.settings)
    user = db.query(User).filter(User.id == claims.get("sub")).first()
    if user is None:
        raise AppError(401, "invalid_token", "Invalid or expired token.")

    user_workspace_ids = [
        str(ws.id)
        for ws in db.query(Workspace).filter(
            Workspace.is_active.is_(True)
        ).all()
    ]
    stats = db.query(
        func.count(TokenUsage.id).label("total_queries"),
        func.coalesce(func.sum(TokenUsage.total_tokens), 0).label("total_tokens"),
        func.coalesce(func.sum(TokenUsage.estimated_cost_usd), 0.0).label("total_cost"),
    ).filter(
        TokenUsage.workspace_id.in_(user_workspace_ids)
        if user_workspace_ids else False
    ).first()

    return UserResponse(
        user_id=str(user.id),
        email=user.email,
        full_name=user.full_name or "",
        role=user.role,
        is_active=user.is_active,
        created_at=user.created_at.isoformat() if user.created_at else None,
        total_queries=int(stats.total_queries or 0),
        total_tokens=int(stats.total_tokens or 0),
        total_cost_usd=float(stats.total_cost or 0.0),
    )


@router.post("/forgot-password")
def forgot_password(
    request: Request,
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> dict:
    user = db.query(User).filter(User.email == payload.email).first()
    token = secrets.token_urlsafe(32)
    if user is not None:
        db.add(
            PasswordResetToken(
                id=uuid4(),
                user_id=user.id,
                token=token,
                expires_at=datetime.utcnow() + timedelta(hours=1),
            )
        )
        db.commit()

    if runtime.settings.environment == "development" and user is not None:
        return {"message": "Reset token generated", "token": token, "expires_in": "1 hour"}

    return {"message": "If this email exists, a reset link was sent"}


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
) -> dict:
    token_row = db.query(PasswordResetToken).filter(PasswordResetToken.token == payload.token).first()
    if token_row is None:
        raise AppError(400, "invalid_reset_token", "Reset token is invalid.")
    if token_row.used_at is not None:
        raise AppError(400, "invalid_reset_token", "Reset token has already been used.")
    if token_row.expires_at <= datetime.utcnow():
        raise AppError(400, "invalid_reset_token", "Reset token has expired.")

    user = db.query(User).filter(User.id == token_row.user_id).first()
    if user is None:
        raise AppError(400, "invalid_reset_token", "Reset token is invalid.")

    user.hashed_password = hash_password(payload.new_password)
    token_row.used_at = datetime.utcnow()
    db.commit()
    return {"message": "Password reset successfully"}
