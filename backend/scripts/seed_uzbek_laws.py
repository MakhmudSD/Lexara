"""
Seed Uzbek law documents into the Lexara Legal workspace.

Usage:
  SEED_EMAIL=admin@example.com SEED_PASSWORD=secret python scripts/seed_uzbek_laws.py

Credentials are loaded from environment variables — never hardcode.
"""
from __future__ import annotations

import logging
import os
import sys
import tempfile

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import requests

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)

API_BASE = os.getenv("API_BASE", "https://rag-project-production-80af.up.railway.app")
EMAIL = os.getenv("SEED_EMAIL", "")
PASSWORD = os.getenv("SEED_PASSWORD", "")
LEGAL_WORKSPACE_ID = os.getenv("LEGAL_WORKSPACE_ID", "")


def main() -> None:
    if not EMAIL or not PASSWORD:
        logger.error("Set SEED_EMAIL and SEED_PASSWORD environment variables")
        sys.exit(1)

    r = requests.post(f"{API_BASE}/auth/login", json={"email": EMAIL, "password": PASSWORD}, timeout=30)
    r.raise_for_status()
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    logger.info("Authenticated as %s", EMAIL)

    workspace_id = LEGAL_WORKSPACE_ID
    if not workspace_id:
        r = requests.get(f"{API_BASE}/workspaces", headers=headers, timeout=30)
        workspaces = r.json()
        for ws in workspaces:
            if "legal" in ws.get("name", "").lower() or "uzbek" in ws.get("name", "").lower():
                workspace_id = ws["id"]
                logger.info("Using workspace: %s (%s)", ws["name"], workspace_id)
                break
        if not workspace_id:
            logger.error("No legal workspace found. Create one first or set LEGAL_WORKSPACE_ID.")
            sys.exit(1)

    from app.services.law_apis.uzbek_law import UzbekLawScraper
    scraper = UzbekLawScraper()
    laws = scraper.fetch_all()

    if not laws:
        logger.error("No laws fetched. Check network access to lex.uz")
        sys.exit(1)

    with tempfile.TemporaryDirectory() as tmpdir:
        for law in laws:
            filename = law.name.replace(" ", "_") + ".txt"
            filepath = os.path.join(tmpdir, filename)
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(law.text)

            with open(filepath, "rb") as f:
                r = requests.post(
                    f"{API_BASE}/documents/upload",
                    headers=headers,
                    data={"workspace_id": workspace_id},
                    files={"file": (filename, f, "text/plain")},
                    timeout=120,
                )
                if r.ok:
                    logger.info("Uploaded: %s → %d chunks", filename, r.json().get("chunk_count", 0))
                else:
                    logger.error("Failed to upload %s: %s %s", filename, r.status_code, r.text[:200])

    logger.info("Done.")


if __name__ == "__main__":
    main()
