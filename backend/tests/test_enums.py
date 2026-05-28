"""Tests for application-wide enums."""
import pytest
from app.db.models import UserRole, UserPlan, ReferralStatus, DocumentStatus
from app.core.enums import UserRole as EnumUserRole, UserPlan as EnumUserPlan


class TestUserRole:
    def test_values(self):
        assert UserRole.ADMIN == "admin"
        assert UserRole.MEMBER == "member"

    def test_is_string(self):
        # str+Enum subclass must compare equal to plain strings
        assert UserRole.ADMIN == "admin"
        assert "admin" == UserRole.ADMIN

    def test_in_dict_lookup(self):
        d = {"admin": "ok"}
        assert d[UserRole.ADMIN] == "ok"

    def test_membership(self):
        assert UserRole.ADMIN in list(UserRole)
        assert UserRole.MEMBER in list(UserRole)

    def test_invalid_value_raises(self):
        with pytest.raises(ValueError):
            UserRole("superuser")


class TestUserPlan:
    def test_values(self):
        assert UserPlan.FREE == "free"
        assert UserPlan.PRO == "pro"
        assert UserPlan.BUSINESS == "business"

    def test_plan_limits_lookup(self):
        from app.core.config import PLAN_LIMITS
        # str enum keys work with string-keyed dict
        assert PLAN_LIMITS[UserPlan.FREE]["monthly_queries"] == 50
        assert PLAN_LIMITS[UserPlan.PRO]["monthly_queries"] == 1000
        assert PLAN_LIMITS[UserPlan.BUSINESS]["monthly_queries"] == 5000


class TestReferralStatus:
    def test_values(self):
        assert ReferralStatus.PENDING == "pending"
        assert ReferralStatus.CONVERTED == "converted"
        assert ReferralStatus.REWARDED == "rewarded"


class TestDocumentStatus:
    def test_values(self):
        assert DocumentStatus.PENDING == "pending"
        assert DocumentStatus.PROCESSING == "processing"
        assert DocumentStatus.READY == "ready"
        assert DocumentStatus.FAILED == "failed"


class TestCentralExport:
    def test_same_objects(self):
        assert EnumUserRole is UserRole
        assert EnumUserPlan is UserPlan
