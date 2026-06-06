"""Uzbek law scraper — fetches from lex.uz public law pages."""
from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

UZBEK_LAWS = [
    {"name": "Constitution of Uzbekistan", "url": "https://lex.uz/en/docs/35869"},
    {"name": "Labour Code of Uzbekistan", "url": "https://lex.uz/en/docs/3483018"},
    {"name": "Civil Code of Uzbekistan Part 1", "url": "https://lex.uz/en/docs/111181"},
    {"name": "Criminal Code of Uzbekistan", "url": "https://lex.uz/en/docs/111457"},
    {"name": "Law on Personal Data", "url": "https://lex.uz/en/docs/6612945"},
]


@dataclass
class UzbekLaw:
    name: str
    text: str
    url: str


class UzbekLawScraper:
    HEADERS = {
        "User-Agent": "Mozilla/5.0 (compatible; LexaraBot/1.0; +https://lexara-top.vercel.app)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
    }

    def fetch_law(self, url: str, law_name: str) -> UzbekLaw | None:
        """Fetch and parse a single law from lex.uz."""
        try:
            response = requests.get(url, headers=self.HEADERS, timeout=30)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, "html.parser")

            for tag in soup(["script", "style", "nav", "footer", "header"]):
                tag.decompose()

            content = soup.find("div", class_=re.compile(r"content|law|text|body", re.I))
            if not content:
                content = soup.find("main") or soup.find("article") or soup.body

            if not content:
                logger.warning("No content found for %s", law_name)
                return None

            raw_text = content.get_text(separator="\n", strip=True)

            lines = []
            for line in raw_text.splitlines():
                line = line.strip()
                if len(line) < 3:
                    continue
                if any(skip in line.lower() for skip in ["cookie", "javascript", "login", "register"]):
                    continue
                lines.append(line)

            text = "\n".join(lines)
            text = re.sub(
                r"(Article\s+\d+[\.\)])",
                r"\n[\1]",
                text,
                flags=re.IGNORECASE,
            )

            if len(text) < 500:
                logger.warning("Too little content for %s (%d chars)", law_name, len(text))
                return None

            logger.info("Fetched %s: %d chars", law_name, len(text))
            return UzbekLaw(name=law_name, text=text, url=url)

        except Exception as exc:
            logger.error("Failed to fetch %s: %s", law_name, exc)
            return None

    def fetch_all(self) -> list[UzbekLaw]:
        results = []
        for law in UZBEK_LAWS:
            result = self.fetch_law(law["url"], law["name"])
            if result:
                results.append(result)
            time.sleep(1)
        return results
