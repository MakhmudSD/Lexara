"""Cloudflare R2 storage via boto3 (S3-compatible API).

Storage path convention:
  r2://<bucket>/<workspace_id>/<document_id>/<filename>

The `r2://` prefix in storage_path lets the download route distinguish R2
objects from legacy local file paths, enabling graceful fallback.
"""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.core.config import Settings

logger = logging.getLogger(__name__)


def _make_key(workspace_id: str, document_id: str, filename: str) -> str:
    """Build the R2 object key."""
    return f"{workspace_id}/{document_id}/{filename}"


def _parse_r2_path(storage_path: str) -> tuple[str, str]:
    """Parse `r2://<bucket>/<key>` → (bucket, key)."""
    without_prefix = storage_path[len("r2://"):]
    bucket, _, key = without_prefix.partition("/")
    return bucket, key


@lru_cache(maxsize=1)
def _get_client(endpoint_url: str, access_key: str, secret_key: str):
    """Return a cached boto3 S3 client pointed at the R2 endpoint."""
    try:
        import boto3
        return boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            region_name="auto",
        )
    except ImportError as exc:
        raise RuntimeError(
            "boto3 is required for R2 storage. Install it: pip install boto3"
        ) from exc


def is_configured(settings: "Settings") -> bool:
    """Return True if all R2 credentials are present in settings."""
    return bool(
        settings.r2_endpoint_url
        and settings.r2_access_key_id
        and settings.r2_secret_access_key
        and settings.r2_bucket_name
    )


def upload_file(
    settings: "Settings",
    *,
    workspace_id: str,
    document_id: str,
    filename: str,
    data: bytes,
    content_type: str = "application/octet-stream",
) -> str:
    """Upload file bytes to R2 and return the `r2://` storage_path.

    Raises RuntimeError if R2 is not configured or upload fails.
    """
    client = _get_client(
        settings.r2_endpoint_url,
        settings.r2_access_key_id,
        settings.r2_secret_access_key,
    )
    key = _make_key(workspace_id, document_id, filename)
    client.put_object(
        Bucket=settings.r2_bucket_name,
        Key=key,
        Body=data,
        ContentType=content_type,
    )
    storage_path = f"r2://{settings.r2_bucket_name}/{key}"
    logger.info("R2 upload: %s (%d bytes)", storage_path, len(data))
    return storage_path


def download_file(settings: "Settings", storage_path: str) -> bytes:
    """Download an object from R2 given its `r2://` storage_path.

    Raises AppError-compatible ValueError if the object is not found.
    """
    bucket, key = _parse_r2_path(storage_path)
    client = _get_client(
        settings.r2_endpoint_url,
        settings.r2_access_key_id,
        settings.r2_secret_access_key,
    )
    try:
        response = client.get_object(Bucket=bucket, Key=key)
        return response["Body"].read()
    except Exception as exc:
        logger.warning("R2 download failed for %s: %s", storage_path, exc)
        raise
