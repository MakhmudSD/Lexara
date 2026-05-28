"""SQLAlchemy ORM models for PostgreSQL database."""

from datetime import datetime
from uuid import uuid4
from sqlalchemy import Column, String, DateTime, ForeignKey, Integer, Text, Boolean, Float, Index, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from app.db import Base


class User(Base):
    """User model."""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=True)
    role = Column(String(20), default="user", nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    plan = Column(String(50), default='free', nullable=False)
    plan_expires_at = Column(DateTime, nullable=True)
    referral_code = Column(String(20), nullable=True, unique=True, index=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    organizations = relationship("OrganizationMember", back_populates="user", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="user", cascade="all, delete-orphan")
    password_reset_tokens = relationship("PasswordResetToken", back_populates="user", cascade="all, delete-orphan")
    referrals_made = relationship("Referral", foreign_keys="[Referral.referrer_id]", back_populates="referrer")
    referral_used = relationship("Referral", foreign_keys="[Referral.referred_user_id]", back_populates="referred", uselist=False)

    __table_args__ = (
        Index("idx_user_email", "email"),
        Index("idx_user_is_active", "is_active"),
    )


class Organization(Base):
    """Organization/Workspace model."""
    __tablename__ = "organizations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    settings = Column(JSON, default={}, nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    members = relationship("OrganizationMember", back_populates="organization", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="organization", cascade="all, delete-orphan")
    workspaces = relationship("Workspace", back_populates="organization", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_org_slug", "slug"),
        Index("idx_org_owner_id", "owner_id"),
        Index("idx_org_is_active", "is_active"),
    )


class OrganizationMember(Base):
    """Organization membership model."""
    __tablename__ = "organization_members"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    role = Column(String(50), default="member", nullable=False)  # owner, admin, member
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="members")
    user = relationship("User", back_populates="organizations")

    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
        Index("idx_org_member_org_id", "organization_id"),
        Index("idx_org_member_user_id", "user_id"),
        Index("idx_org_member_role", "role"),
    )


class Workspace(Base):
    """Workspace model (tenant)."""
    __tablename__ = "workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    organization = relationship("Organization", back_populates="workspaces")
    documents = relationship("Document", back_populates="workspace", cascade="all, delete-orphan")
    users = relationship("UserWorkspace", back_populates="workspace", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_workspace_org_id", "organization_id"),
        Index("idx_workspace_is_active", "is_active"),
    )


class UserWorkspace(Base):
    """Workspace ownership model."""
    __tablename__ = "user_workspaces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id"), nullable=False, index=True)
    role = Column(String(20), default="owner", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User")
    workspace = relationship("Workspace", back_populates="users")

    __table_args__ = (
        UniqueConstraint("user_id", "workspace_id", name="uq_user_workspace"),
    )


class Document(Base):
    """Document model."""
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)

    organization_id = Column(
        UUID(as_uuid=True),
        ForeignKey("organizations.id"),
        nullable=False,
        index=True
    )

    workspace_id = Column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id"),
        nullable=False,
        index=True
    )

    filename = Column(String(255), nullable=False)

    content_type = Column(String(100), nullable=False)

    file_size_bytes = Column(Integer, nullable=False)

    storage_path = Column(String(500), nullable=False)

    chunk_count = Column(Integer, default=0)

    is_processed = Column(Boolean, default=False, index=True)

    is_active = Column(Boolean, default=True, index=True)

    document_metadata = Column("metadata", JSON, default=dict, nullable=False)

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False
    )

    # Relationships
    organization = relationship(
        "Organization",
        back_populates="documents"
    )

    workspace = relationship(
        "Workspace",
        back_populates="documents"
    )

    chunks = relationship(
        "DocumentChunk",
        back_populates="document",
        cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_document_org_id", "organization_id"),
        Index("idx_document_workspace_id", "workspace_id"),
        Index("idx_document_is_processed", "is_processed"),
        Index("idx_document_is_active", "is_active"),
    )
    
class DocumentChunk(Base):
    """Document chunk model."""
    __tablename__ = "document_chunks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    document_id = Column(UUID(as_uuid=True), ForeignKey("documents.id"), nullable=False, index=True)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    embedding = Column(JSON, default=None, nullable=True)  # Vector stored as JSON
    has_embedding = Column(Boolean, default=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    document = relationship("Document", back_populates="chunks")

    __table_args__ = (
        UniqueConstraint("document_id", "chunk_index", name="uq_document_chunk"),
        Index("idx_chunk_document_id", "document_id"),
        Index("idx_chunk_has_embedding", "has_embedding"),
    )


class AuditLog(Base):
    """Audit log model."""
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    organization_id = Column(UUID(as_uuid=True), ForeignKey("organizations.id"), nullable=False, index=True)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    action = Column(String(100), nullable=False)
    resource_type = Column(String(100), nullable=False)
    resource_id = Column(String(100), nullable=True)
    details = Column(JSON, default={}, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Relationships
    user = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("idx_audit_org_id", "organization_id"),
        Index("idx_audit_user_id", "user_id"),
        Index("idx_audit_created_at", "created_at"),
        Index("idx_audit_action", "action"),
    )


class TokenUsage(Base):
    """Persistent token usage records."""

    __tablename__ = "token_usage"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    request_id = Column(String(64), nullable=True, index=True)
    workspace_id = Column(String(64), nullable=True, index=True)
    user_id = Column(String(64), nullable=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    model = Column(String(50), nullable=False)
    prompt_tokens = Column(Integer, nullable=False, default=0)
    completion_tokens = Column(Integer, nullable=False, default=0)
    total_tokens = Column(Integer, nullable=False, default=0)
    estimated_cost_usd = Column(Float, nullable=False, default=0.0)
    latency_ms = Column(Float, nullable=False, default=0.0)
    mode = Column(String(20), nullable=False, default="retrieval")
    context_chunks_used = Column(Integer, nullable=False, default=0)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    token = Column(String(64), nullable=False, unique=True, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="password_reset_tokens")


class Referral(Base):
    """Tracks referral relationships between users."""
    __tablename__ = "referrals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    referrer_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, index=True)
    referred_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True, index=True)
    code = Column(String(20), nullable=False, unique=True, index=True)
    status = Column(String(20), default="pending", nullable=False)  # pending, converted, rewarded
    converted_at = Column(DateTime, nullable=True)
    rewarded_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    referrer = relationship("User", foreign_keys=[referrer_id], back_populates="referrals_made")
    referred = relationship("User", foreign_keys=[referred_user_id], back_populates="referral_used")

    __table_args__ = (
        Index("idx_referral_referrer_id", "referrer_id"),
        Index("idx_referral_code", "code"),
        Index("idx_referral_status", "status"),
    )


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    workspace_id = Column(UUID(as_uuid=True), nullable=True, index=True)
    title = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow, nullable=False)
    turns = relationship("ConversationTurn", back_populates="conversation",
                         cascade="all, delete-orphan",
                         order_by="ConversationTurn.turn_index")


class ConversationTurn(Base):
    __tablename__ = "conversation_turns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    conversation_id = Column(UUID(as_uuid=True),
                              ForeignKey("conversations.id"),
                              nullable=False, index=True)
    turn_index = Column(Integer, nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    sources = Column(JSON, default=[], nullable=False)
    latency_ms = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    conversation = relationship("Conversation", back_populates="turns")

    __table_args__ = (
        UniqueConstraint("conversation_id", "turn_index",
                         name="uq_conversation_turn"),
    )
