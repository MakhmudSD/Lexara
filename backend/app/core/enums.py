"""
Application-wide enums.

Import from here throughout the codebase:
    from app.core.enums import UserRole, UserPlan, ReferralStatus, DocumentStatus
"""
from app.db.models import UserRole, UserPlan, ReferralStatus, DocumentStatus

__all__ = ["UserRole", "UserPlan", "ReferralStatus", "DocumentStatus"]
