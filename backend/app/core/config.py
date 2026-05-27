from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel, ConfigDict, model_validator

load_dotenv()

DEFAULT_SQLITE_DB_PATH = str(Path(__file__).resolve().parents[2] / "data" / "rag.sqlite3")


class Settings(BaseModel):
    model_config = ConfigDict(frozen=True)

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
    
    # Document processing
    default_chunk_size: int = 500
    default_chunk_overlap: int = 100
    
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
    jwt_secret_key: str = "change-me-in-production-32-chars-min"
    jwt_algorithm: str = "HS256"
    jwt_expire_hours: int = 24
    chat_temperature: float = 0.2
    chat_top_p: float = 0.9
    chat_max_tokens: int = 600
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
