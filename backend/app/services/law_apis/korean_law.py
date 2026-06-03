"""Korean law scraper — elaw.klri.re.kr (KLRI public site, no API key required)."""

from __future__ import annotations

import logging
import re

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)


class KoreanLawScraper:
    BASE = "https://elaw.klri.re.kr/eng_service/lawViewContent.do"

    async def fetch_law_text(self, hseq: int) -> tuple[str, str]:
        """Fetch law page, strip HTML, inject [ARTICLE N] markers.

        Returns (law_name, formatted_text). Raises httpx.HTTPError on failure.
        """
        async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
            resp = await client.get(self.BASE, params={"hseq": hseq})
            resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "lxml")

        # Extract law name — try KLRI-specific element classes first
        law_name = ""
        for selector in [".lawname", ".law_title", "h1", "title"]:
            el = soup.select_one(selector)
            if el:
                law_name = el.get_text(strip=True)
                break

        # Full plain text
        raw = soup.get_text(separator="\n")
        # Collapse runs of blank lines
        text = re.sub(r"\n{3,}", "\n\n", raw).strip()

        # Inject [ARTICLE N] markers before "Article N." occurrences
        text = re.sub(r"(?m)^(Article\s+(\d+)\.)", r"[ARTICLE \2] \1", text)

        return law_name, text

    async def discover_and_fetch(self, known_hseqs: list[int]) -> list[dict]:
        """Fetch each hseq; skip blanks, errors, and responses under 500 chars."""
        results: list[dict] = []
        for hseq in known_hseqs:
            try:
                law_name, text = await self.fetch_law_text(hseq)
                if len(text) < 500 or "500 Internal Server Error" in text:
                    logger.warning("law_scraper_skip hseq=%d char_count=%d", hseq, len(text))
                    continue
                results.append(
                    {"hseq": hseq, "law_name": law_name, "text": text, "char_count": len(text)}
                )
            except Exception as exc:
                logger.error("law_scraper_failed hseq=%d: %s", hseq, exc)
        return results
