"""User repository for database operations."""

from uuid import UUID
from typing import Optional
from sqlalchemy.orm import Session
from app.db.models import User
from app.repositories import BaseRepository


class UserRepository(BaseRepository[User]):
    """Repository for User model."""
    
    def __init__(self, db: Session):
        super().__init__(db, User)
    
    def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email."""
        return self.db.query(User).filter(User.email == email).first()
    
    def get_active_users(self, skip: int = 0, limit: int = 100):
        """Get active users only."""
        return self.db.query(User).filter(User.is_active == True).offset(skip).limit(limit).all()
    
    def create_user(self, email: str, password_hash: str, full_name: Optional[str] = None) -> User:
        """Create a new user."""
        return self.create(
            email=email,
            password_hash=password_hash,
            full_name=full_name,
            is_active=True
        )
