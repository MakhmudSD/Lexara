import { useState } from 'react';
import { login } from '../api/auth';
import { useTranslation } from '../i18n/useTranslation';
import { LexaraLogo } from '../assets/LexaraLogo';
import '../styles/AuthPages.css';

export default function LoginPage({ onLogin, onRegister, onHome }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');
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
      if (err.response?.status === 401) {
        setError(t('login_invalid_credentials'));
      } else if (!err.response) {
        setError(t('connection_error'));
      } else {
        setError(err.response?.data?.error?.message || 'Login failed');
      }
    } finally {
      setLoading(false);
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
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="login-email">Email</label>
              <input
                id="login-email"
                className={`auth-input ${error ? 'error' : ''}`}
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="auth-field">
              <div className="auth-label-row">
                <label className="auth-label" htmlFor="login-password">Password</label>
                <button type="button" className="auth-forgot" disabled={loading}>Forgot password?</button>
              </div>
              <input
                id="login-password"
                className={`auth-input ${error ? 'error' : ''}`}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                required
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-btn" disabled={loading}>
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
    </div>
  );
}
