#!/usr/bin/env python3
"""
Promote a user to admin role in production.
Usage: python scripts/make_admin.py email@example.com
Run from backend/ directory with DATABASE_URL set.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


def make_admin(email: str) -> None:
    from app.db import SessionLocal
    from app.db.models import User

    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            print(f"ERROR: User not found: {email}")
            sys.exit(1)
        user.role = "admin"
        db.commit()
        print(f"OK: {email} is now admin (role=admin)")
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python scripts/make_admin.py email@example.com")
        sys.exit(1)
    make_admin(sys.argv[1])
