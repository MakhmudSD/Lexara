import { lazy, Suspense, useEffect, useState } from 'react';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const MyPage = lazy(() => import('./pages/MyPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PrivacyPage = lazy(() => import('./pages/PrivacyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const RefundPage = lazy(() => import('./pages/RefundPage'));
import { LexaraIcon, LexaraLogo } from './assets/LexaraLogo';
import { useTranslation } from './i18n/useTranslation';
import './App.css';

function App() {
  const { t, lang, setLang, currentLanguage, languageOptions } = useTranslation();
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
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [page]);

  useEffect(() => {
    if (!authUser) return;

    const syncFromHash = () => {
      if (window.location.hash === '#admin') {
        if (authUser.role?.toLowerCase() === 'admin') {
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

  const lazySuspense = (node) => (
    <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#9d9b96', fontSize: 14 }}>Loading…</div>}>
      {node}
    </Suspense>
  );

  if (page === 'landing') {
    return lazySuspense(
      <LandingPage
        onSignIn={() => navigate('login')}
        onSignUp={() => navigate('register')}
        onPrivacy={() => navigate('privacy')}
        onTerms={() => navigate('terms')}
        onRefund={() => navigate('refund')}
      />
    );
  }

  if (page === 'privacy') {
    return lazySuspense(<PrivacyPage onHome={() => navigate('landing')} />);
  }

  if (page === 'refund') {
    return lazySuspense(<RefundPage onHome={() => navigate('landing')} />);
  }
  if (page === 'terms') {
    return lazySuspense(<TermsPage onHome={() => navigate('landing')} />);
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
      <nav className="app-nav">
        <div className="nav-brand">
          <LexaraLogo height={32} />
        </div>

        <div className="nav-controls">
          <div className="nav-links">
            <button
              className={`nav-button ${page === 'app' && currentPage === 'chat' ? 'active' : ''}`}
              onClick={() => goAppSection('chat')}
            >
              <span className="nav-dot" />
              {t('query')}
            </button>
            <button
              className={`nav-button ${page === 'admin' ? 'active' : ''}`}
              onClick={() => { if (authUser.role?.toLowerCase() === 'admin') { navigate('admin'); } }}
              style={authUser.role?.toLowerCase() !== 'admin' ? { display: 'none' } : undefined}
            >
              <span className="nav-dot" />
              Admin
            </button>
          </div>

          <label className="lang-switcher" style={{ direction: 'ltr' }}>
            <span className="lang-switcher-label">{t('language_label')}</span>
            <div className="lang-switcher-select-wrap">
              <span style={{ marginRight: 6 }}>{currentLanguage.flag}</span>
              <select
                className="lang-select"
                value={lang}
                onChange={(event) => setLang(event.target.value)}
              >
                {languageOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <div className="nav-links">
            <button
              className={`nav-button ${page === 'app' && currentPage === 'mypage' ? 'active' : ''}`}
              onClick={() => goAppSection('mypage')}
            >
              <span className="nav-dot" />
              {t('my_page')}
            </button>
          </div>
        </div>
      </nav>

      <div className="app-content">
        {accessDenied && (
          <div style={{ margin: '20px auto', color: '#dc2626', fontFamily: 'var(--font-mono)' }}>{accessDenied}</div>
        )}
        {page === 'app' && currentPage === 'chat' && lazySuspense(
          <ChatPage
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            onChangeWorkspace={setWorkspaceId}
            onWorkspaceNameChange={setWorkspaceName}
          />
        )}
        {page === 'admin' && authUser.role?.toLowerCase() === 'admin' && lazySuspense(<AdminPage onGoChat={() => goAppSection('chat')} />)}
        {page === 'app' && currentPage === 'mypage' && lazySuspense(<MyPage authUser={authUser} onLogout={() => { setAuthUser(null); navigate('landing'); }} />)}
      </div>
    </div>
  );
}

export default App;
