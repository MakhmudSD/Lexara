"""Tests for auth_service: password hashing and JWT logic."""
import pytest
from unittest.mock import MagicMock
from app.services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)
from app.core.exceptions import AppError


@pytest.fixture()
def settings():
    s = MagicMock()
    s.jwt_secret_key = "test-secret-key-for-tests-only-32c"
    s.jwt_algorithm = "HS256"
    s.jwt_expire_hours = 1
    return s


class TestPasswordHashing:
    def test_hash_differs_from_plain(self):
        assert hash_password("mypassword") != "mypassword"

    def test_verify_correct_password(self):
        hashed = hash_password("correct-horse-battery")
        assert verify_password("correct-horse-battery", hashed) is True

    def test_verify_wrong_password(self):
        hashed = hash_password("correct-horse-battery")
        assert verify_password("wrong", hashed) is False

    def test_two_hashes_differ(self):
        # bcrypt generates unique salts
        assert hash_password("same") != hash_password("same")


class TestJWT:
    def test_create_and_decode_roundtrip(self, settings):
        token = create_access_token("user-123", "member", "u@example.com", settings)
        claims = decode_access_token(token, settings)
        assert claims["sub"] == "user-123"
        assert claims["role"] == "member"
        assert claims["email"] == "u@example.com"

    def test_invalid_token_raises_app_error(self, settings):
        with pytest.raises(AppError) as exc_info:
            decode_access_token("not.a.valid.token", settings)
        assert exc_info.value.status_code == 401
        assert exc_info.value.code == "invalid_token"

    def test_tampered_token_raises(self, settings):
        token = create_access_token("user-1", "member", "u@test.com", settings)
        tampered = token[:-4] + "XXXX"
        with pytest.raises(AppError):
            decode_access_token(tampered, settings)

    def test_wrong_secret_raises(self, settings):
        token = create_access_token("user-1", "member", "u@test.com", settings)
        bad_settings = MagicMock()
        bad_settings.jwt_secret_key = "completely-different-secret-key!!"
        bad_settings.jwt_algorithm = "HS256"
        with pytest.raises(AppError):
            decode_access_token(token, bad_settings)

    def test_admin_role_encoded(self, settings):
        token = create_access_token("admin-1", "admin", "admin@test.com", settings)
        claims = decode_access_token(token, settings)
        assert claims["role"] == "admin"
