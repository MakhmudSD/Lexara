"""Paddle billing integration."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, Header, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.dependencies import get_db, get_runtime
from app.core.exceptions import AppError
from app.core.runtime import AppRuntime
from app.db.models import User
from app.services.auth_service import decode_access_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/billing", tags=["billing"])
webhook_router = APIRouter(prefix="/webhooks", tags=["webhooks"])

PADDLE_API_URL = "https://api.paddle.com"
PADDLE_API_KEY = os.getenv("PADDLE_API_KEY", "")
PADDLE_WEBHOOK_SECRET = os.getenv("PADDLE_WEBHOOK_SECRET", "")
PADDLE_PRICE_PRO = os.getenv("PADDLE_PRICE_PRO", "")
PADDLE_PRICE_BUSINESS = os.getenv("PADDLE_PRICE_BUSINESS", "")

PLAN_PRICES = {
    "pro": PADDLE_PRICE_PRO,
    "business": PADDLE_PRICE_BUSINESS,
}


class CheckoutRequest(BaseModel):
    plan: str  # "pro" or "business"


def _get_current_user(
    authorization: str | None,
    db: Session,
    runtime: AppRuntime,
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise AppError(401, "missing_token", "Authorization token is required.")
    token = authorization.split(" ", 1)[1].strip()
    claims = decode_access_token(token, runtime.settings)
    user = db.query(User).filter(User.id == claims.get("sub")).first()
    if not user:
        raise AppError(401, "invalid_token", "Invalid or expired token.")
    return user


@router.post("/checkout")
async def create_checkout(
    payload: CheckoutRequest,
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
) -> dict:
    """Create a Paddle checkout transaction and return the checkout URL."""
    user = _get_current_user(authorization, db, runtime)

    plan = payload.plan.lower()
    price_id = PLAN_PRICES.get(plan)
    if not price_id:
        raise AppError(400, "invalid_plan", f"Unknown plan: {plan}")

    if not PADDLE_API_KEY:
        raise AppError(500, "paddle_not_configured", "Paddle API key not configured.")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"{PADDLE_API_URL}/transactions",
            headers={
                "Authorization": f"Bearer {PADDLE_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "items": [{"price_id": price_id, "quantity": 1}],
                "customer": {"email": user.email},
                "custom_data": {
                    "user_id": str(user.id),
                    "plan": plan,
                },
                "checkout": {
                    "url": os.getenv("VITE_APP_URL", "https://lexara-top.vercel.app"),
                },
            },
            timeout=30.0,
        )

    if response.status_code not in (200, 201):
        logger.error("Paddle checkout error: status=%s", response.status_code)
        raise AppError(502, "paddle_error", "Could not create checkout session.")

    data = response.json()
    checkout_url = data.get("data", {}).get("checkout", {}).get("url")
    transaction_id = data.get("data", {}).get("id")

    if not checkout_url:
        raise AppError(502, "paddle_error", "No checkout URL returned from Paddle.")

    return {
        "checkout_url": checkout_url,
        "transaction_id": transaction_id,
    }


@webhook_router.post("/paddle")
async def paddle_webhook(request: Request, db: Session = Depends(get_db)) -> JSONResponse:
    """Receive and process Paddle webhook events. Verifies the signature before processing."""
    body = await request.body()
    signature = request.headers.get("paddle-signature", "")

    if PADDLE_WEBHOOK_SECRET:
        try:
            _verify_paddle_signature(body, signature, PADDLE_WEBHOOK_SECRET)
        except ValueError as e:
            logger.warning(f"Paddle webhook signature invalid: {e}")
            return JSONResponse(status_code=401, content={"error": "Invalid signature"})

    try:
        event = json.loads(body)
    except json.JSONDecodeError:
        return JSONResponse(status_code=400, content={"error": "Invalid JSON"})

    event_type = event.get("event_type", "")
    event_data = event.get("data", {})

    logger.info(f"Paddle webhook: {event_type}")

    try:
        if event_type in ("subscription.created", "subscription.updated"):
            await _handle_subscription_active(db, event_data)

        elif event_type == "subscription.canceled":
            await _handle_subscription_canceled(db, event_data)

        elif event_type == "subscription.past_due":
            await _handle_subscription_past_due(db, event_data)

        elif event_type == "transaction.completed":
            await _handle_transaction_completed(db, event_data)

        elif event_type == "transaction.payment_failed":
            logger.warning(f"Payment failed: {event_data.get('id')}")

    except Exception as e:
        logger.exception(f"Error processing webhook {event_type}: {e}")
        # Return 200 to prevent Paddle retrying — log the error instead
        return JSONResponse(status_code=200, content={"status": "error_logged"})

    return JSONResponse(status_code=200, content={"status": "ok"})


def _verify_paddle_signature(body: bytes, signature: str, secret: str) -> None:
    """
    Verify Paddle webhook signature.
    Format: ts=timestamp;h1=hash
    """
    parts = {}
    for part in signature.split(";"):
        if "=" in part:
            k, v = part.split("=", 1)
            parts[k] = v

    ts = parts.get("ts")
    h1 = parts.get("h1")

    if not ts or not h1:
        raise ValueError("Missing ts or h1 in signature")

    signed_payload = f"{ts}:{body.decode('utf-8')}"
    expected = hmac.new(
        key=secret.encode("utf-8"),
        msg=signed_payload.encode("utf-8"),
        digestmod=hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, h1):
        raise ValueError("Signature mismatch")


async def _handle_subscription_active(db: Session, data: dict) -> None:
    """Upgrade user plan when subscription is created or updated."""
    custom_data = data.get("custom_data") or {}
    user_id = custom_data.get("user_id")
    plan = custom_data.get("plan", "pro")

    if not user_id:
        customer = data.get("customer", {})
        email = customer.get("email")
        if email:
            user = db.query(User).filter(User.email == email).first()
        else:
            logger.warning("No user_id or email in subscription webhook")
            return
    else:
        user = db.query(User).filter(User.id == user_id).first()

    if not user:
        logger.warning(f"User not found for subscription: {user_id}")
        return

    billing_period = data.get("current_billing_period", {})
    ends_at = billing_period.get("ends_at")

    if ends_at:
        try:
            plan_expires_at = datetime.fromisoformat(ends_at.replace("Z", "+00:00")).replace(tzinfo=None)
        except (ValueError, AttributeError):
            plan_expires_at = datetime.utcnow() + timedelta(days=32)
    else:
        plan_expires_at = datetime.utcnow() + timedelta(days=32)

    user.plan = plan
    user.plan_expires_at = plan_expires_at
    subscription_id = data.get("id")
    if subscription_id:
        user.subscription_id = subscription_id
    db.commit()
    logger.info("Upgraded user %s to %s until %s", user.email, plan, plan_expires_at)

    # Referral reward rule: referrer gets 30 days Pro when referred user makes first payment
    try:
        from app.db.models import Referral
        from app.core.enums import ReferralStatus
        referral = db.query(Referral).filter(
            Referral.referred_user_id == user.id,
            Referral.status == ReferralStatus.PENDING,
        ).first()
        if referral:
            referral.status = ReferralStatus.CONVERTED
            referrer = db.query(User).filter(User.id == referral.referrer_id).first()
            if referrer:
                base = max(referrer.plan_expires_at or datetime.utcnow(), datetime.utcnow())
                referrer.plan = "pro" if referrer.plan == "free" else referrer.plan
                referrer.plan_expires_at = base + timedelta(days=30)
                referral.status = ReferralStatus.REWARDED
            db.commit()
            logger.info(f"Referral converted via subscription: referred={user.email}")
    except Exception as e:
        logger.warning(f"Referral reward (subscription) failed: {e}")


async def _handle_subscription_canceled(db: Session, data: dict) -> None:
    """Downgrade user to free when subscription is canceled."""
    custom_data = data.get("custom_data") or {}
    user_id = custom_data.get("user_id")

    if not user_id:
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return

    scheduled_change = data.get("scheduled_change", {})
    effective_at = scheduled_change.get("effective_at")

    if effective_at:
        try:
            plan_expires_at = datetime.fromisoformat(effective_at.replace("Z", "+00:00")).replace(tzinfo=None)
            user.plan_expires_at = plan_expires_at
            db.commit()
            logger.info(f"Subscription canceled for {user.email}, expires {plan_expires_at}")
        except (ValueError, AttributeError):
            pass


async def _handle_subscription_past_due(db: Session, data: dict) -> None:
    """Log past due subscriptions."""
    custom_data = data.get("custom_data") or {}
    user_id = custom_data.get("user_id")
    logger.warning(f"Subscription past due for user: {user_id}")


async def _handle_transaction_completed(db: Session, data: dict) -> None:
    """Backup handler — ensure plan is upgraded on completed transaction.
    Also rewards referrers when their referred user makes their first payment.
    """
    custom_data = data.get("custom_data") or {}
    user_id = custom_data.get("user_id")
    plan = custom_data.get("plan", "pro")

    if not user_id:
        return

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return

    if user.plan == "free":
        user.plan = plan
        user.plan_expires_at = datetime.utcnow() + timedelta(days=32)
        db.commit()
        logger.info(f"Transaction completed — upgraded {user.email} to {plan}")

    # Check if this user was referred — reward the referrer on first payment
    try:
        from app.db.models import Referral
        from app.core.enums import ReferralStatus
        referral = db.query(Referral).filter(
            Referral.referred_user_id == user.id,
            Referral.status == ReferralStatus.PENDING,
        ).first()

        if referral:
            referral.status = ReferralStatus.CONVERTED
            db.commit()

            referrer = db.query(User).filter(User.id == referral.referrer_id).first()
            if referrer:
                if referrer.plan == "free":
                    referrer.plan = "pro"
                    referrer.plan_expires_at = datetime.utcnow() + timedelta(days=30)
                else:
                    base = max(referrer.plan_expires_at or datetime.utcnow(), datetime.utcnow())
                    referrer.plan_expires_at = base + timedelta(days=30)

                referral.status = ReferralStatus.REWARDED
                db.commit()
                logger.info(
                    f"Referral rewarded: {referrer.email} gets 30 days Pro "
                    f"for referring {user.email}"
                )
    except Exception as e:
        logger.warning(f"Referral reward check failed: {e}")
        # Don't fail the main transaction processing
