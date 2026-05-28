import { useState, useEffect, useCallback } from 'react';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyPage from './pages/MyPage';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import { LexaraIcon } from './assets/LexaraLogo';
import './App.css';

const STORAGE_KEY_WS   = 'lexara_workspace_id';
const STORAGE_KEY_PAGE = 'lexara_page';

export default function App() {
  const [page, setPage] = useState(() => (localStorage.getItem('authUser') ? 'app' : 'landing'));
  const [transitioning, setTransitioning] = useState(false);
  const [authUser, setAuthUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('authUser'));
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState('login');
  const [accessDenied, setAccessDenied] = useState('');
  
  // App-level state (when page === 'app')
  const [workspaceId, setWorkspaceId] = useState(
    () => localStorage.getItem(STORAGE_KEY_WS) || ''
  );
  const [workspaceName, setWorkspaceName] = useState('');
  const [currentPage, setCurrentPage] = useState(
    () => localStorage.getItem(STORAGE_KEY_PAGE) || 'chat'
  );

  const navigate = (newPage) => {
    setTransitioning(true);
    window.setTimeout(() => {
      setPage(newPage);
      setTransitioning(false);
    }, 300);
  };

  useEffect(() => {
    if (workspaceId) localStorage.setItem(STORAGE_KEY_WS, workspaceId);
  }, [workspaceId]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_PAGE, currentPage);
  }, [currentPage]);

  useEffect(() => {
    if (!authUser) return;

    const syncFromHash = () => {
      if (window.location.hash === '#admin') {
        if (authUser.role === 'admin') {
          setPage('admin');
          setAccessDenied('');
        } else {
          setAccessDenied('Access denied');
          setPage('app');
          window.setTimeout(() => {
            window.location.hash = '';
            setAccessDenied('');
          }, 1200);
        }
      }
    };

    syncFromHash();
    window.addEventListener('hashchange', syncFromHash);
    return () => window.removeEventListener('hashchange', syncFromHash);
  }, [authUser]);

  const handleWorkspaceChange = useCallback((id) => {
    setWorkspaceId(id);
    setWorkspaceName('');
  }, []);

  if (transitioning) {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#f8f6f1',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <LexaraIcon size={40} />
          <div style={{ width: 32, height: 2, background: '#e8e6e0', borderRadius: 1, overflow: 'hidden' }}>
            <div style={{ height: '100%', background: '#2356d8', borderRadius: 1, animation: 'loadbar 1s ease-in-out infinite' }} />
          </div>
        </div>
      </div>
    );
  }

  if (page === 'landing') {
    return (
      <LandingPage
        onSignIn={() => navigate('login')}
        onSignUp={() => navigate('register')}
        onPrivacy={() => navigate('privacy')}
        onTerms={() => navigate('terms')}
      />
    );
  }

  if (page === 'privacy') {
    return <PrivacyPage onHome={() => navigate('landing')} />;
  }

  if (page === 'terms') {
    return <TermsPage onHome={() => navigate('landing')} />;
  }

  if (page === 'register') {
    return (
      <RegisterPage
        onSuccess={(user) => { setAuthUser(user); setPage('app'); }}
        onBackToLogin={() => { setAuthMode('login'); navigate('login'); }}
        onHome={() => navigate('landing')}
      />
    );
  }

  if (!authUser || page === 'login') {
    return (
      <LoginPage
        onLogin={(user) => { setAuthUser(user); setPage('app'); }}
        onRegister={() => { setAuthMode('register'); navigate('register'); }}
        onHome={() => navigate('landing')}
      />
    );
  }

  // App page with sidebar navigation
  if (page === 'app') {
    return (
      <div style={{ display: 'flex', height: '100dvh', overflow: 'hidden' }}>
        {accessDenied && (
          <div style={{ position: 'absolute', top: 12, left: 12, color: '#dc2626', fontFamily: 'var(--font-mono)', zIndex: 20 }}>
            {accessDenied}
          </div>
        )}
        {currentPage === 'chat' && (
          <ChatPage
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            onChangeWorkspace={handleWorkspaceChange}
            onWorkspaceNameChange={setWorkspaceName}
            authUser={{ name: 'Admin', role: 'Admin' }}
            onGoAdmin={() => setCurrentPage('admin')}
          />
        )}
        {currentPage === 'admin' && (
          <AdminPage onGoChat={() => setCurrentPage('chat')} />
        )}
        {currentPage === 'mypage' && (
          <MyPage authUser={authUser} onLogout={() => { setAuthUser(null); navigate('landing'); }} />
        )}
      </div>
    );
  }

  // Admin page at top level (legacy #admin hash support)
  if (page === 'admin' && authUser.role === 'admin') {
    return <AdminPage onGoChat={() => setPage('app')} />;
  }

  return null;
}
