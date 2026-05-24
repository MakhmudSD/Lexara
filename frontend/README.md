# RAG MVP Frontend

A modern, minimal React + Vite frontend for a Workspace-based RAG (Retrieval-Augmented Generation) system.

## 📁 Project Structure

```
frontend/
├── src/
│   ├── api/                    # API client layer
│   │   ├── client.js           # Axios instance with base config
│   │   ├── chat.js             # Chat API endpoints
│   │   ├── upload.js           # Document upload endpoints
│   │   └── admin.js            # Admin dashboard endpoints
│   ├── pages/                  # Page components
│   │   ├── ChatPage.jsx        # Main chat interface
│   │   └── AdminPage.jsx       # Admin dashboard
│   ├── components/             # Reusable components
│   │   ├── ChatMessage.jsx     # Message bubble component
│   │   ├── FileUploader.jsx    # Document upload component
│   │   └── WorkspaceSelector.jsx # Workspace selection
│   ├── styles/                 # Component styles
│   │   ├── ChatPage.css
│   │   ├── AdminPage.css
│   │   ├── ChatMessage.css
│   │   ├── FileUploader.css
│   │   └── WorkspaceSelector.css
│   ├── App.jsx                 # Main app component
│   ├── App.css                 # App-level styles
│   ├── index.css               # Global styles
│   └── main.jsx                # React entry point
├── public/                     # Static assets
├── .env                        # Environment variables (development)
├── .env.production             # Environment variables (production)
├── package.json
├── vite.config.js
└── index.html
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ (tested with v22.11.0)
- npm or yarn
- FastAPI backend running on `http://localhost:8000`

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

The app will be available at `http://localhost:5173/`

## 🔌 API Integration

The frontend connects to a FastAPI backend with the following endpoints:

### Public Endpoints
- **POST /upload** - Upload documents (PDF, DOCX, TXT)
  - Form data: `file`, `workspace_id`, `user_id` (optional)
  
- **POST /chat** - Send chat queries
  - JSON: `workspace_id`, `question`, `user_id` (optional), `top_k`, `debug`

### Admin Endpoints
- **GET /admin/logs** - Request logs
- **GET /admin/requests** - Request history
- **GET /admin/documents** - Document inventory
- **GET /admin/retrievals** - Retrieval history
- **GET /admin/health** - System health status

Configure the API URL in `.env`:
```
VITE_API_URL=http://localhost:8000
```

## 💻 Features

### 1. Chat Interface
- **Workspace Selection** - Select or create a workspace
- **Document Upload** - Upload PDF, DOCX, or TXT files
- **Chat Messages** - Real-time question/answer interface
- **Source Attribution** - View retrieved source documents with scores
- **Loading States** - Visual feedback during API calls
- **Error Handling** - Clear error messages

### 2. Admin Dashboard
- **Logs** - View request logs with latency info
- **Requests** - Track all API requests
- **Documents** - Manage uploaded documents
- **Retrievals** - View retrieval history
- **Health** - System status and metrics

### 3. Persistent State
- Workspace ID saved to localStorage
- Session persistence across browser refresh

## 🎨 Design System

The UI follows a clean, modern aesthetic inspired by Notion and ChatGPT:

- **Color Palette**:
  - Primary: `#0066cc` (blue)
  - Background: `#ffffff` / `#f5f5f5` (white/light gray)
  - Text: `#1a1a1a` / `#666666` (dark gray)
  - Errors: `#d32f2f` (red)

- **Layout**:
  - Responsive flexbox layout
  - Mobile-friendly with sidebar collapse
  - No heavy CSS frameworks

## 📦 Dependencies

- **React** - UI framework
- **Vite** - Build tool
- **Axios** - HTTP client
- **CSS** - Vanilla CSS for styling

## 🔧 Development

### Environment Variables

Create `.env` for development:
```
VITE_API_URL=http://localhost:8000
```

Create `.env.production` for production:
```
VITE_API_URL=https://your-api-domain.com
```

### Running Tests

```bash
# Currently no tests; can be added with Vitest
npm run test
```

### Building

```bash
# Development build
npm run dev

# Production build
npm run build

# Output is in /dist
```

## 🚢 Production Deployment

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Deploy to hosting** (Vercel, Netlify, etc.):
   - Point to the `dist/` folder
   - Set `VITE_API_URL` environment variable
   - Enable client-side routing (SPA configuration)

3. **CORS Configuration**:
   - Ensure FastAPI backend has CORS enabled for your frontend domain
   - Backend should allow `Content-Type: multipart/form-data` for uploads

## 📱 Browser Support

- Chrome/Edge: Latest
- Firefox: Latest
- Safari: Latest
- Mobile browsers: iOS Safari 13+, Chrome Mobile

## 🛠️ Troubleshooting

### Port 5173 already in use
```bash
npm run dev -- --port 3000
```

### Backend API not responding
1. Check FastAPI is running on port 8000
2. Verify `VITE_API_URL` in `.env`
3. Check CORS configuration in backend
4. Open browser DevTools → Network tab to see requests

### Build fails
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
npm run build
```

## 📝 Next Steps

After getting the frontend running:

1. **User Testing**: Test with real users on various documents
2. **Performance Optimization**: Monitor network requests and add caching
3. **Enhanced Features**: Add file preview, batch uploads, export results
4. **Analytics**: Track user interactions and feature usage
5. **Authentication**: Add user login if needed

## 📄 License

This is part of the RAG MVP project. See main repository for license details.
