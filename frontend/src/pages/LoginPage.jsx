import { useEffect, useState } from 'react';
import { forgotPassword, login, resetPassword } from '../api/auth';
import { useTranslation } from '../i18n/useTranslation';
import { LexaraLogo } from '../assets/LexaraLogo';
import ThreeBackground from '../components/ThreeBackground';
import '../styles/AuthPages.css';

export default function LoginPage({ onLogin, onRegister, onHome }) {
  const { t, lang, setLang, languageOptions } = useTranslation();
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('theme');
    if (stored) return stored === 'dark';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [forgotModal, setForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showReset, setShowReset] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setLoginError('');
    try {
      const data = await login(email.trim(), password);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('authUser', JSON.stringify({
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        created_at: data.created_at,
      }));
      onLogin({
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        created_at: data.created_at,
      });
    } catch (err) {
      setLoginError(t('login_error_credentials') || 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (event) => {
    event.preventDefault();
    setForgotLoading(true);
    setForgotStatus('');
    try {
      const response = await forgotPassword(forgotEmail.trim());
      if (response?.token) {
        setResetToken(response.token);
        setShowReset(true);
        setForgotStatus(t('forgot_dev_note') || 'In development, this would be emailed to you.');
      } else {
        setForgotStatus(response?.message || t('forgot_sent_ok') || 'If that email exists, a reset link was sent.');
      }
    } catch (err) {
      setForgotStatus(err.response?.data?.error?.message || 'Unable to request password reset.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleReset = async (event) => {
    event.preventDefault();
    setForgotLoading(true);
    setForgotStatus('');
    try {
      await resetPassword(resetToken.trim(), newPassword);
      setForgotStatus(t('reset_success') || 'Password reset! You can now sign in.');
      window.setTimeout(() => {
        setForgotModal(false);
        setShowReset(false);
        setForgotEmail('');
        setResetToken('');
        setNewPassword('');
        setForgotStatus('');
      }, 1000);
    } catch (err) {
      setForgotStatus(err.response?.data?.error?.message || t('reset_failed') || 'Reset failed.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <ThreeBackground />
      <div className="auth-left-panel">
        <div className="auth-left-content">
          <LexaraLogo height={40} textColor="rgba(255,255,255,0.9)" />
          <p className="auth-left-tagline">{t('login_left_tagline') || 'Query your documents with precision'}</p>
          <p className="auth-left-sub">{t('login_left_sub') || 'Upload PDFs, ask questions, get cited answers in seconds.'}</p>
          <div className="auth-left-chips">
            <div className="auth-left-chip">
              <span className="auth-left-chip-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              {t('login_chip_private') || 'Private & isolated workspaces'}
            </div>
            <div className="auth-left-chip">
              <span className="auth-left-chip-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              </span>
              {t('login_chip_formats') || 'PDF, DOCX, TXT support'}
            </div>
            <div className="auth-left-chip">
              <span className="auth-left-chip-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </span>
              {t('login_chip_streaming') || 'Streaming answers with sources'}
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right-panel">
      <div className="auth-top-controls">
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          className="auth-lang-select"
          aria-label="Language"
        >
          {languageOptions.map((opt) => (
            <option key={opt.code} value={opt.code}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="auth-theme-toggle"
          onClick={() => setDarkMode(!darkMode)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          )}
        </button>
      </div>
      <div className="auth-container">
        <div className="auth-logo-row">
          <LexaraLogo height={36} onClick={onHome} style={{ cursor: 'pointer' }} />
        </div>
        <div className="auth-heading">
          <h1>{t('login_welcome') || 'Welcome back'}</h1>
          <p>{t('login_subtitle') || 'Sign in to your workspace'}</p>
        </div>
        <div className="auth-card">
          <form className="auth-form" onSubmit={(event) => {
            event.preventDefault();
            handleLogin();
          }}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-email">{t('login_email_label') || 'Email'}</label>
              <input
                id="login-email"
                className={`auth-input ${loginError ? 'error' : ''}`}
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setLoginError('');
                }}
                disabled={loading}
                autoComplete="email"
                required
              />
            </div>
            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="login-password">{t('login_password_label') || 'Password'}</label>
                <button type="button" className="auth-forgot" disabled={loading} onClick={() => setForgotModal(true)}>{t('login_forgot_btn') || 'Forgot password?'}</button>
              </div>
              <input
                id="login-password"
                className={`auth-input ${loginError ? 'error' : ''}`}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setLoginError('');
                }}
                disabled={loading}
                autoComplete="current-password"
                required
              />
              {loginError && (
                <p style={{ color: '#dc2626', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
                  {loginError}
                </p>
              )}
            </div>
            <button type="button" className="auth-btn" disabled={loading} onClick={handleLogin}>
              {loading && <span className="auth-btn-spinner" />}
              <span>{loading ? (t('login_btn_loading') || 'Signing in…') : (t('login_btn') || 'Sign in')}</span>
            </button>
          </form>
          <hr className="auth-divider" />
          <div className="auth-footer">
            <span>{t('login_no_account') || "Don't have an account?"} </span>
            <button type="button" onClick={onRegister} disabled={loading}>{t('login_create') || 'Create one'}</button>
          </div>
          <p className="auth-admin-note">{t('login_admin_note') || 'Need admin access? Ask your team administrator.'}</p>
          <div className="auth-footer">
            <button type="button" className="auth-back-btn" onClick={onHome}>{t('login_back') || '← Back to home'}</button>
          </div>
        </div>
        <p className="auth-legal">{t('login_legal') || 'By signing in you agree to our'} <span>{t('login_terms') || 'Terms'}</span> and <span>{t('login_privacy') || 'Privacy Policy'}</span></p>
      </div>
      </div>

      {forgotModal && (
        <div className="auth-modal-overlay" onClick={() => setForgotModal(false)}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-modal-header">
              <h2>{showReset ? (t('reset_title') || 'Reset password') : (t('forgot_title') || 'Forgot password')}</h2>
              <button type="button" className="auth-modal-close" onClick={() => setForgotModal(false)}>×</button>
            </div>
            {!showReset ? (
              <form className="auth-modal-form" onSubmit={handleForgot}>
                <label className="auth-label" htmlFor="forgot-email">{t('forgot_email_label') || 'Email'}</label>
                <input
                  id="forgot-email"
                  className="auth-input"
                  type="email"
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  placeholder="you@company.com"
                  required
                  disabled={forgotLoading}
                />
                <button type="submit" className="auth-btn" disabled={forgotLoading}>
                  {forgotLoading ? (t('forgot_sending') || 'Sending…') : (t('forgot_send_btn') || 'Send reset token')}
                </button>
                {forgotStatus && <p className="auth-modal-status">{forgotStatus}</p>}
              </form>
            ) : (
              <form className="auth-modal-form" onSubmit={handleReset}>
                <label className="auth-label" htmlFor="reset-token">{t('reset_token_label') || 'Reset token'}</label>
                <input
                  id="reset-token"
                  className="auth-input"
                  type="text"
                  value={resetToken}
                  onChange={(event) => setResetToken(event.target.value)}
                  required
                  disabled={forgotLoading}
                />
                <label className="auth-label" htmlFor="new-password">{t('reset_new_password_label') || 'New password'}</label>
                <input
                  id="new-password"
                  className="auth-input"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder={t('reset_min_chars') || 'At least 8 characters'}
                  minLength={8}
                  required
                  disabled={forgotLoading}
                />
                <button type="submit" className="auth-btn" disabled={forgotLoading}>
                  {forgotLoading ? (t('reset_btn_loading') || 'Resetting…') : (t('reset_btn') || 'Reset password')}
                </button>
                {forgotStatus && <p className="auth-modal-status">{forgotStatus}</p>}
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
