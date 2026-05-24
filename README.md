<<<<<<< HEAD
# RAG MVP - Workspace-based Retrieval-Augmented Generation

A production-ready demo system for RAG workspaces with FastAPI backend and React frontend.

## 📁 Project Structure

```
RAG-MVP/
├── backend/           # FastAPI server
│   ├── app/
│   │   ├── api/       # REST endpoints
│   │   ├── services/  # Business logic
│   │   ├── storage/   # Document storage
│   │   └── core/      # Configuration & middleware
│   ├── requirements.txt
│   └── main.py
├── frontend/          # React + Vite frontend
│   ├── src/
│   ├── package.json
│   └── README.md
└── sample.pdf         # Example document
```

## 🚀 Quick Start

### Backend Setup

```bash
cd backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Backend runs on: `http://localhost:8000`
API docs: `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on: `http://localhost:5173`

## 💻 Features

### Backend
- ✅ Document upload (PDF, DOCX, TXT)
- ✅ Workspace-based organization
- ✅ Vector embeddings with chunking
- ✅ Semantic search & retrieval
- ✅ RAG chat with sources
- ✅ Admin dashboard endpoints
- ✅ Request logging & observability

### Frontend
- ✅ Workspace selector
- ✅ Document uploader
- ✅ Chat interface with source attribution
- ✅ Admin dashboard (logs, requests, documents, health)
- ✅ Responsive design (desktop & mobile)
- ✅ Error handling & loading states
- ✅ localStorage persistence

## 📊 System Architecture

```
User Browser
    ↓
React Frontend (5173)
    ↓
API Requests (Axios)
    ↓
FastAPI Backend (8000)
    ├── Document Processing
    ├── Vector Embeddings
    ├── Vector DB (Storage)
    └── LLM Integration
```

## 🔌 API Endpoints

### Public
- `POST /upload` - Upload document
- `POST /chat` - Chat with workspace

### Admin
- `GET /admin/logs` - View logs
- `GET /admin/requests` - Request history
- `GET /admin/documents` - Document inventory
- `GET /admin/retrievals` - Retrieval history
- `GET /admin/health` - System health

See `frontend/README.md` for detailed API docs.

## 🎯 Usage

1. **Start Backend**: `cd backend && python main.py`
2. **Start Frontend**: `cd frontend && npm run dev`
3. **Open Browser**: `http://localhost:5173`
4. **Create Workspace**: Enter a workspace ID
5. **Upload Documents**: Upload PDF/DOCX/TXT files
6. **Ask Questions**: Chat with your documents
7. **View Admin**: Check logs, requests, documents

## 🛠️ Configuration

### Backend `.env`
```
OPENAI_API_KEY=your_key
STORAGE_TYPE=sqlite  # or in_memory
DEBUG=false
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:8000
```

## 📦 Tech Stack

**Backend**
- FastAPI
- Pydantic
- SQLite/in-memory storage
- Vector embeddings
- LLM integration

**Frontend**
- React 18
- Vite
- Axios
- Vanilla CSS

## 🚢 Production Deployment

### Backend
1. Build Docker image
2. Deploy to cloud (AWS, GCP, Azure)
3. Set environment variables
4. Enable CORS for frontend domain

### Frontend
1. `npm run build`
2. Deploy `dist/` to static host (Vercel, Netlify)
3. Set `VITE_API_URL` to production backend

## 📝 Development

### Add Features
1. Backend: Add endpoint in `app/api/routes/`
2. Frontend: Add API client in `src/api/`
3. Frontend: Create page/component in `src/pages/` or `src/components/`
4. Test end-to-end

### Debug
- Backend: `python main.py` (Uvicorn debug mode)
- Frontend: Open DevTools → Network/Console
- API Docs: `http://localhost:8000/docs`

## 🧪 Testing

```bash
# Backend tests (add as needed)
pytest backend/tests/

# Frontend tests (add with Vitest)
npm run test
```

## 📚 Documentation

- **Backend**: `backend/README.md` (if exists)
- **Frontend**: `frontend/README.md`
- **API**: `http://localhost:8000/docs`

## ⚠️ Known Limitations

- No user authentication (add as needed)
- SQLite for demo (use PostgreSQL for production)
- Vector storage in-memory (scale to vector DB)
- Single LLM provider (abstraction layer exists)

## 🗺️ Roadmap

- [ ] User authentication & authorization
- [ ] Multi-user workspaces
- [ ] Advanced search filters
- [ ] Export/sharing
- [ ] Performance monitoring
- [ ] Cost tracking per workspace
- [ ] Custom model selection
- [ ] Rate limiting & quotas

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/my-feature`
3. Commit changes: `git commit -am 'Add feature'`
4. Push branch: `git push origin feature/my-feature`
5. Open pull request

## 📄 License

This project is part of the RAG MVP system. See LICENSE file for details.

## 🎯 Next Steps

**For Demonstration**:
1. Test with sample documents
2. Collect user feedback
3. Identify niche use cases
4. Plan next features

**For Production**:
1. Set up CI/CD pipeline
2. Add monitoring & alerts
3. Implement authentication
4. Scale to production infrastructure
5. Set up customer onboarding

---

**Ready to go?** Start the backend and frontend following the Quick Start section above!
=======
# RAG-project
This is RAG project built with FastApi and React
>>>>>>> 5f5998b181ed5347c411f2c5b2db10403cf46b4a
