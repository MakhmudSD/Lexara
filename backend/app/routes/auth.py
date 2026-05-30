from __future__ import annotations

from datetime import datetime, timedelta
from uuid import uuid4
import secrets

from fastapi import APIRouter, Depends, Header, Request
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_runtime
from app.core.limiter import limiter
from app.services.email_service import send_password_reset_email
from app.core.enums import UserRole, ReferralStatus
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db.models import PasswordResetToken, Referral, TokenUsage, User, Workspace
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


def _generate_referral_code(user_id_str: str) -> str:
    return "LEX-" + user_id_str.replace("-", "")[:6].upper()


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
@limiter.limit("5/minute")
def register(
    request: Request,
    payload: RegisterRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
    ref: str | None = None,
) -> AuthResponse:
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing is not None:
        raise AppError(409, "email_in_use", "A user with this email already exists.")

    user = User(
        id=uuid4(),
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        role=UserRole.MEMBER,
        is_active=True,
    )
    db.add(user)
    db.flush()  # get user.id from DB before commit
    user.referral_code = _generate_referral_code(str(user.id))
    if ref:
        referrer = db.query(User).filter(User.referral_code == ref).first()
        if referrer and referrer.id != user.id:
            # Referral reward rule:
            # Referrer gets 30 days Pro free when the referred user makes their FIRST PAYMENT
            # (not on signup or free queries — tied to real revenue)
            # This is handled in the Paddle webhook: billing.py _handle_transaction_completed
            db.add(Referral(
                id=uuid4(),
                referrer_id=referrer.id,
                referred_user_id=user.id,
                code=ref,
                status=ReferralStatus.PENDING,
                created_at=datetime.utcnow(),
            ))
    db.commit()
    db.refresh(user)
    return _auth_response(user, runtime)


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
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

    referrals_count = db.query(Referral).filter(
        Referral.referrer_id == user.id,
        Referral.status.in_([ReferralStatus.CONVERTED, ReferralStatus.REWARDED]),
    ).count()

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
        plan=user.plan or "free",
        plan_expires_at=user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        referral_code=user.referral_code,
        referrals_count=referrals_count,
    )


@router.post("/forgot-password")
@limiter.limit("3/minute")
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

    if user is not None:
        send_password_reset_email(runtime.settings, user.email, token)

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
