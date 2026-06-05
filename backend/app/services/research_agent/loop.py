"""Plan → Research → Reflect → Write research loop using OpenAI."""

from __future__ import annotations

import json
import logging
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.config import Settings

logger = logging.getLogger(__name__)

_PLAN_PROMPT = """\
You are a research planner. Given the topic below, output a JSON object with:
- "plan": a 2-3 sentence research strategy
- "queries": a list of 3-5 specific search queries to investigate this topic

Topic: {topic}

Respond with valid JSON only."""

_REFLECT_PROMPT = """\
You are a research critic. Review the gathered evidence below and output a JSON object with:
- "reflection": 2-3 sentences identifying what the evidence covers well and any important gaps
- "follow_up_queries": 0-2 additional queries to fill the most critical gaps (empty list if none needed)

Evidence summary:
{evidence_summary}

Respond with valid JSON only."""

_REPORT_PROMPT = """\
You are a research analyst. Write a concise, well-structured report on the topic below,
drawing on the provided evidence. Use markdown headers. Be factual and cite sources by filename or URL.

Topic: {topic}

Evidence:
{evidence}

Write the report now."""


async def run_research_loop(
    *,
    topic: str,
    workspace_id: UUID,
    db: Session,
    settings: Settings,
    include_web: bool = True,
) -> dict:
    """Execute the four-phase research loop and return a result dict."""
    from openai import AsyncOpenAI
    from app.services.research_agent.tools import search_workspace_documents, search_web

    if not settings.openai_api_key:
        raise ValueError("OPENAI_API_KEY is required for the research agent.")

    client = AsyncOpenAI(api_key=settings.openai_api_key)

    # --- Phase 1: Plan ---
    plan_resp = await client.chat.completions.create(
        model=settings.chat_model,
        messages=[{"role": "user", "content": _PLAN_PROMPT.format(topic=topic)}],
        temperature=0.3,
    )
    plan_raw = plan_resp.choices[0].message.content or "{}"
    try:
        plan_data = json.loads(plan_raw)
    except json.JSONDecodeError:
        plan_data = {"plan": plan_raw, "queries": [topic]}

    plan_text: str = plan_data.get("plan", "")
    queries: list[str] = plan_data.get("queries", [topic])

    # --- Phase 2: Research ---
    all_chunks: list[dict] = []
    search_log: list[dict] = []

    for query in queries[:5]:
        doc_results = search_workspace_documents(db, workspace_id, query, settings)
        web_results = search_web(query, settings.tavily_api_key) if include_web else []
        all_chunks.extend(doc_results)
        all_chunks.extend(web_results)
        search_log.append({"query": query, "doc_hits": len(doc_results), "web_hits": len(web_results)})

    # Deduplicate by text/content
    seen: set[str] = set()
    unique_chunks: list[dict] = []
    for c in all_chunks:
        key = (c.get("text") or c.get("content") or "")[:120]
        if key and key not in seen:
            seen.add(key)
            unique_chunks.append(c)

    evidence_summary = "\n".join(
        f"- {c.get('filename') or c.get('url', 'web')}: {(c.get('text') or c.get('content', ''))[:200]}"
        for c in unique_chunks[:20]
    )

    # --- Phase 3: Reflect ---
    reflect_resp = await client.chat.completions.create(
        model=settings.chat_model,
        messages=[{"role": "user", "content": _REFLECT_PROMPT.format(evidence_summary=evidence_summary or "(no evidence found)")}],
        temperature=0.3,
    )
    reflect_raw = reflect_resp.choices[0].message.content or "{}"
    try:
        reflect_data = json.loads(reflect_raw)
    except json.JSONDecodeError:
        reflect_data = {"reflection": reflect_raw, "follow_up_queries": []}

    reflection: str = reflect_data.get("reflection", "")
    follow_ups: list[str] = reflect_data.get("follow_up_queries", [])

    for query in follow_ups[:2]:
        doc_results = search_workspace_documents(db, workspace_id, query, settings)
        web_results = search_web(query, settings.tavily_api_key) if include_web else []
        for c in doc_results + web_results:
            key = (c.get("text") or c.get("content") or "")[:120]
            if key and key not in seen:
                seen.add(key)
                unique_chunks.append(c)

    # --- Phase 4: Write ---
    evidence_str = "\n\n".join(
        f"Source: {c.get('filename') or c.get('url', 'web')}\n{c.get('text') or c.get('content', '')}"
        for c in unique_chunks[:15]
    )
    report_resp = await client.chat.completions.create(
        model=settings.chat_model,
        messages=[{"role": "user", "content": _REPORT_PROMPT.format(topic=topic, evidence=evidence_str or "(no evidence found)")}],
        temperature=0.4,
        max_tokens=1500,
    )
    report: str = report_resp.choices[0].message.content or ""

    return {
        "plan": plan_text,
        "searches": search_log,
        "reflection": reflection,
        "report": report,
    }
