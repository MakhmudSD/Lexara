from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DEFAULT_SQLITE_DB_PATH = str(Path(__file__).resolve().parents[2] / "data" / "rag.sqlite3")


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "case_sensitive": False, "extra": "ignore"}

    # OpenAI (optional — not used in retrieval-only MVP)
    openai_api_key: str | None
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"

    # Local embeddings (deprecated — kept so existing Railway env vars don't cause parse errors)
    local_embedding_model: str = ""
    embedding_dimension: int = 1536
    
    # Database (PostgreSQL)
    database_url: str = "postgresql://user:password@localhost:5432/rag_db"

    uploads_data_dir: str = ""
    
    # Legacy SQLite (kept for now)
    sqlite_db_path: str = DEFAULT_SQLITE_DB_PATH
    
    # Upload settings
    max_upload_size_bytes: int = 10 * 1024 * 1024
    
    # Document processing — 1500 chars keeps full article heading + body together
    default_chunk_size: int = 1500
    default_chunk_overlap: int = 200
    
    # Observability
    max_log_entries: int = 1000
    max_request_entries: int = 1000
    max_retrieval_entries: int = 1000
    
    # Retrieval settings
    max_context_chunks: int = 20
    query_embedding_cache_size: int = 256
    
    # Features
    debug: bool = False
    environment: str = "development"
    sentry_dsn: str | None = None
    
    # Cloudflare R2 (S3-compatible) — leave blank to use local disk fallback
    r2_endpoint_url: str = ""        # https://<account_id>.r2.cloudflarestorage.com
    r2_access_key_id: str = ""
    r2_secret_access_key: str = ""
    r2_bucket_name: str = ""

    # Redis
    redis_url: str | None = None
    embedding_cache_ttl_seconds: int = 60 * 60 * 24  # 24 hours
    retrieval_cache_ttl_seconds: int = 60 * 5  # 5 minutes
    # Paddle billing
    paddle_api_key: str = ""
    paddle_client_token: str = ""
    paddle_price_pro: str = ""
    paddle_price_business: str = ""

    # Korean Law API (data.go.kr)
    korean_law_api_key: str = ""
    korean_law_api_base_url: str = "http://apis.data.go.kr/1170000/law"

    # Tavily web search (used by the research agent)
    tavily_api_key: str = ""

    # Email (Resend)
    resend_api_key: str = ""
    from_email: str = "noreply@lexara.app"

    jwt_secret_key: str = "change-me-in-production-32-chars-min"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24
    chat_temperature: float = 0.2
    chat_top_p: float = 0.9
    chat_max_tokens: int = 1200
    chat_frequency_penalty: float = 0.1
    enable_reranking: bool = False

    @property
    def openai_configured(self) -> bool:
        return bool(self.openai_api_key)

    @model_validator(mode="after")
    def validate_jwt_secret(self):
        import logging

        if self.jwt_secret_key in (
            "change-me-in-production",
            "change-me-",
            "secret",
            "change-me-in-production-32-chars-min",
        ):
            logging.getLogger(__name__).critical(
                "SECURITY WARNING: JWT_SECRET_KEY is set to the default value. "
                "This is a critical security risk. Set a real secret in your .env file. "
                "Run: python3 -c \"import secrets; print(secrets.token_hex(32))\""
            )
        return self


PLAN_LIMITS: dict[str, dict] = {
    "free":     {"monthly_queries": 100,  "max_workspaces": 1,   "max_documents_per_workspace": 5,   "monthly_research_runs": 0,   "monthly_legal_queries": 5},
    "pro":      {"monthly_queries": 1000, "max_workspaces": 5,   "max_documents_per_workspace": 999,  "monthly_research_runs": 100, "monthly_legal_queries": 9999},
    "business": {"monthly_queries": 5000, "max_workspaces": 999, "max_documents_per_workspace": 999,  "monthly_research_runs": 600, "monthly_legal_queries": 9999},
}


def get_settings() -> Settings:
    """Load settings from environment variables."""
    backend_root = Path(__file__).resolve().parents[2]
    data_root = backend_root / "data"

    db_url = os.getenv(
        "DATABASE_URL",
        "postgresql://user:password@localhost:5432/rag_db"
    )

    return Settings(
        openai_api_key=os.getenv("OPENAI_API_KEY"),
        database_url=db_url,
        sqlite_db_path=os.getenv("SQLITE_DB_PATH", DEFAULT_SQLITE_DB_PATH),
        local_embedding_model=os.getenv("LOCAL_EMBEDDING_MODEL", ""),
        embedding_dimension=int(os.getenv("EMBEDDING_DIMENSION", "1536")),
        uploads_data_dir=os.getenv("UPLOADS_DATA_DIR", str(data_root / "uploads")),
        debug=os.getenv("DEBUG", "false").lower() == "true",
        environment=os.getenv("ENVIRONMENT", "development"),
        sentry_dsn=os.getenv("SENTRY_DSN") or None,
        r2_endpoint_url=os.getenv("R2_ENDPOINT_URL", ""),
        r2_access_key_id=os.getenv("R2_ACCESS_KEY_ID", ""),
        r2_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY", ""),
        r2_bucket_name=os.getenv("R2_BUCKET_NAME", ""),
        redis_url=os.getenv("REDIS_URL", None),
        embedding_cache_ttl_seconds=int(os.getenv("EMBEDDING_CACHE_TTL", str(60 * 60 * 24))),
        retrieval_cache_ttl_seconds=int(os.getenv("RETRIEVAL_CACHE_TTL", str(60 * 5))),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-me-in-production-32-chars-min"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_expire_hours=int(os.getenv("JWT_EXPIRE_HOURS", "24")),
        chat_temperature=float(os.getenv("CHAT_TEMPERATURE", "0.2")),
        chat_top_p=float(os.getenv("CHAT_TOP_P", "0.9")),
        chat_max_tokens=int(os.getenv("CHAT_MAX_TOKENS", "1500")),
        chat_frequency_penalty=float(os.getenv("CHAT_FREQUENCY_PENALTY", "0.1")),
        enable_reranking=os.getenv("ENABLE_RERANKING", "false").lower() == "true",
        resend_api_key=os.getenv("RESEND_API_KEY", ""),
        from_email=os.getenv("FROM_EMAIL", "noreply@lexara.app"),
        korean_law_api_key=os.getenv("KOREAN_LAW_API_KEY", ""),
        korean_law_api_base_url=os.getenv("KOREAN_LAW_API_BASE_URL", "http://apis.data.go.kr/1170000/law"),
        tavily_api_key=os.getenv("TAVILY_API_KEY", ""),
    )
