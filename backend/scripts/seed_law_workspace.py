#!/usr/bin/env python3
"""
Create the "Lexara Legal" organization and "Korean Law Database" workspace.

Usage (from backend/):
  python scripts/seed_law_workspace.py

Outputs:
  WORKSPACE_ID=<uuid>
"""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.db import SessionLocal  # noqa: E402
from app.db.models import Organization, OrganizationMember, User, Workspace  # noqa: E402

ORG_NAME = "Lexara Legal"
ORG_SLUG = "lexara-legal"
WORKSPACE_NAME = "Korean Law Database"
SEED_USER_EMAIL = "admin@lexara.app"


def main() -> None:
    db = SessionLocal()
    try:
        # Reuse existing workspace if already seeded
        ws = db.query(Workspace).filter(Workspace.name == WORKSPACE_NAME).first()
        if ws:
            print(f"Workspace already exists: {ws.name}")
            print(f"WORKSPACE_ID={ws.id}")
            # Backfill description if not yet set
            if not ws.description:
                ws.description = (
                    "Pre-loaded with Korean statutes including Personal Information Protection Act, "
                    "Labor Standards Act, Civil Act, Criminal Act, and the Constitution. "
                    "Updated regularly."
                )
                db.commit()
                print("Updated workspace description.")
            return

        # Find or create a seed admin user (owner of the org)
        seed_user = db.query(User).filter(User.email == SEED_USER_EMAIL).first()
        if seed_user is None:
            from app.services.auth_service import hash_password
            seed_user = User(
                id=uuid4(),
                email=SEED_USER_EMAIL,
                hashed_password=hash_password("changeme-seed-only"),
                full_name="Lexara Admin",
                role="admin",
                is_active=True,
            )
            db.add(seed_user)
            db.flush()
            print(f"Created seed admin user: {SEED_USER_EMAIL}")

        # Find or create the organization
        org = db.query(Organization).filter(Organization.slug == ORG_SLUG).first()
        if org is None:
            org = Organization(
                id=uuid4(),
                name=ORG_NAME,
                slug=ORG_SLUG,
                owner_id=seed_user.id,
                is_active=True,
            )
            db.add(org)
            db.flush()

            member = OrganizationMember(
                id=uuid4(),
                organization_id=org.id,
                user_id=seed_user.id,
                role="owner",
            )
            db.add(member)
            db.flush()
            print(f"Created organization: {ORG_NAME}")

        # Create the workspace
        workspace = Workspace(
            id=uuid4(),
            organization_id=org.id,
            name=WORKSPACE_NAME,
            description=(
                "Pre-loaded with Korean statutes including Personal Information Protection Act, "
                "Labor Standards Act, Civil Act, Criminal Act, and the Constitution. "
                "Updated regularly."
            ),
            is_active=True,
        )
        db.add(workspace)
        db.commit()
        db.refresh(workspace)

        print(f"Created workspace: {WORKSPACE_NAME}")
        print(f"WORKSPACE_ID={workspace.id}")

    finally:
        db.close()


if __name__ == "__main__":
    main()
