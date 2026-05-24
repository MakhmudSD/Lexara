import { useState, useEffect } from 'react';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import './App.css';

function App() {
  const [workspaceId, setWorkspaceId] = useState(() => {
    return localStorage.getItem('workspaceId') || '';
  });
  const [currentPage, setCurrentPage] = useState('chat');

  useEffect(() => {
    if (workspaceId) {
      localStorage.setItem('workspaceId', workspaceId);
    }
  }, [workspaceId]);

  return (
    <div className="app">
      <nav className="app-nav">
        <div className="nav-brand">
          <h1>🧠 RAG System</h1>
        </div>
        <div className="nav-links">
          <button
            className={`nav-button ${currentPage === 'chat' ? 'active' : ''}`}
            onClick={() => setCurrentPage('chat')}
          >
            💬 Chat
          </button>
          <button
            className={`nav-button ${currentPage === 'admin' ? 'active' : ''}`}
            onClick={() => setCurrentPage('admin')}
          >
            ⚙️ Admin
          </button>
        </div>
      </nav>

      <main className="app-content">
        {currentPage === 'chat' && (
          <ChatPage workspaceId={workspaceId} onChangeWorkspace={setWorkspaceId} />
        )}
        {currentPage === 'admin' && <AdminPage />}
      </main>
    </div>
  );
}

export default App;
