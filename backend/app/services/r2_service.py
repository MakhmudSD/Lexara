"""Cloudflare R2 upload service (S3-compatible via boto3).

Key convention:  {workspace_id}/{document_id}/{filename}
Path convention: r2://{bucket}/{key}
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger(__name__)

_R2_VARS = ("R2_ENDPOINT_URL", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME")


def is_configured() -> bool:
    """Return True when all four R2 env vars are non-empty."""
    return all(os.environ.get(v) for v in _R2_VARS)


def upload_to_r2(file_bytes: bytes, key: str, content_type: str = "application/octet-stream") -> str:
    """Upload *file_bytes* to R2 at *key* and return the r2:// storage path.

    Reads credentials directly from environment so this can be called without
    a Settings object.  Raises RuntimeError if vars are missing, or propagates
    any boto3 exception on upload failure.
    """
    endpoint_url = os.environ["R2_ENDPOINT_URL"]
    access_key_id = os.environ["R2_ACCESS_KEY_ID"]
    secret_access_key = os.environ["R2_SECRET_ACCESS_KEY"]
    bucket_name = os.environ["R2_BUCKET_NAME"]

    import boto3

    client = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        region_name="auto",
    )
    client.put_object(
        Bucket=bucket_name,
        Key=key,
        Body=file_bytes,
        ContentType=content_type,
    )
    storage_path = f"r2://{bucket_name}/{key}"
    logger.info("R2 upload OK: %s (%d bytes)", storage_path, len(file_bytes))
    return storage_path
