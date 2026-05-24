"""Organization repository for database operations."""

from uuid import UUID
from typing import Optional, List
from sqlalchemy.orm import Session
from app.db.models import Organization, User
from app.repositories import BaseRepository


class OrganizationRepository(BaseRepository[Organization]):
    """Repository for Organization model."""
    
    def __init__(self, db: Session):
        super().__init__(db, Organization)
    
    def get_by_slug(self, slug: str) -> Optional[Organization]:
        """Get organization by slug."""
        return self.db.query(Organization).filter(Organization.slug == slug).first()
    
    def get_by_owner(self, owner_id: UUID) -> List[Organization]:
        """Get organizations owned by a user."""
        return self.db.query(Organization).filter(Organization.owner_id == owner_id).all()
    
    def create_organization(self, name: str, slug: str, owner_id: UUID, description: Optional[str] = None) -> Organization:
        """Create a new organization."""
        return self.create(
            name=name,
            slug=slug,
            owner_id=owner_id,
            description=description,
            is_active=True
        )
    
    def get_active_organizations(self, skip: int = 0, limit: int = 100) -> List[Organization]:
        """Get active organizations only."""
        return self.db.query(Organization).filter(Organization.is_active == True).offset(skip).limit(limit).all()
