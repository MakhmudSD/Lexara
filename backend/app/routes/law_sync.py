"""Admin routes for syncing Korean law documents."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.auth import require_admin
from app.core.dependencies import get_db, get_runtime
from app.core.runtime import AppRuntime
from app.db.models import LawDocument, Workspace
from app.services.law_apis.korean_law import KoreanLawService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/admin/law-sync", tags=["law-sync"])

_KOREAN_LAW_WORKSPACE_NAME = "Korean Law Database"


class KoreanSyncRequest(BaseModel):
    query: str
    max_laws: int = 10


class KoreanSyncResponse(BaseModel):
    synced: int
    failed: int
    law_names: list[str]


class LawSyncStatusEntry(BaseModel):
    country: str
    count: int
    last_synced_at: str | None


@router.post("/korean", response_model=KoreanSyncResponse)
async def sync_korean_laws(
    payload: KoreanSyncRequest,
    db: Session = Depends(get_db),
    runtime: AppRuntime = Depends(get_runtime),
    _admin: Any = Depends(require_admin),
) -> KoreanSyncResponse:
    # Bug 1: resolve workspace_id once before the loop
    korean_ws = (
        db.query(Workspace)
        .filter(Workspace.name == _KOREAN_LAW_WORKSPACE_NAME, Workspace.is_active.is_(True))
        .first()
    )
    if korean_ws is None:
        logger.error(
            "law_sync_aborted: workspace %r not found — run seed_law_workspace.py first",
            _KOREAN_LAW_WORKSPACE_NAME,
        )
        return KoreanSyncResponse(synced=0, failed=0, law_names=[])

    korean_law_workspace_id = str(korean_ws.id)

    settings = runtime.settings
    svc = KoreanLawService(settings)

    results = await svc.search_laws(payload.query, per_page=payload.max_laws)

    synced = 0
    failed = 0
    law_names: list[str] = []

    for meta in results:
        law_id = meta.get("law_id", "")
        law_name = meta.get("law_name", "")
        if not law_id:
            failed += 1
            continue

        # Bug 3: savepoint per law so one failure never poisons the whole transaction
        sp = db.begin_nested()
        try:
            full_text = await svc.get_law_text(law_id)

            # Bug 3: explicit empty-text guard
            if not full_text or not full_text.strip():
                logger.warning("empty_law_text law_id=%r law_name=%r — skipping", law_id, law_name)
                sp.rollback()
                failed += 1
                continue

            existing = db.query(LawDocument).filter(LawDocument.law_id == law_id).first()
            if existing:
                existing.law_name = law_name
                existing.law_type = meta.get("law_type", "")
                existing.full_text = full_text
                existing.workspace_id = korean_ws.id  # Bug 1
                existing.promulgation_date = meta.get("promulgation_date") or None  # Bug 4
                existing.last_synced_at = datetime.utcnow()
                doc = existing
            else:
                doc = LawDocument(
                    country="KR",
                    law_id=law_id,
                    law_name=law_name,
                    law_type=meta.get("law_type", ""),
                    full_text=full_text,
                    workspace_id=korean_ws.id,  # Bug 1
                    promulgation_date=meta.get("promulgation_date") or None,  # Bug 4
                    last_synced_at=datetime.utcnow(),
                )
                db.add(doc)

            db.flush()

            # Chunk + embed into FAISS
            _index_law_text(
                workspace_id=korean_law_workspace_id,
                law_id=law_id,
                law_name=law_name,
                full_text=full_text,
                runtime=runtime,
                db=db,
            )

            sp.commit()
            synced += 1
            law_names.append(law_name)
        except Exception as exc:
            sp.rollback()
            logger.error("law_sync_failed law_id=%r: %s", law_id, exc)
            failed += 1

    db.commit()
    return KoreanSyncResponse(synced=synced, failed=failed, law_names=law_names)


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


# ------------------------------------------------------------------
# Internal helpers
# ------------------------------------------------------------------

def _index_law_text(
    *,
    workspace_id: str,
    law_id: str,
    law_name: str,
    full_text: str,
    runtime: AppRuntime,
    db: Session,
) -> None:
    """Chunk the law text, embed each chunk, and add to FAISS.

    Creates/replaces a Document row and its DocumentChunk children so that
    the retrieval service can look up chunk content by ID.
    """
    from app.services.chunking import chunk_text
    from app.services.embedding_service import embed_texts
    from app.db.models import Document, DocumentChunk, DocumentStatus
    from uuid import UUID, uuid4

    ws = db.query(Workspace).filter(Workspace.id == UUID(workspace_id)).first()
    if ws is None or ws.organization_id is None:
        logger.warning("law_index_skipped: workspace %s has no organization", workspace_id)
        return

    chunks = chunk_text(
        full_text,
        chunk_size=runtime.settings.default_chunk_size,
        overlap=runtime.settings.default_chunk_overlap,
    )
    if not chunks:
        return

    embeddings = embed_texts(chunks, runtime.settings)

    law_filename = f"law_{law_id}.txt"
    doc = (
        db.query(Document)
        .filter(
            Document.workspace_id == UUID(workspace_id),
            Document.filename == law_filename,
        )
        .first()
    )
    if doc is None:
        doc = Document(
            id=uuid4(),
            organization_id=ws.organization_id,
            workspace_id=UUID(workspace_id),
            filename=law_filename,
            content_type="text/plain",
            file_size_bytes=len(full_text.encode()),
            storage_path=f"law://{law_id}",
            status=DocumentStatus.READY,
            is_processed=True,
            chunk_count=len(chunks),
        )
        db.add(doc)
        db.flush()
    else:
        # Bug 2: collect old chunk IDs before deleting so we can remove from FAISS
        old_chunk_ids = [
            str(c.id)
            for c in db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).all()
        ]
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()
        db.flush()

        # Bug 2: remove old vectors from FAISS before adding new ones
        if old_chunk_ids:
            runtime.vector_store.remove_embeddings(workspace_id, old_chunk_ids)

        doc.chunk_count = len(chunks)
        doc.status = DocumentStatus.READY
        doc.is_processed = True

    chunk_ids: list[str] = []
    for idx, (text, emb) in enumerate(zip(chunks, embeddings)):
        chunk = DocumentChunk(
            id=uuid4(),
            document_id=doc.id,
            chunk_index=idx,
            text=text,
            embedding=emb,
            has_embedding=True,
        )
        db.add(chunk)
        db.flush()
        chunk_ids.append(str(chunk.id))

    runtime.vector_store.add_embeddings(workspace_id, chunk_ids, embeddings)
