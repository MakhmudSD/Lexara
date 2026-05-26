from __future__ import annotations

import logging
import time
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import httpx
from openai import APIError, APIStatusError, APITimeoutError, AsyncOpenAI, RateLimitError
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from app.core.config import Settings
from app.core.exceptions import AppError

logger = logging.getLogger(__name__)

MAX_CONTEXT_TOKENS = 3000
MAX_CONTEXT_CHARS = MAX_CONTEXT_TOKENS * 4
MAX_HISTORY_ENTRIES = 6
SYSTEM_PROMPT = """You are Lexara, an intelligent document assistant.
Your primary job is to answer questions using the provided document context.

Guidelines:
- If the answer is clearly in the context, answer directly and cite the relevant part.
- If the context is partially relevant, use it and supplement with general knowledge,
  but note which parts come from the document.
- If the question is a greeting, general question, or follow-up clarification
  that does not require document context, answer helpfully and naturally.
- If the question is completely unrelated to the documents and no context is
  provided, say: "I don't have information about that in your documents,
  but I can try to help generally: [answer]"
- Never say "I cannot answer" to a follow-up question about something you
  already discussed. Use conversation history to stay coherent.
- Keep answers concise, clear, and professional.
- Respond in the same language the user is writing in."""

PRICING = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-3.5-turbo": (0.50, 1.50),
}


@dataclass
class TokenUsageData:
    model: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    estimated_cost_usd: float
    latency_ms: float
    context_chunks_used: int


@lru_cache(maxsize=1)
def _get_client(api_key: str) -> AsyncOpenAI:
    return AsyncOpenAI(
        api_key=api_key,
        timeout=httpx.Timeout(30.0, connect=5.0),
    )


def _trim_history(history: list[dict[str, Any]] | None) -> list[dict[str, str]]:
    if not history:
        return []

    trimmed: list[dict[str, str]] = []
    for item in history[-MAX_HISTORY_ENTRIES:]:
        role = str(item.get("role", "")).strip()
        content = str(item.get("content", "")).strip()
        if role not in {"user", "assistant"} or not content:
            continue
        trimmed.append({"role": role, "content": content})
    return trimmed


def _prepare_context_chunks(context_chunks: list[str]) -> list[str]:
    if not context_chunks:
        return []

    selected: list[str] = []
    used_chars = 0

    for index, chunk in enumerate(context_chunks):
        normalized = chunk.strip()
        if not normalized:
            continue

        remaining = MAX_CONTEXT_CHARS - used_chars
        if index == 0 and remaining <= 0:
            remaining = MAX_CONTEXT_CHARS

        if not selected:
            selected_chunk = normalized[:MAX_CONTEXT_CHARS]
            selected.append(selected_chunk)
            used_chars += len(selected_chunk)
            continue

        if remaining <= 0:
            break

        selected_chunk = normalized[:remaining]
        if not selected_chunk:
            break
        selected.append(selected_chunk)
        used_chars += len(selected_chunk)
        if used_chars >= MAX_CONTEXT_CHARS:
            break

    return selected


def build_messages(
    question: str,
    context_chunks: list[str],
    history: list[dict[str, Any]] | None = None,
) -> tuple[list[dict[str, str]], int, int]:
    prepared_chunks = _prepare_context_chunks(context_chunks)
    messages: list[dict[str, str]] = [{"role": "system", "content": SYSTEM_PROMPT}]
    messages.extend(_trim_history(history))
    if prepared_chunks:
        context_text = "\n\n---\n\n".join(prepared_chunks)
        user_content = (
            f"Document context:\n{context_text}\n\n"
            f"Question: {question}"
        )
    else:
        user_content = question
    messages.append({"role": "user", "content": user_content})
    estimated_prompt_tokens = max(1, sum(len(message["content"]) for message in messages) // 4)
    return messages, estimated_prompt_tokens, len(prepared_chunks)


def estimate_cost(model: str, prompt_tokens: int, completion_tokens: int) -> float:
    inp, out = PRICING.get(model, (1.00, 2.00))
    return round((prompt_tokens * inp + completion_tokens * out) / 1_000_000, 6)


def build_token_usage_data(
    *,
    model: str,
    prompt_tokens: int,
    answer_text: str,
    latency_ms: float,
    context_chunks_used: int,
) -> TokenUsageData:
    completion_tokens = max(0, len(answer_text) // 4)
    total_tokens = prompt_tokens + completion_tokens
    return TokenUsageData(
        model=model,
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        estimated_cost_usd=estimate_cost(model, prompt_tokens, completion_tokens),
        latency_ms=latency_ms,
        context_chunks_used=context_chunks_used,
    )


@retry(
    retry=retry_if_exception_type((RateLimitError, APIStatusError)),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    stop=stop_after_attempt(3),
    reraise=True,
)
async def _create_completion(
    api_key: str,
    settings: Settings,
    messages: list[dict[str, str]],
) -> Any:
    """Create a non-streaming chat completion."""
    try:
        return await _get_client(api_key).chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            max_tokens=settings.chat_max_tokens,
            temperature=settings.chat_temperature,
            top_p=settings.chat_top_p,
            presence_penalty=0.0,
            frequency_penalty=settings.chat_frequency_penalty,
        )
    except APIStatusError as exc:
        if exc.status_code in {429, 500}:
            raise
        raise AppError(502, "llm_error", str(exc)) from exc


@retry(
    retry=retry_if_exception_type((RateLimitError, APIStatusError)),
    wait=wait_exponential(multiplier=1, min=2, max=60),
    stop=stop_after_attempt(3),
    reraise=True,
)
async def _create_stream_completion(
    api_key: str,
    settings: Settings,
    messages: list[dict[str, str]],
) -> Any:
    """Create a streaming chat completion."""
    try:
        return await _get_client(api_key).chat.completions.create(
            model=settings.chat_model,
            messages=messages,
            max_tokens=settings.chat_max_tokens,
            temperature=settings.chat_temperature,
            top_p=settings.chat_top_p,
            presence_penalty=0.0,
            frequency_penalty=settings.chat_frequency_penalty,
            stream=True,
        )
    except APIStatusError as exc:
        if exc.status_code in {429, 500}:
            raise
        raise AppError(502, "llm_error", str(exc)) from exc


def _map_openai_error(exc: Exception) -> AppError:
    if isinstance(exc, RateLimitError):
        return AppError(
            429,
            "rate_limited",
            "OpenAI rate limit reached. Please wait a moment and try again.",
        )
    if isinstance(exc, APITimeoutError):
        return AppError(
            504,
            "llm_timeout",
            "LLM response timed out. Try a shorter question.",
        )
    if isinstance(exc, APIError):
        return AppError(502, "llm_error", str(exc))
    if isinstance(exc, AppError):
        return exc
    return AppError(502, "llm_error", str(exc))


async def generate_answer(
    question: str,
    context_chunks: list[str],
    settings: Settings,
    history: list[dict[str, Any]] | None = None,
) -> tuple[str, TokenUsageData]:
    """Generate one final answer from retrieved context."""
    if not settings.openai_api_key:
        raise AppError(
            500,
            "missing_openai_api_key",
            "OPENAI_API_KEY is not configured on the server.",
        )

    messages, estimated_prompt_tokens, context_chunks_used = build_messages(
        question,
        context_chunks,
        history,
    )
    started_at = time.perf_counter()

    try:
        response = await _create_completion(
            settings.openai_api_key,
            settings,
            messages,
        )
        answer = response.choices[0].message.content or ""
        duration_ms = round((time.perf_counter() - started_at) * 1000, 3)
        usage = build_token_usage_data(
            model=settings.chat_model,
            prompt_tokens=estimated_prompt_tokens,
            answer_text=answer,
            latency_ms=duration_ms,
            context_chunks_used=context_chunks_used,
        )
        return answer, usage
    except Exception as exc:
        raise _map_openai_error(exc) from exc
    finally:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 3)
        logger.info(
            "llm_answer_generated model=%s prompt_tokens=%s context_chunks_used=%s duration_ms=%s",
            settings.chat_model,
            estimated_prompt_tokens,
            context_chunks_used,
            duration_ms,
        )


async def generate_answer_stream(
    question: str,
    context_chunks: list[str],
    settings: Settings,
    history: list[dict[str, Any]] | None = None,
) -> Any:
    """Stream answer deltas from the LLM."""
    if not settings.openai_api_key:
        raise AppError(
            500,
            "missing_openai_api_key",
            "OPENAI_API_KEY is not configured on the server.",
        )

    messages, estimated_prompt_tokens, context_chunks_used = build_messages(
        question,
        context_chunks,
        history,
    )
    started_at = time.perf_counter()

    try:
        stream = await _create_stream_completion(
            settings.openai_api_key,
            settings,
            messages,
        )
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                yield delta
    except Exception as exc:
        raise _map_openai_error(exc) from exc
    finally:
        duration_ms = round((time.perf_counter() - started_at) * 1000, 3)
        logger.info(
            "llm_answer_streamed model=%s prompt_tokens=%s context_chunks_used=%s duration_ms=%s",
            settings.chat_model,
            estimated_prompt_tokens,
            context_chunks_used,
            duration_ms,
        )
