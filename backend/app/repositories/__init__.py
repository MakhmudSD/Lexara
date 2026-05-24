"""Base repository with common database operations."""

from typing import TypeVar, Generic, List, Optional, Type
from uuid import UUID
from sqlalchemy.orm import Session
from app.db.models import Base

T = TypeVar('T', bound=Base)


class BaseRepository(Generic[T]):
    """Generic repository for common CRUD operations."""
    
    def __init__(self, db: Session, model: Type[T]):
        self.db = db
        self.model = model
    
    def create(self, **kwargs) -> T:
        """Create a new entity."""
        obj = self.model(**kwargs)
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj
    
    def get_by_id(self, id: UUID) -> Optional[T]:
        """Get entity by ID."""
        return self.db.query(self.model).filter(self.model.id == id).first()
    
    def get_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        """Get all entities with pagination."""
        return self.db.query(self.model).offset(skip).limit(limit).all()
    
    def update(self, id: UUID, **kwargs) -> Optional[T]:
        """Update an entity."""
        obj = self.get_by_id(id)
        if obj:
            for key, value in kwargs.items():
                setattr(obj, key, value)
            self.db.commit()
            self.db.refresh(obj)
        return obj
    
    def delete(self, id: UUID) -> bool:
        """Delete an entity."""
        obj = self.get_by_id(id)
        if obj:
            self.db.delete(obj)
            self.db.commit()
            return True
        return False
