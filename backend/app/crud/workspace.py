from uuid import UUID
from sqlalchemy.orm import Session
from app.core.exceptions import AppError
from app.db.models import Organization, Workspace


def get_workspace(db: Session, workspace_id: UUID) -> Workspace | None:
    return (
        db.query(Workspace)
        .filter(Workspace.id == workspace_id, Workspace.is_active.is_(True))
        .first()
    )


def get_workspace_or_404(db: Session, workspace_id: UUID) -> Workspace:
    workspace = get_workspace(db, workspace_id)
    if workspace is None:
        raise AppError(404, "workspace_not_found", f"Workspace {workspace_id} was not found.")
    return workspace


def list_workspaces(
    db: Session,
    organization_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Workspace]:
    query = db.query(Workspace).filter(Workspace.is_active.is_(True))
    if organization_id is not None:
        query = query.filter(Workspace.organization_id == organization_id)
    return query.order_by(Workspace.created_at.desc()).offset(skip).limit(limit).all()


def deactivate_workspace(db: Session, workspace_id: UUID) -> Workspace:
    """Soft-delete a workspace by setting is_active = False."""
    workspace = get_workspace_or_404(db, workspace_id)
    workspace.is_active = False
    db.commit()
    db.refresh(workspace)
    return workspace


def create_workspace(db: Session, name: str, organization_id: UUID | None = None) -> Workspace:
    normalized_name = name.strip()
    
    # Check for existing workspace with same name in this org
    existing = (
        db.query(Workspace)
        .filter(
            Workspace.organization_id == organization_id,
            Workspace.name == normalized_name,
            Workspace.is_active.is_(True),
        )
        .first()
    )
    if existing:
        raise AppError(
            409,
            "workspace_name_taken",
            f"A workspace named '{normalized_name}' already exists. Choose a different name.",
        )

    workspace = Workspace(
        organization_id=organization_id,
        name=normalized_name,
        is_active=True,
    )
    db.add(workspace)
    db.commit()
    db.refresh(workspace)
    return workspace
