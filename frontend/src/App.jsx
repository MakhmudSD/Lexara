import { useEffect, useState } from 'react';
import ChatPage from './pages/ChatPage';
import AdminPage from './pages/AdminPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MyPage from './pages/MyPage';
import LandingPage from './pages/LandingPage';
import PrivacyPage from './pages/PrivacyPage';
import TermsPage from './pages/TermsPage';
import { LexaraIcon, LexaraLogo } from './assets/LexaraLogo';
import './App.css';

function App() {
  const [workspaceId, setWorkspaceId] = useState(() => localStorage.getItem('workspaceId') || '');
  const [workspaceName, setWorkspaceName] = useState(() => localStorage.getItem('workspaceName') || '');
  const [currentPage, setCurrentPage] = useState('chat');
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

  const navigate = (newPage) => {
    setTransitioning(true);
    window.setTimeout(() => {
      setPage(newPage);
      setTransitioning(false);
    }, 300);
  };

  useEffect(() => {
    if (workspaceId) {
      localStorage.setItem('workspaceId', workspaceId);
    }
  }, [workspaceId]);

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

  const goAppSection = (section) => {
    setPage('app');
    setCurrentPage(section);
    window.location.hash = '';
  };

  return (
    <div className="app">
      {accessDenied && (
        <div style={{ position: 'absolute', top: 12, left: 12, color: '#dc2626', fontFamily: 'var(--font-mono)', zIndex: 20 }}>
          {accessDenied}
        </div>
      )}
      {page === 'app' && currentPage === 'chat' && (
        <ChatPage
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          onChangeWorkspace={setWorkspaceId}
          onWorkspaceNameChange={setWorkspaceName}
          authUser={{ name: 'Admin', role: 'Admin' }}
          onGoAdmin={() => goAppSection('admin')}
        />
      )}
      {page === 'admin' && authUser.role === 'admin' && <AdminPage onGoAsk={() => goAppSection('chat')} />}
      {page === 'app' && currentPage === 'mypage' && <MyPage authUser={authUser} onLogout={() => { setAuthUser(null); navigate('landing'); }} />}
    </div>
  );
}

export default App;
