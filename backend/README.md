# Lexara Backend

FastAPI backend for Lexara — a multilingual RAG-based document Q&A and
legal research platform.

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   React Frontend │────│   FastAPI Backend │────│   PostgreSQL    │
│   (Vercel)       │    │   (Railway)       │    │   (Supabase)    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │                     │
              ┌─────▼─────┐        ┌──────▼──────┐
              │  pgvector  │        │   OpenAI    │
              │ BM25 hybrid│        │ Embeddings  │
              │  search    │        │ + GPT-4o    │
              └────────────┘        └─────────────┘
```

## Modes

- **Ask** — Document Q&A with streaming responses and source citations
- **Research** — Agentic Plan→Search→Reflect→Write pipeline with Tavily web search
- **Legal** — Korean law database (727 chunks, 5 acts) with article-level citations

## Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Fill in .env values
alembic upgrade head
uvicorn app.main:app --reload
```

## Environment Variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Supabase) |
| `OPENAI_API_KEY` | OpenAI API key |
| `TAVILY_API_KEY` | Tavily search API key |
| `JWT_SECRET` | JWT signing secret |
| `LEXARA_LEGAL_ORG_ID` | UUID of the Lexara Legal organization |

## Key Services

| File | Purpose |
|---|---|
| `app/services/query_service.py` | Hybrid BM25 + pgvector retrieval with CrossEncoder reranking |
| `app/services/llm_service.py` | Mode-specific system prompts + OpenAI completion |
| `app/services/research_agent/loop.py` | Agentic research loop |
| `app/services/llamaindex_ingestion.py` | PDF parsing with OCR fallback |
| `app/routes/research.py` | Research endpoint + SSE streaming |

## Testing

```bash
pytest tests/ -v
```
