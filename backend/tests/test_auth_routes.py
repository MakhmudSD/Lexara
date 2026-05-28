"""Integration tests for /auth endpoints."""
import pytest


REGISTER_URL = "/auth/register"
LOGIN_URL = "/auth/login"
ME_URL = "/auth/me"
FORGOT_URL = "/auth/forgot-password"
RESET_URL = "/auth/reset-password"


def _register(client, email="user@example.com", password="password123", name="Test User"):
    return client.post(REGISTER_URL, json={"email": email, "password": password, "full_name": name})


class TestRegister:
    def test_success(self, client):
        r = _register(client)
        assert r.status_code == 201
        data = r.json()
        assert data["email"] == "user@example.com"
        assert data["full_name"] == "Test User"
        assert "access_token" in data
        assert data["role"] == "member"

    def test_duplicate_email_returns_409(self, client):
        _register(client)
        r = _register(client)
        assert r.status_code == 409
        assert r.json()["error"]["code"] == "email_in_use"

    def test_short_password_rejected(self, client):
        r = _register(client, password="short")
        assert r.status_code == 422

    def test_invalid_email_rejected(self, client):
        r = client.post(REGISTER_URL, json={"email": "not-an-email", "password": "password123", "full_name": "X"})
        assert r.status_code == 422

    def test_referral_code_generated(self, client):
        r = _register(client)
        assert r.status_code == 201
        # Referral code is stored on the user — verify via /me
        token = r.json()["access_token"]
        me = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["referral_code"] is not None
        assert me.json()["referral_code"].startswith("LEX-")

    def test_register_with_referral_creates_referral_record(self, client, db):
        # Register referrer first
        r1 = _register(client, email="referrer@example.com")
        token = r1.json()["access_token"]
        me = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
        ref_code = me.json()["referral_code"]

        # Register referred user using that code
        r2 = client.post(
            REGISTER_URL + f"?ref={ref_code}",
            json={"email": "referred@example.com", "password": "password123", "full_name": "Referred"},
        )
        assert r2.status_code == 201

        from app.db.models import Referral
        referral = db.query(Referral).filter(Referral.code == ref_code).first()
        assert referral is not None
        assert str(referral.status) == "pending"

    def test_empty_full_name_rejected(self, client):
        r = client.post(REGISTER_URL, json={"email": "a@b.com", "password": "password123", "full_name": ""})
        assert r.status_code == 422


class TestLogin:
    def test_success(self, client):
        _register(client)
        r = client.post(LOGIN_URL, json={"email": "user@example.com", "password": "password123"})
        assert r.status_code == 200
        assert "access_token" in r.json()

    def test_wrong_password(self, client):
        _register(client)
        r = client.post(LOGIN_URL, json={"email": "user@example.com", "password": "wrongpassword"})
        assert r.status_code == 401
        assert r.json()["error"]["code"] == "invalid_credentials"

    def test_unknown_email(self, client):
        r = client.post(LOGIN_URL, json={"email": "nobody@example.com", "password": "password123"})
        assert r.status_code == 401

    def test_returns_bearer_token_type(self, client):
        _register(client)
        r = client.post(LOGIN_URL, json={"email": "user@example.com", "password": "password123"})
        assert r.json()["token_type"] == "bearer"


class TestMe:
    def test_returns_user_profile(self, client):
        r = _register(client)
        token = r.json()["access_token"]
        me = client.get(ME_URL, headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        data = me.json()
        assert data["email"] == "user@example.com"
        assert data["plan"] == "free"
        assert data["is_active"] is True
        assert data["total_queries"] == 0

    def test_missing_token_returns_401(self, client):
        r = client.get(ME_URL)
        assert r.status_code == 401

    def test_invalid_token_returns_401(self, client):
        r = client.get(ME_URL, headers={"Authorization": "Bearer invalid.token.here"})
        assert r.status_code == 401

    def test_malformed_header_returns_401(self, client):
        r = client.get(ME_URL, headers={"Authorization": "NotBearer abc"})
        assert r.status_code == 401


class TestForgotPassword:
    def test_existing_user_returns_message(self, client):
        _register(client)
        r = client.post(FORGOT_URL, json={"email": "user@example.com"})
        assert r.status_code == 200
        # In development mode the token is echoed back
        data = r.json()
        assert "token" in data or "message" in data

    def test_unknown_email_returns_same_message(self, client):
        # Must not reveal whether the email exists (anti-enumeration)
        r = client.post(FORGOT_URL, json={"email": "ghost@example.com"})
        assert r.status_code == 200
        assert "message" in r.json()


class TestResetPassword:
    def _get_reset_token(self, client):
        _register(client)
        r = client.post(FORGOT_URL, json={"email": "user@example.com"})
        return r.json().get("token")

    def test_valid_token_resets_password(self, client):
        token = self._get_reset_token(client)
        r = client.post(RESET_URL, json={"token": token, "new_password": "newpassword99"})
        assert r.status_code == 200
        # Old password no longer works
        r2 = client.post(LOGIN_URL, json={"email": "user@example.com", "password": "password123"})
        assert r2.status_code == 401
        # New password works
        r3 = client.post(LOGIN_URL, json={"email": "user@example.com", "password": "newpassword99"})
        assert r3.status_code == 200

    def test_used_token_is_rejected(self, client):
        token = self._get_reset_token(client)
        client.post(RESET_URL, json={"token": token, "new_password": "newpassword99"})
        r = client.post(RESET_URL, json={"token": token, "new_password": "anotherpass99"})
        assert r.status_code == 400
        assert r.json()["error"]["code"] == "invalid_reset_token"

    def test_bogus_token_rejected(self, client):
        r = client.post(RESET_URL, json={"token": "doesnotexist", "new_password": "newpassword99"})
        assert r.status_code == 400
