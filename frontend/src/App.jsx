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
          <div className="nav-logo">R↑</div>
          <span className="nav-title">Retrieval Engine</span>
        </div>

        <div className="nav-links">
          <button
            className={`nav-button ${currentPage === 'chat' ? 'active' : ''}`}
            onClick={() => setCurrentPage('chat')}
          >
            <span className="nav-dot" />
            Query
          </button>
          <button
            className={`nav-button ${currentPage === 'admin' ? 'active' : ''}`}
            onClick={() => setCurrentPage('admin')}
          >
            <span className="nav-dot" />
            Monitor
          </button>
        </div>
      </nav>

      <div className="app-content">
        {currentPage === 'chat' && (
          <ChatPage workspaceId={workspaceId} onChangeWorkspace={setWorkspaceId} />
        )}
        {currentPage === 'admin' && <AdminPage />}
      </div>
    </div>
  );
}

export default App;
