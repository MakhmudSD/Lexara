"""Initial migration - Create all tables."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '001_initial'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create initial database schema."""
    
    # Users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
    )
    op.create_index('idx_user_email', 'users', ['email'])
    op.create_index('idx_user_is_active', 'users', ['is_active'])

    # Organizations table
    op.create_table(
        'organizations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('slug', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('owner_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('settings', postgresql.JSON(), nullable=False, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
    )
    op.create_index('idx_org_slug', 'organizations', ['slug'])
    op.create_index('idx_org_owner_id', 'organizations', ['owner_id'])
    op.create_index('idx_org_is_active', 'organizations', ['is_active'])

    # Organization members table
    op.create_table(
        'organization_members',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('role', sa.String(50), nullable=False, server_default='member'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('organization_id', 'user_id', name='uq_org_member'),
    )
    op.create_index('idx_org_member_org_id', 'organization_members', ['organization_id'])
    op.create_index('idx_org_member_user_id', 'organization_members', ['user_id'])
    op.create_index('idx_org_member_role', 'organization_members', ['role'])

    # Workspaces table
    op.create_table(
        'workspaces',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_workspace_org_id', 'workspaces', ['organization_id'])
    op.create_index('idx_workspace_is_active', 'workspaces', ['is_active'])

    # Documents table
    op.create_table(
        'documents',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('workspace_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('content_type', sa.String(100), nullable=False),
        sa.Column('file_size_bytes', sa.Integer(), nullable=False),
        sa.Column('storage_path', sa.String(500), nullable=False),
        sa.Column('chunk_count', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('is_processed', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('metadata', postgresql.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['workspace_id'], ['workspaces.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_document_org_id', 'documents', ['organization_id'])
    op.create_index('idx_document_workspace_id', 'documents', ['workspace_id'])
    op.create_index('idx_document_is_processed', 'documents', ['is_processed'])
    op.create_index('idx_document_is_active', 'documents', ['is_active'])

    # Document chunks table
    op.create_table(
        'document_chunks',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('document_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chunk_index', sa.Integer(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('embedding', postgresql.JSON(), nullable=True),
        sa.Column('has_embedding', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['document_id'], ['documents.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('document_id', 'chunk_index', name='uq_document_chunk'),
    )
    op.create_index('idx_chunk_document_id', 'document_chunks', ['document_id'])
    op.create_index('idx_chunk_has_embedding', 'document_chunks', ['has_embedding'])

    # Audit logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('organization_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('action', sa.String(100), nullable=False),
        sa.Column('resource_type', sa.String(100), nullable=False),
        sa.Column('resource_id', sa.String(100), nullable=True),
        sa.Column('details', postgresql.JSON(), nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['organization_id'], ['organizations.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('idx_audit_org_id', 'audit_logs', ['organization_id'])
    op.create_index('idx_audit_user_id', 'audit_logs', ['user_id'])
    op.create_index('idx_audit_created_at', 'audit_logs', ['created_at'])
    op.create_index('idx_audit_action', 'audit_logs', ['action'])


def downgrade() -> None:
    """Drop all tables (for rollback)."""
    op.drop_index('idx_audit_action')
    op.drop_index('idx_audit_created_at')
    op.drop_index('idx_audit_user_id')
    op.drop_index('idx_audit_org_id')
    op.drop_table('audit_logs')
    
    op.drop_index('idx_chunk_has_embedding')
    op.drop_index('idx_chunk_document_id')
    op.drop_table('document_chunks')
    
    op.drop_index('idx_document_is_active')
    op.drop_index('idx_document_is_processed')
    op.drop_index('idx_document_workspace_id')
    op.drop_index('idx_document_org_id')
    op.drop_table('documents')
    
    op.drop_index('idx_workspace_is_active')
    op.drop_index('idx_workspace_org_id')
    op.drop_table('workspaces')
    
    op.drop_index('idx_org_member_role')
    op.drop_index('idx_org_member_user_id')
    op.drop_index('idx_org_member_org_id')
    op.drop_table('organization_members')
    
    op.drop_index('idx_org_is_active')
    op.drop_index('idx_org_owner_id')
    op.drop_index('idx_org_slug')
    op.drop_table('organizations')
    
    op.drop_index('idx_user_is_active')
    op.drop_index('idx_user_email')
    op.drop_table('users')
