"""Research agent tools: workspace document search and web search via Tavily."""

from __future__ import annotations

import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import Settings

logger = logging.getLogger(__name__)


def search_workspace_documents(
    db: Session,
    workspace_id: UUID,
    query: str,
    settings: Settings,
    top_k: int = 5,
) -> list[dict]:
    """Return the top-k chunks from the workspace that match the query."""
    from app.services.query_service import query_workspace

    results = query_workspace(
        db=db,
        settings=settings,
        workspace_id=workspace_id,
        question=query,
        top_k=top_k,
    )
    return [
        {
            "filename": r.get("filename", ""),
            "text": r.get("text", ""),
            "score": r.get("score", 0.0),
        }
        for r in results
    ]


def search_workspace_documents_fresh(
    workspace_id: UUID,
    query: str,
    top_k: int = 5,
) -> list[dict]:
    """Search workspace documents using a fresh DB session (safe inside async generators)."""
    from app.db import SessionLocal
    from app.core.config import get_settings
    from app.services.query_service import query_workspace

    settings = get_settings()
    db = SessionLocal()
    try:
        results = query_workspace(
            db=db,
            settings=settings,
            workspace_id=workspace_id,
            question=query,
            top_k=top_k,
        )
        return [
            {
                "filename": r.get("filename", ""),
                "text": r.get("text", ""),
                "score": r.get("score", 0.0),
            }
            for r in results
        ]
    except Exception as exc:
        logger.warning("workspace_search_fresh_failed: %s", exc)
        return []
    finally:
        db.close()


def search_web(query: str, tavily_api_key: str, max_results: int = 5) -> list[dict]:
    """Search the web via Tavily API. Returns empty list if key is not set."""
    if not tavily_api_key:
        logger.debug("Tavily API key not set; skipping web search")
        return []
    try:
        import httpx

        resp = httpx.post(
            "https://api.tavily.com/search",
            json={
                "api_key": tavily_api_key,
                "query": query,
                "max_results": max_results,
                "search_depth": "basic",
            },
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        return [
            {
                "url": r.get("url", ""),
                "title": r.get("title", ""),
                "content": r.get("content", ""),
                "score": r.get("score", 0.0),
            }
            for r in data.get("results", [])
        ]
    except Exception as exc:
        logger.warning("Tavily web search failed: %s", exc)
        return []
