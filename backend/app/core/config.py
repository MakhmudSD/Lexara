from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import model_validator
from pydantic_settings import BaseSettings

load_dotenv(Path(__file__).resolve().parents[2] / ".env")

DEFAULT_SQLITE_DB_PATH = str(Path(__file__).resolve().parents[2] / "data" / "rag.sqlite3")


class Settings(BaseSettings):
    model_config = {"env_file": ".env", "case_sensitive": False}

    # OpenAI (optional — not used in retrieval-only MVP)
    openai_api_key: str | None
    embedding_model: str = "text-embedding-3-small"
    chat_model: str = "gpt-4o-mini"

    # Local embeddings (sentence-transformers)
    local_embedding_model: str = "all-MiniLM-L6-v2"
    embedding_dimension: int = 384
    
    # Database (PostgreSQL)
    database_url: str = "postgresql://user:password@localhost:5432/rag_db"

    # FAISS persistence
    faiss_data_dir: str = ""
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
    
    # Redis
    redis_url: str | None = None
    embedding_cache_ttl_seconds: int = 60 * 60 * 24  # 24 hours
    retrieval_cache_ttl_seconds: int = 60 * 5  # 5 minutes
    # Paddle billing
    paddle_api_key: str = ""
    paddle_client_token: str = ""
    paddle_price_pro: str = ""
    paddle_price_business: str = ""

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
    "free":     {"monthly_queries": 50,   "max_workspaces": 1,   "max_documents_per_workspace": 5},
    "pro":      {"monthly_queries": 1000, "max_workspaces": 5,   "max_documents_per_workspace": 999},
    "business": {"monthly_queries": 5000, "max_workspaces": 999, "max_documents_per_workspace": 999},
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
        local_embedding_model=os.getenv("LOCAL_EMBEDDING_MODEL", "all-MiniLM-L6-v2"),
        embedding_dimension=int(os.getenv("EMBEDDING_DIMENSION", "384")),
        faiss_data_dir=os.getenv("FAISS_DATA_DIR", str(data_root / "faiss")),
        uploads_data_dir=os.getenv("UPLOADS_DATA_DIR", str(data_root / "uploads")),
        debug=os.getenv("DEBUG", "false").lower() == "true",
        environment=os.getenv("ENVIRONMENT", "development"),
        sentry_dsn=os.getenv("SENTRY_DSN") or None,
        redis_url=os.getenv("REDIS_URL", None),
        embedding_cache_ttl_seconds=int(os.getenv("EMBEDDING_CACHE_TTL", str(60 * 60 * 24))),
        retrieval_cache_ttl_seconds=int(os.getenv("RETRIEVAL_CACHE_TTL", str(60 * 5))),
        jwt_secret_key=os.getenv("JWT_SECRET_KEY", "change-me-in-production-32-chars-min"),
        jwt_algorithm=os.getenv("JWT_ALGORITHM", "HS256"),
        jwt_expire_hours=int(os.getenv("JWT_EXPIRE_HOURS", "24")),
        chat_temperature=float(os.getenv("CHAT_TEMPERATURE", "0.2")),
        chat_top_p=float(os.getenv("CHAT_TOP_P", "0.9")),
        chat_max_tokens=int(os.getenv("CHAT_MAX_TOKENS", "600")),
        chat_frequency_penalty=float(os.getenv("CHAT_FREQUENCY_PENALTY", "0.1")),
        enable_reranking=os.getenv("ENABLE_RERANKING", "false").lower() == "true",
    )
