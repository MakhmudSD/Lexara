from uuid import UUID
from sqlalchemy import or_
from sqlalchemy.orm import Session
from app.core.exceptions import AppError
from app.db.models import Organization, UserWorkspace, Workspace


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
    user_id: UUID,
    organization_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[Workspace]:
    query = (
        db.query(Workspace)
        .join(UserWorkspace, UserWorkspace.workspace_id == Workspace.id)
        .outerjoin(Organization, Organization.id == Workspace.organization_id)
        .filter(
            Workspace.is_active.is_(True),
            UserWorkspace.user_id == user_id,
            or_(Workspace.organization_id.is_(None), Organization.name != "Lexara Legal"),
        )
    )
    if organization_id is not None:
        query = query.filter(Workspace.organization_id == organization_id)
    return query.order_by(Workspace.created_at.desc()).offset(skip).limit(limit).all()


def count_billable_workspaces(db: Session, user_id: UUID) -> int:
    """
    Count active workspaces that count toward a user's plan limit.
    Excludes "Lexara Legal" org workspaces (shared legal-mode resources,
    e.g. the seeded law database) for the same reason list_workspaces
    excludes them: they aren't a personal workspace slot.
    """
    return (
        db.query(Workspace)
        .join(UserWorkspace, UserWorkspace.workspace_id == Workspace.id)
        .outerjoin(Organization, Organization.id == Workspace.organization_id)
        .filter(
            Workspace.is_active.is_(True),
            UserWorkspace.user_id == user_id,
            or_(Workspace.organization_id.is_(None), Organization.name != "Lexara Legal"),
        )
        .count()
    )


def deactivate_workspace(db: Session, workspace_id: UUID) -> Workspace:
    """Soft-delete a workspace by setting is_active = False."""
    workspace = get_workspace_or_404(db, workspace_id)
    workspace.is_active = False
    db.commit()
    db.refresh(workspace)
    return workspace


def create_workspace(
    db: Session,
    name: str,
    user_id: UUID,
    organization_id: UUID | None = None,
) -> Workspace:
    normalized_name = name.strip()

    # Check for an existing active workspace with the same name owned by this user
    existing = (
        db.query(Workspace)
        .join(UserWorkspace, UserWorkspace.workspace_id == Workspace.id)
        .filter(
            UserWorkspace.user_id == user_id,
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
    db.flush()  # get workspace.id before commit

    membership = UserWorkspace(user_id=user_id, workspace_id=workspace.id, role="owner")
    db.add(membership)
    db.commit()
    db.refresh(workspace)
    return workspace
