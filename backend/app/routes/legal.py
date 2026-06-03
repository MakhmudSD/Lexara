from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.db import models

router = APIRouter(prefix="/legal", tags=["legal"])


@router.get("/workspaces")
def get_legal_workspaces(db: Session = Depends(get_db)):
    """Return all workspaces whose name contains 'Law', 'Legal', or '법'."""
    workspaces = db.query(models.Workspace).filter(
        models.Workspace.name.ilike("%law%") |
        models.Workspace.name.ilike("%legal%") |
        models.Workspace.name.ilike("%법%")
    ).all()

    result = []
    for ws in workspaces:
        doc_count = db.query(models.Document).filter(
            models.Document.workspace_id == ws.id
        ).count()
        result.append({
            "id": str(ws.id),
            "name": ws.name,
            "description": ws.description or "",
            "document_count": doc_count,
            "law_count": doc_count,  # same as doc_count for law workspaces
        })
    return result
