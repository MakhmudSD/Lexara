#!/usr/bin/env python3
"""
Seed a dev user + organization for local MVP testing.

Usage (from backend/):
  python scripts/seed_dev.py
"""

from __future__ import annotations

import sys
from pathlib import Path
from uuid import uuid4

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from app.db import SessionLocal  # noqa: E402
from app.db.models import Organization, User  # noqa: E402


def main() -> None:
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == "dev@example.com").first()
        if existing:
            org = db.query(Organization).filter(Organization.owner_id == existing.id).first()
            print("Dev user already exists.")
            print(f"USER_ID={existing.id}")
            if org:
                print(f"ORGANIZATION_ID={org.id}")
            return

        user = User(
            id=uuid4(),
            email="dev@example.com",
            password_hash="dev-only-not-for-production",
            full_name="Dev User",
            is_active=True,
        )
        db.add(user)
        db.flush()

        organization = Organization(
            id=uuid4(),
            name="Dev Organization",
            slug=f"dev-org-{str(user.id)[:8]}",
            description="Local development organization",
            owner_id=user.id,
            is_active=True,
        )
        db.add(organization)
        db.commit()

        print("Seeded development tenant:")
        print(f"USER_ID={user.id}")
        print(f"ORGANIZATION_ID={organization.id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
