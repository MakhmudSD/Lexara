from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.auth import get_current_user
from app.core.entitlements import effective_plan
from app.db import get_db
from app.db import models
from app.db.models import User

router = APIRouter(prefix="/legal", tags=["legal"])


@router.get("/workspaces")
def get_legal_workspaces(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all workspaces whose name contains 'Law', 'Legal', or '법'."""
    # Query 1: fetch matching workspaces
    workspaces = db.query(models.Workspace).filter(
        models.Workspace.name.ilike("%law%") |
        models.Workspace.name.ilike("%legal%") |
        models.Workspace.name.ilike("%법%")
    ).all()

    # Filter by jurisdiction based on plan: Free/Pro → KR only, Business → all
    plan = effective_plan(current_user)
    if plan != "business":
        workspaces = [
            ws for ws in workspaces
            if any(kw in ws.name.lower() for kw in ["법", "korea", "korean", " kr", "kr "])
        ]

    workspace_ids = [ws.id for ws in workspaces]

    # Query 2: bulk-fetch all ready documents for those workspaces in one shot
    all_docs = db.query(models.Document).filter(
        models.Document.workspace_id.in_(workspace_ids),
        models.Document.status == 'ready'
    ).all()

    # Group docs by workspace_id in Python (no extra DB round-trips)
    docs_by_workspace = defaultdict(list)
    for doc in all_docs:
        docs_by_workspace[doc.workspace_id].append(doc)

    workspaces_data = []
    for ws in workspaces:
        docs = docs_by_workspace[ws.id]
        workspaces_data.append({
            "id": str(ws.id),
            "name": ws.name,
            "description": ws.description or "",
            "document_count": len(docs),
            "law_count": len(docs),  # same as doc_count for law workspaces
            "documents": [{"id": str(d.id), "filename": d.filename} for d in docs],
        })
    return workspaces_data
