# RAG MVP API — End-to-End Flow

## Directory structure

```
backend/
├── app/
│   ├── crud/
│   │   ├── document.py
│   │   └── workspace.py
│   ├── db/
│   │   ├── __init__.py      # sync engine + SessionLocal + get_db
│   │   └── models.py
│   ├── routes/
│   │   ├── health.py        # GET /health
│   │   ├── workspaces.py    # POST/GET /workspaces
│   │   ├── documents.py     # POST /documents/upload
│   │   └── chat.py          # POST /chat/query
│   ├── schemas/
│   │   ├── health.py
│   │   ├── workspace.py
│   │   ├── document.py
│   │   └── chat.py
│   ├── services/
│   │   ├── chunking.py
│   │   ├── embeddings.py
│   │   ├── vector_store.py
│   │   ├── document_processing.py
│   │   └── query_service.py
│   └── main.py
├── data/
│   ├── faiss/               # persisted indexes + mappings
│   └── uploads/
└── scripts/
    └── seed_dev.py
```

## Required pip installs

From `backend/`:

```bash
source venv/bin/activate
pip install -r requirements.txt
```

New MVP dependencies:

- `sentence-transformers` — local embeddings (`all-MiniLM-L6-v2`, 384-dim)
- `torch` — required by sentence-transformers
- `faiss-cpu`, `numpy` — vector search

## Environment

`.env` example:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/rag_mvp
LOCAL_EMBEDDING_MODEL=all-MiniLM-L6-v2
EMBEDDING_DIMENSION=384
FAISS_DATA_DIR=./data/faiss
UPLOADS_DATA_DIR=./data/uploads
```

## Run server

```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Seed dev organization (first time)

```bash
cd backend
python scripts/seed_dev.py
```

Copy `ORGANIZATION_ID` from output.

## Example curl requests

### 1. Health

```bash
curl -s http://localhost:8000/health | jq
```

Expected: `{"status":"ok"}`

### 2. Create workspace

```bash
ORG_ID="<your-organization-uuid>"

curl -s -X POST http://localhost:8000/workspaces \
  -H "Content-Type: application/json" \
  -d "{\"organization_id\":\"$ORG_ID\",\"name\":\"MVP Workspace\"}" | jq
```

Save `id` as `WORKSPACE_ID`.

### 3. List workspaces

```bash
curl -s "http://localhost:8000/workspaces?organization_id=$ORG_ID" | jq
```

### 4. Upload a text document

```bash
WORKSPACE_ID="<your-workspace-uuid>"

echo "FastAPI is a modern Python web framework. PostgreSQL stores relational data. FAISS enables fast similarity search. Sentence transformers create dense embeddings for retrieval." > sample.txt

curl -s -X POST http://localhost:8000/documents/upload \
  -F "workspace_id=$WORKSPACE_ID" \
  -F "file=@sample.txt;type=text/plain" | jq
```

### 5. Query (retrieval only)

```bash
curl -s -X POST http://localhost:8000/chat/query \
  -H "Content-Type: application/json" \
  -d "{\"workspace_id\":\"$WORKSPACE_ID\",\"question\":\"What is FAISS used for?\",\"top_k\":3}" | jq
```

Expected: `chunks` array with relevant text and similarity `score` values.

## Testing steps

1. Start PostgreSQL and confirm `DATABASE_URL` connects.
2. Run migrations on startup (Alembic via `run_migrations()`).
3. `python scripts/seed_dev.py` to create org.
4. `GET /health` → `ok`.
5. `POST /workspaces` → workspace UUID.
6. `POST /documents/upload` with `.txt` → `chunk_count > 0`, `is_processed: true`.
7. Verify PostgreSQL rows in `documents` and `document_chunks`.
8. Verify files under `backend/data/faiss/`:
   - `{workspace_id}.index`
   - `{workspace_id}.mapping.json`
9. `POST /chat/query` with a question related to uploaded text.
10. Confirm returned chunks mention expected concepts and scores decrease for less relevant hits.

## Verify FAISS retrieval works

1. After upload, inspect mapping file:

```bash
cat backend/data/faiss/<WORKSPACE_ID>.mapping.json
```

You should see `chunk_ids` matching UUIDs in `document_chunks`.

2. Query with a phrase from `sample.txt` (e.g. "similarity search"). Top chunk should contain overlapping terms and have the highest `score`.

3. Query with unrelated text (e.g. "weather forecast"). Scores should be lower; chunks may be empty or weakly related if nothing matches.

4. Upload a second document to the same workspace, query again — top results should pull from both documents when relevant.

## Flow summary

```
POST /documents/upload
  → read UTF-8 text
  → chunk_text()
  → embed_texts() [sentence-transformers]
  → INSERT documents + document_chunks (PostgreSQL)
  → FaissVectorStore.add_embeddings() + persist to disk

POST /chat/query
  → embed_query()
  → FaissVectorStore.search()
  → load chunk rows by UUID
  → return retrieval JSON (no LLM)
```
