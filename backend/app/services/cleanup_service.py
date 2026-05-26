from __future__ import annotations

import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.db.models import PasswordResetToken, TokenUsage

logger = logging.getLogger(__name__)


def cleanup_old_records(db: Session) -> dict:
    """Delete records older than retention periods. Safe to run daily."""
    cutoff_90d = datetime.utcnow() - timedelta(days=90)
    cutoff_1d = datetime.utcnow() - timedelta(days=1)
    results: dict[str, int | str] = {}

    try:
        deleted = db.query(TokenUsage).filter(
            TokenUsage.timestamp < cutoff_90d
        ).delete(synchronize_session=False)
        results['token_usage_deleted'] = deleted
        logger.info(f"Cleanup: deleted {deleted} token_usage rows older than 90 days")
    except Exception as e:
        logger.error(f"Cleanup token_usage failed: {e}")
        results['token_usage_error'] = str(e)

    try:
        deleted = db.query(PasswordResetToken).filter(
            PasswordResetToken.expires_at < cutoff_1d
        ).delete(synchronize_session=False)
        results['reset_tokens_deleted'] = deleted
        logger.info(f"Cleanup: deleted {deleted} expired password_reset_tokens")
    except Exception as e:
        logger.error(f"Cleanup password_reset_tokens failed: {e}")
        results['reset_tokens_error'] = str(e)

    db.commit()
    return results
