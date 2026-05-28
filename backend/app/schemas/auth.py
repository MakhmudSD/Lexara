from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=1, max_length=100)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    email: str
    full_name: str
    role: str
    created_at: str | None = None


class UserResponse(BaseModel):
    user_id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: str | None = None
    total_queries: int = 0
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    plan: str = "free"
    plan_expires_at: str | None = None
    referral_code: str | None = None
    referrals_count: int = 0


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(..., min_length=1, max_length=64)
    new_password: str = Field(..., min_length=8, max_length=128)
