import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
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
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [intendedPlan, setIntendedPlan] = useState(() => sessionStorage.getItem('intended_plan') || null);
  const contentRef = useRef(null);

  // GSAP page transition: fade+slide out, swap state, fade+slide in
  const navigate = (newPage) => {
    const el = contentRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!el || reduced) {
      setTransitioning(true);
      window.setTimeout(() => { setPage(newPage); setTransitioning(false); }, 0);
      return;
    }
    gsap.to(el, {
      opacity: 0,
      y: -16,
      duration: 0.18,
      ease: 'power2.in',
      onComplete: () => {
        setPage(newPage);
        setTransitioning(false);
        gsap.fromTo(el, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
      },
    });
    setTransitioning(true);
  };

  // Keep authUser in sync when logout fires from any source (inactivity, 401, etc.)
  useEffect(() => {
    const sync = () => {
      try {
        const stored = JSON.parse(localStorage.getItem('authUser'));
        setAuthUser(stored);
        if (!stored) {
          setWorkspaceId('');
          setWorkspaceName('');
          setPage('landing');
        }
      } catch {
        setAuthUser(null);
        setWorkspaceId('');
        setWorkspaceName('');
        setPage('landing');
      }
    };
    window.addEventListener('auth:change', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('auth:change', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (workspaceId) {
      localStorage.setItem('workspaceId', workspaceId);
    }
  }, [workspaceId]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : '');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

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
      <div className="app-transition-screen">
        <div className="app-transition-inner">
          <LexaraIcon size={40} />
          <div className="app-transition-bar">
            <div className="app-transition-bar-fill" />
          </div>
        </div>
      </div>
    );
  }

  const SuspenseFallback = () => (
    <div style={{
      position: 'fixed', inset: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--color-bg)', zIndex: 100,
      flexDirection: 'column', gap: 16,
    }}>
      <div className="lexara-spinner" />
      <span style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>Loading…</span>
    </div>
  );

  const lazySuspense = (node) => (
    <Suspense fallback={<SuspenseFallback />}>
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
        onSuccess={(user) => {
          const plan = sessionStorage.getItem('intended_plan');
          sessionStorage.removeItem('intended_plan');
          setAuthUser(user);
          if (plan && plan !== 'free') {
            setIntendedPlan(plan);
            setCurrentPage('mypage');
          }
          setPage('app');
        }}
        onBackToLogin={() => { setAuthMode('login'); navigate('login'); }}
        onHome={() => navigate('landing')}
      />
    );
  }

  if (!authUser || page === 'login') {
    return (
      <LoginPage
        onLogin={(user) => {
          const plan = sessionStorage.getItem('intended_plan');
          sessionStorage.removeItem('intended_plan');
          setWorkspaceId(localStorage.getItem('workspaceId') || '');
          setWorkspaceName(localStorage.getItem('workspaceName') || '');
          setAuthUser(user);
          if (plan && plan !== 'free') {
            setIntendedPlan(plan);
            setCurrentPage('mypage');
          }
          setPage('app');
        }}
        onRegister={() => { setAuthMode('register'); navigate('register'); }}
        onHome={() => navigate('landing')}
      />
    );
  }

  const goAppSection = (section) => {
    const el = contentRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (el && !reduced && section !== currentPage) {
      gsap.to(el, {
        opacity: 0, y: -12, duration: 0.15, ease: 'power2.in',
        onComplete: () => {
          setPage('app');
          setCurrentPage(section);
          window.location.hash = '';
          gsap.fromTo(el, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' });
        },
      });
    } else {
      setPage('app');
      setCurrentPage(section);
      window.location.hash = '';
    }
  };

  const closeMobileNav = () => setMobileNavOpen(false);

  return (
    <div className="app">
      {mobileNavOpen && (
        <div className="mobile-nav-overlay" onClick={closeMobileNav} aria-hidden="true" />
      )}

      <div className={`mobile-nav-sidebar${mobileNavOpen ? ' open' : ''}`}>
        <div className="mobile-nav-header">
          <LexaraLogo height={28} />
          <button className="mobile-nav-close" onClick={closeMobileNav} aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="mobile-nav-links">
          <button
            className={`nav-button${page === 'app' && currentPage === 'chat' ? ' active' : ''}`}
            onClick={() => { goAppSection('chat'); closeMobileNav(); }}
          >
            <span className="nav-dot" />
            {t('query')}
          </button>
          {authUser.role?.toLowerCase() === 'admin' && (
            <button
              className={`nav-button${page === 'admin' ? ' active' : ''}`}
              onClick={() => { navigate('admin'); closeMobileNav(); }}
            >
              <span className="nav-dot" />
              Admin
            </button>
          )}
          <button
            className={`nav-button${page === 'app' && currentPage === 'mypage' ? ' active' : ''}`}
            onClick={() => { goAppSection('mypage'); closeMobileNav(); }}
          >
            <span className="nav-dot" />
            {t('my_page')}
          </button>
        </div>
      </div>

      <nav className="app-nav">
        <div className="nav-brand">
          <button className="hamburger" onClick={() => setMobileNavOpen(true)} aria-label="Open menu">
            <span /><span /><span />
          </button>
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

          <button
            className="theme-toggle"
            onClick={() => setDarkMode(!darkMode)}
            aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkMode ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
        </div>
      </nav>

      <div ref={contentRef} className="app-content" key={`${page}-${currentPage}`}>
        {accessDenied && (
          <div style={{ margin: '20px auto', color: '#dc2626', fontFamily: 'var(--font-mono)' }}>{accessDenied}</div>
        )}
        {page === 'app' && currentPage === 'chat' && lazySuspense(
          <ChatPage
            key={authUser?.id || 'anon'}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            onChangeWorkspace={setWorkspaceId}
            onWorkspaceNameChange={setWorkspaceName}
          />
        )}
        {page === 'admin' && authUser.role?.toLowerCase() === 'admin' && lazySuspense(<AdminPage onGoChat={() => goAppSection('chat')} />)}
        {page === 'app' && currentPage === 'mypage' && lazySuspense(<MyPage authUser={authUser} onLogout={() => {
              localStorage.removeItem('access_token');
              localStorage.removeItem('workspaceId');
              localStorage.removeItem('workspaceName');
              localStorage.removeItem('authUser');
              setWorkspaceId('');
              setWorkspaceName('');
              setAuthUser(null);
              navigate('landing');
            }} intendedPlan={intendedPlan} onIntendedPlanConsumed={() => setIntendedPlan(null)} />)}
      </div>
    </div>
  );
}

export default App;
