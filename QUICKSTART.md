# 🚀 RAG MVP - Quick Start Guide

## Prerequisites
- Python 3.8+
- Node.js 18+
- npm or yarn

## ⚡ 5-Minute Setup

### Terminal 1: Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py
```
✅ Backend ready at: http://localhost:8000

### Terminal 2: Frontend
```bash
cd frontend
npm install
npm run dev
```
✅ Frontend ready at: http://localhost:5173

## 🎯 First Steps

1. **Open**: http://localhost:5173 in your browser
2. **Enter workspace ID**: e.g., `my-workspace-1`
3. **Upload document**: Drag/drop or click to upload PDF/DOCX/TXT
4. **Ask a question**: Type a question about your document
5. **View sources**: Click "📚 Sources" to see retrieved documents

## 📊 Admin Dashboard

Access at: http://localhost:5173 → ⚙️ Admin

Tabs:
- **Logs** - Request logs with latency
- **Requests** - All API requests
- **Documents** - Uploaded files
- **Retrievals** - Search history
- **Health** - System status

## 🔌 API Testing

API Docs: http://localhost:8000/docs

### Upload a document
```bash
curl -X POST "http://localhost:8000/upload" \
  -F "file=@sample.pdf" \
  -F "workspace_id=test-workspace"
```

### Ask a question
```bash
curl -X POST "http://localhost:8000/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": "test-workspace",
    "question": "What is this document about?"
  }'
```

## 🛑 Troubleshooting

**Port already in use?**
```bash
# Frontend on different port
cd frontend && npm run dev -- --port 3000
```

**Backend not responding?**
```bash
# Check backend is running
curl http://localhost:8000/admin/health
```

**Build errors?**
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📦 Production Build

```bash
# Build frontend
cd frontend && npm run build

# Output: dist/
# Deploy dist/ to any static host (Vercel, Netlify, S3, etc)
```

## 📝 Environment Variables

**Backend** (backend/.env)
```
OPENAI_API_KEY=your-key-here
STORAGE_TYPE=sqlite
DEBUG=false
```

**Frontend** (frontend/.env)
```
VITE_API_URL=http://localhost:8000
```

## 📚 Architecture

```
Browser (React)
    ↓ HTTP/CORS
FastAPI Backend (Python)
    ├── Document Processing
    ├── Vector Embeddings
    ├── Semantic Search
    └── LLM Integration
```

## 🎨 UI Features

✅ Chat interface with typing indicator
✅ Source documents with relevance scores
✅ Collapsible source sections
✅ File upload with status
✅ Admin dashboard with tabs
✅ Responsive design (mobile-friendly)
✅ Error messages
✅ Workspace persistence

## 📱 Supported Formats

- PDF (.pdf)
- Word (.docx)
- Text (.txt)

## 🚢 Deployment Checklist

- [ ] Backend: Set OPENAI_API_KEY
- [ ] Backend: Enable CORS for frontend domain
- [ ] Frontend: Update VITE_API_URL to production backend
- [ ] Frontend: npm run build → deploy dist/
- [ ] Test uploads and chat
- [ ] Monitor logs and errors
- [ ] Set up rate limiting
- [ ] Enable authentication (optional)

## ❓ Support

- API Docs: http://localhost:8000/docs
- Frontend README: frontend/README.md
- Backend README: backend/README.md
- Main README: README.md

## 🎯 Next Steps

1. Test with various document types
2. Collect user feedback
3. Identify target niches
4. Plan enhancements
5. Prepare for production

---

**Need help?** Check the README files or API docs!
