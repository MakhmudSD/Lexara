"""Korean government law API client (data.go.kr)."""

from __future__ import annotations

import logging
from typing import Any

import httpx

logger = logging.getLogger(__name__)

_SEARCH_PATH = "/lawSearchList.do"
_TEXT_PATH = "/lawService.do"


class KoreanLawService:
    def __init__(self, settings: Any) -> None:
        self.api_key = settings.korean_law_api_key
        self.base_url = settings.korean_law_api_base_url.rstrip("/")

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    async def search_laws(
        self, query: str, page: int = 1, per_page: int = 10
    ) -> list[dict]:
        """Search the law index and return structured law metadata."""
        params = {
            "serviceKey": self.api_key,
            "query": query,
            "numOfRows": per_page,
            "pageNo": page,
            "type": "json",
        }
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                resp = await client.get(self.base_url + _SEARCH_PATH, params=params)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.error("korean_law_search_failed query=%r: %s", query, exc)
            return []

        return self._parse_search_results(data)

    async def get_law_text(self, law_id: str) -> str:
        """Fetch full law text and inject [ARTICLE N] markers."""
        params = {
            "serviceKey": self.api_key,
            "ID": law_id,
            "type": "json",
        }
        try:
            async with httpx.AsyncClient(timeout=60) as client:
                resp = await client.get(self.base_url + _TEXT_PATH, params=params)
                resp.raise_for_status()
                data = resp.json()
        except Exception as exc:
            logger.error("korean_law_text_fetch_failed law_id=%r: %s", law_id, exc)
            return ""

        return self._format_law_text(data)

    async def fetch_and_format(self, query: str) -> str:
        """Search → first result → full text → formatted string for embedding."""
        results = await self.search_laws(query, per_page=1)
        if not results:
            logger.warning("korean_law_no_results query=%r", query)
            return ""

        law_id = results[0].get("law_id", "")
        if not law_id:
            return ""

        return await self.get_law_text(law_id)

    # ------------------------------------------------------------------
    # Parsing helpers
    # ------------------------------------------------------------------

    def _parse_search_results(self, data: dict) -> list[dict]:
        try:
            items = (
                data.get("LawSearch", {})
                .get("law", [])
            )
            if isinstance(items, dict):
                items = [items]
        except (AttributeError, TypeError):
            return []

        out: list[dict] = []
        for item in items:
            out.append({
                "law_id": str(item.get("법령ID", item.get("lawId", ""))),
                "law_name": str(item.get("법령명한글", item.get("lawName", ""))),
                "law_type": str(item.get("법령구분명", item.get("lawType", ""))),
                "promulgation_date": str(item.get("공포일자", item.get("promulgationDate", ""))),
            })
        return out

    def _format_law_text(self, data: dict) -> str:
        """Convert the API article list into [ARTICLE N] marked plain text."""
        try:
            law_data = data.get("법령", data.get("law", {}))
            if isinstance(law_data, list):
                law_data = law_data[0] if law_data else {}

            articles = law_data.get("조문", law_data.get("articles", []))
            if isinstance(articles, dict):
                articles = [articles]
        except (AttributeError, TypeError):
            return ""

        parts: list[str] = []
        for idx, article in enumerate(articles, start=1):
            title = str(article.get("조문제목", article.get("title", ""))).strip()
            content = str(article.get("조문내용", article.get("content", ""))).strip()
            header = f"[ARTICLE {idx}]"
            if title:
                header = f"[ARTICLE {idx}] {title}"
            parts.append(f"{header}\n{content}" if content else header)

        return "\n\n".join(parts)
