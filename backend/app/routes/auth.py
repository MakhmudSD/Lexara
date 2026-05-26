from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Header
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db.models import TokenUsage, User
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse
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

    stats = db.query(
        func.count(TokenUsage.id).label("total_queries"),
        func.coalesce(func.sum(TokenUsage.total_tokens), 0).label("total_tokens"),
        func.coalesce(func.sum(TokenUsage.estimated_cost_usd), 0.0).label("total_cost"),
    ).filter(TokenUsage.workspace_id.isnot(None)).first()

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
