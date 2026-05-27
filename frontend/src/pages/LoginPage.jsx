import { useState } from 'react';
import { forgotPassword, login, resetPassword } from '../api/auth';
import { useTranslation } from '../i18n/useTranslation';
import { LexaraLogo } from '../assets/LexaraLogo';
import '../styles/AuthPages.css';

export default function LoginPage({ onLogin, onRegister, onHome }) {
  const { t } = useTranslation();
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
      localStorage.setItem('authToken', data.access_token);
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
      setLoginError('Invalid email or password. Please try again.');
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
        setForgotStatus('In production, this would be emailed to you.');
      } else {
        setForgotStatus(response?.message || 'If that email exists, a reset link was sent.');
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
      setForgotStatus('Password reset! You can now sign in.');
      window.setTimeout(() => {
        setForgotModal(false);
        setShowReset(false);
        setForgotEmail('');
        setResetToken('');
        setNewPassword('');
        setForgotStatus('');
      }, 1000);
    } catch (err) {
      setForgotStatus(err.response?.data?.error?.message || 'Reset failed.');
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-container">
        <div className="auth-logo-row">
          <LexaraLogo height={36} onClick={onHome} style={{ cursor: 'pointer' }} />
        </div>
        <div className="auth-heading">
          <h1>Welcome back</h1>
          <p>Sign in to your workspace</p>
        </div>
        <div className="auth-card">
          <form className="auth-form" onSubmit={(event) => {
            event.preventDefault();
            handleLogin();
          }}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-email">Email</label>
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
                <label className="auth-label" htmlFor="login-password">Password</label>
                <button type="button" className="auth-forgot" disabled={loading} onClick={() => setForgotModal(true)}>Forgot password?</button>
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
              <span>{loading ? 'Signing in…' : 'Sign in'}</span>
            </button>
          </form>
          <hr className="auth-divider" />
          <div className="auth-footer">
            <span>Don&apos;t have an account? </span>
            <button type="button" onClick={onRegister} disabled={loading}>Create one</button>
          </div>
          <p className="auth-admin-note">Need admin access? Ask your team administrator.</p>
          <div className="auth-footer">
            <button type="button" className="auth-back-btn" onClick={onHome}>← Back to home</button>
          </div>
        </div>
        <p className="auth-legal">By signing in you agree to our <span>Terms</span> and <span>Privacy Policy</span></p>
      </div>

      {forgotModal && (
        <div className="auth-modal-overlay" onClick={() => setForgotModal(false)}>
          <div className="auth-modal" onClick={(event) => event.stopPropagation()}>
            <div className="auth-modal-header">
              <h2>{showReset ? 'Reset password' : 'Forgot password'}</h2>
              <button type="button" className="auth-modal-close" onClick={() => setForgotModal(false)}>×</button>
            </div>
            {!showReset ? (
              <form className="auth-modal-form" onSubmit={handleForgot}>
                <label className="auth-label" htmlFor="forgot-email">Email</label>
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
                  {forgotLoading ? 'Sending…' : 'Send reset token'}
                </button>
                {forgotStatus && <p className="auth-modal-status">{forgotStatus}</p>}
              </form>
            ) : (
              <form className="auth-modal-form" onSubmit={handleReset}>
                <label className="auth-label" htmlFor="reset-token">Reset token</label>
                <input
                  id="reset-token"
                  className="auth-input"
                  type="text"
                  value={resetToken}
                  onChange={(event) => setResetToken(event.target.value)}
                  required
                  disabled={forgotLoading}
                />
                <label className="auth-label" htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  className="auth-input"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="At least 8 characters"
                  minLength={8}
                  required
                  disabled={forgotLoading}
                />
                <button type="submit" className="auth-btn" disabled={forgotLoading}>
                  {forgotLoading ? 'Resetting…' : 'Reset password'}
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
