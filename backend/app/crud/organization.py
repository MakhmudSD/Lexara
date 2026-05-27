from __future__ import annotations

from sqlalchemy.orm import Session

from app.db.models import Organization


def get_org_by_slug(db: Session, slug: str) -> Organization | None:
    """
    Fetch an active organization by its slug.
    Used by org-scoped route middleware.
    Phase 3: this will also verify JWT membership.
    """
    return (
        db.query(Organization)
        .filter(Organization.slug == slug, Organization.is_active.is_(True))
        .first()
    )
