from __future__ import annotations

from datetime import datetime

from app.core.config import PLAN_LIMITS
from app.core.exceptions import AppError
from app.db.models import User

# Which plans unlock which all-or-nothing gated feature. Single source of truth.
# NOTE: "legal" is intentionally NOT here — it uses a three-way "free taste" model.
FEATURE_MATRIX: dict[str, set[str]] = {
    "research": {"pro", "business"},
}


def effective_plan(user: User) -> str:
    """Return the user's active plan, downgrading expired paid plans to free."""
    plan = user.plan or "free"
    if user.plan_expires_at and user.plan_expires_at < datetime.utcnow():
        return "free"
    return plan if plan in PLAN_LIMITS else "free"


def plan_limit(user: User, key: str) -> int:
    """Look up a numeric limit for the user's effective plan."""
    return PLAN_LIMITS[effective_plan(user)][key]


def require_feature(user: User, feature: str) -> None:
    """Raise 403 feature_not_in_plan if the user's effective plan doesn't include the feature."""
    allowed = FEATURE_MATRIX.get(feature, set())
    if effective_plan(user) not in allowed:
        raise AppError(
            403,
            "feature_not_in_plan",
            "This feature requires an upgraded plan.",
        )
