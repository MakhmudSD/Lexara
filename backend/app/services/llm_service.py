from __future__ import annotations

from functools import lru_cache

from openai import OpenAI

from app.core.config import Settings
from app.core.exceptions import AppError


@lru_cache(maxsize=1)
def _get_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key)


def build_prompt(question: str, context_chunks: list[str]) -> str:
    context = "\n\n".join(context_chunks)
    return (
        "You are a helpful assistant for document question answering.\n"
        "Use only the provided context. If the answer is not in the context, say so clearly.\n\n"
        f"Context:\n{context}\n\n"
        f"Question:\n{question}\n"
    )


def generate_answer(question: str, context_chunks: list[str], settings: Settings) -> str:
    if not settings.openai_api_key:
        raise AppError(
            500,
            "missing_openai_api_key",
            "OPENAI_API_KEY is not configured on the server.",
        )

    response = _get_client(settings.openai_api_key).chat.completions.create(
        model=settings.chat_model,
        messages=[
            {"role": "system", "content": "Answer questions only with the supplied document context."},
            {"role": "user", "content": build_prompt(question, context_chunks)},
        ],
    )
    return response.choices[0].message.content or ""
