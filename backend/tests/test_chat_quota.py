"""Tests for the chat quota enforcement logic."""
import pytest
from datetime import datetime
from uuid import uuid4

from app.core.exceptions import AppError
from app.db.models import User, TokenUsage, UserRole, UserPlan
from app.routes.chat import _check_quota


def _make_user(db, plan=UserPlan.FREE, plan_expires_at=None):
    user = User(
        id=uuid4(),
        email=f"u{uuid4().hex[:6]}@example.com",
        hashed_password="x",
        full_name="Test",
        role=UserRole.MEMBER,
        plan=plan,
        plan_expires_at=plan_expires_at,
    )
    db.add(user)
    db.flush()
    return user


def _add_usages(db, user_id: str, count: int):
    for _ in range(count):
        db.add(TokenUsage(
            id=uuid4(),
            user_id=user_id,
            workspace_id=str(uuid4()),
            model="gpt-4o-mini",
            prompt_tokens=10,
            completion_tokens=10,
            total_tokens=20,
            estimated_cost_usd=0.001,
            latency_ms=100.0,
            mode="rag",
            context_chunks_used=1,
            timestamp=datetime.utcnow(),
        ))
    db.flush()


class TestCheckQuota:
    def test_no_user_id_passes(self, db):
        _check_quota(db, None)  # must not raise

    def test_unknown_user_id_passes(self, db):
        _check_quota(db, str(uuid4()))  # user doesn't exist — passes silently

    def test_under_limit_passes(self, db):
        user = _make_user(db)
        _add_usages(db, str(user.id), 10)
        _check_quota(db, str(user.id))  # free limit is 50, 10 < 50 → ok

    def test_at_limit_raises_429(self, db):
        user = _make_user(db, plan=UserPlan.FREE)
        _add_usages(db, str(user.id), 100)  # free limit is 100
        with pytest.raises(AppError) as exc_info:
            _check_quota(db, str(user.id))
        assert exc_info.value.status_code == 429
        assert exc_info.value.code == "monthly_quota_exceeded"

    def test_pro_plan_higher_limit(self, db):
        user = _make_user(db, plan=UserPlan.PRO)
        _add_usages(db, str(user.id), 100)  # 100 < 1000 for pro
        _check_quota(db, str(user.id))  # must not raise

    def test_expired_plan_falls_back_to_free(self, db):
        from datetime import timedelta
        expired_at = datetime.utcnow() - timedelta(days=1)
        user = _make_user(db, plan=UserPlan.PRO, plan_expires_at=expired_at)
        _add_usages(db, str(user.id), 100)  # 100 = free limit after expiry
        with pytest.raises(AppError) as exc_info:
            _check_quota(db, str(user.id))
        assert exc_info.value.status_code == 429

    def test_active_pro_plan_not_expired(self, db):
        from datetime import timedelta
        future = datetime.utcnow() + timedelta(days=30)
        user = _make_user(db, plan=UserPlan.PRO, plan_expires_at=future)
        _add_usages(db, str(user.id), 100)
        _check_quota(db, str(user.id))  # must not raise — 100 < 1000
