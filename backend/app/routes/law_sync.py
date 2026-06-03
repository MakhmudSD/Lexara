"""Admin routes for syncing Korean law documents."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.dependencies import get_db
from app.db.models import LawDocument

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/law-sync", tags=["law-sync"])


class LawSyncStatusEntry(BaseModel):
    country: str
    count: int
    last_synced_at: str | None


@router.get("/status", response_model=list[LawSyncStatusEntry])
def law_sync_status(
    db: Session = Depends(get_db),
    _admin: Any = Depends(require_admin),
) -> list[LawSyncStatusEntry]:
    rows = (
        db.query(
            LawDocument.country,
            func.count(LawDocument.id).label("count"),
            func.max(LawDocument.last_synced_at).label("last_synced_at"),
        )
        .group_by(LawDocument.country)
        .all()
    )
    return [
        LawSyncStatusEntry(
            country=row.country,
            count=row.count,
            last_synced_at=row.last_synced_at.isoformat() if row.last_synced_at else None,
        )
        for row in rows
    ]
