# Lexara — RAG SaaS Platform

A production-grade Retrieval-Augmented Generation platform. Upload documents, ask questions in plain English, get answers with source citations. Built for teams that live in document-heavy workflows.

🔗 **Live:** [lexara-top.vercel.app](https://lexara-top.vercel.app)
📦 **Code:** [github.com/MakhmudSD/RAG-project](https://github.com/MakhmudSD/RAG-project)

---

## Tech Stack

**Backend**
- FastAPI + Uvicorn
- PostgreSQL + SQLAlchemy + Alembic migrations
- FAISS vector store (persisted to disk)
- OpenAI `gpt-4o-mini` + `text-embedding-3-small`
- JWT authentication (python-jose + passlib/bcrypt)
- Multi-tenant: Organizations → Members → Workspaces → Documents

**Frontend**
- React 19 + Vite
- Axios
- Three.js (3D landing page background)
- Responsive, mobile-friendly

---

## Features

- **JWT authentication** — register, login, token-based session
- **Multi-workspace** — each workspace has isolated document storage and vector index
- **Tenant-scoped access** — all routes enforce org membership; document and chat endpoints require a valid token
- **Document ingestion** — PDF, DOCX, TXT up to 50MB; chunked, embedded, and indexed on upload
- **Semantic search** — FAISS similarity search over per-workspace vector indexes
- **RAG chat** — retrieved chunks injected as context into `gpt-4o-mini`; sources returned with every answer
- **Admin dashboard** — request logs, latency tracking, document inventory, retrieval history, system health
- **Observability** — request middleware traces every API call with timing, status, and workspace context
- **Billing + support routes** — Stripe webhook integration, support ticket flow

---

## Quick Start

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Copy and fill in your environment variables
cp .env.example .env

# Run migrations
alembic upgrade head

# Seed a dev user and org (optional)
python scripts/seed_dev.py

# Start the server
python main.py
```

Backend: `http://localhost:8000`  
API docs: `http://localhost:8000/docs`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend: `http://localhost:5173`

---

## Environment Variables

**Backend** (`backend/.env`)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/lexara
OPENAI_API_KEY=sk-...
SECRET_KEY=your-secret-key-min-32-chars
ACCESS_TOKEN_EXPIRE_MINUTES=60
DEBUG=false
```

**Frontend** (`frontend/.env`)

```env
VITE_API_URL=http://localhost:8000
```

---

## Architecture

```
Browser (React 19 + Vite)
        ↓ HTTP + JWT
FastAPI Backend
  ├── Auth routes       — register / login / me
  ├── Workspace routes  — CRUD, org-scoped
  ├── Document routes   — upload, list (auth + workspace access check)
  ├── Chat routes       — /query, /stream (JWT identity, quota enforced)
  ├── Admin routes      — logs, requests, documents (admin-only)
  ├── Billing routes    — Stripe checkout, webhooks
  └── Support routes    — ticket creation and admin view
        ↓
PostgreSQL (users, orgs, workspaces, documents, chunks, audit logs)
        ↓
FAISS (per-workspace .index + .mapping.json, persisted to disk)
```

---

## API — Key Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/register` | — | Create account, returns JWT |
| POST | `/auth/login` | — | Login, returns JWT |
| GET | `/auth/me` | ✅ | Current user |
| POST | `/workspaces` | ✅ | Create workspace |
| GET | `/workspaces` | ✅ | List org workspaces |
| POST | `/documents/upload` | ✅ | Upload + embed document |
| GET | `/documents` | ✅ | List workspace documents |
| POST | `/chat/query` | ✅ | RAG query (returns answer + sources) |
| POST | `/chat/stream` | ✅ | Streaming RAG response |
| GET | `/admin/health` | admin | System health |
| GET | `/admin/logs` | admin | Request log |

---

## Testing

103 tests across 11 test files.

```bash
cd backend
source venv/bin/activate
pytest tests/ -v
```

Coverage includes: auth routes, auth service, workspace CRUD, workspace routes, workspace name validation, chat quota, document upload, retrieval correctness, workspace auth scoping.

---

## Project Structure

```
RAG-MVP/
├── backend/
│   ├── app/
│   │   ├── api/routes/      # Admin routes
│   │   ├── routes/          # Auth, chat, documents, workspaces, billing, support
│   │   ├── core/            # Config, middleware, auth dependency, runtime
│   │   ├── db/              # SQLAlchemy models, session, Alembic
│   │   ├── services/        # Auth, LLM, embedding, chunking, R2 storage
│   │   ├── schemas/         # Pydantic request/response models
│   │   ├── crud/            # Database operations
│   │   └── repositories/    # Repository pattern (User, Document, etc.)
│   ├── tests/               # 103 passing tests
│   ├── scripts/             # seed_dev.py
│   ├── alembic/             # Database migrations
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── pages/           # Landing, Auth, Dashboard, Chat, Admin
│   │   ├── components/      # Shared UI components
│   │   └── styles/          # Per-page CSS
│   └── package.json
└── README.md
```

---

## Roadmap

- [x] JWT authentication and tenant isolation
- [x] Multi-workspace with org membership enforcement
- [x] FAISS vector storage (disk-persisted)
- [x] RAG chat with source attribution
- [x] Admin dashboard with observability
- [x] 103-test backend suite
- [ ] Async document ingestion (background task + status polling)
- [ ] Redis caching layer
- [ ] Rate limiting per workspace
- [ ] Cost tracking per workspace / user
- [ ] Export / sharing
- [ ] Custom model selection

---

## License

MIT