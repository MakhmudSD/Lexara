import { useState } from 'react';
import { register } from '../api/auth';
import { useTranslation } from '../i18n/useTranslation';
import { LexaraLogo } from '../assets/LexaraLogo';
import '../styles/AuthPages.css';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage({ onSuccess, onBackToLogin, onHome }) {
  const { t } = useTranslation();
  const referralCode = new URLSearchParams(window.location.search).get('ref');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!fullName.trim()) {
      setError(t('register_name_required') || 'Full name is required');
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setError(t('register_email_invalid') || 'Enter a valid email address');
      return;
    }
    if (password.length < 8) {
      setError(t('register_password_short') || 'Password must be at least 8 characters');
      return;
    }
    if (confirmPassword !== password) {
      setError(t('register_passwords_mismatch') || 'Passwords must match');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await register(email.trim(), password, fullName.trim(), referralCode);
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('authUser', JSON.stringify({
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        created_at: data.created_at,
      }));
      setSuccessMessage(t('register_success') || 'Account created! Taking you in…');
      window.setTimeout(() => onSuccess({
        id: data.user_id,
        email: data.email,
        full_name: data.full_name,
        role: data.role,
        created_at: data.created_at,
      }), 500);
    } catch (err) {
      if (err.response?.status === 409) {
        setError(t('register_email_exists'));
      } else if (!err.response) {
        setError(t('connection_error'));
      } else {
        setError(err.response?.data?.error?.message || t('register_failed') || 'Register failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-root">
      <div className="auth-left-panel">
        <div className="auth-left-content">
          <LexaraLogo height={40} />
          <p className="auth-left-tagline">{t('register_left_tagline') || 'Your documents, fully answerable'}</p>
          <p className="auth-left-sub">{t('register_left_sub') || '100 free queries per month. No credit card required.'}</p>
          <div className="auth-left-chips">
            <div className="auth-left-chip">
              <span className="auth-left-chip-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              </span>
              {t('register_chip_free') || 'Free plan — no card needed'}
            </div>
            <div className="auth-left-chip">
              <span className="auth-left-chip-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </span>
              {t('register_chip_no_training') || 'Data never used for training'}
            </div>
            <div className="auth-left-chip">
              <span className="auth-left-chip-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              </span>
              {t('register_chip_fast') || 'Indexed within seconds'}
            </div>
          </div>
        </div>
      </div>

      <div className="auth-right-panel">
      <div className="auth-container">
        <div className="auth-logo-row">
          <LexaraLogo height={36} onClick={onHome} style={{ cursor: 'pointer' }} />
        </div>
        <div className="auth-heading">
          <h1>{t('register_title') || 'Create account'}</h1>
          <p>{t('register_subtitle') || 'Start querying your documents'}</p>
        </div>
        <div className="auth-card">
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="register-name">
                {t('register_full_name_label') || 'Full name'} <span style={{ fontSize: 11, fontWeight: 400, color: '#a09890' }}>{t('register_optional') || '(optional)'}</span>
              </label>
              <input
                id="register-name"
                className="auth-input"
                type="text"
                placeholder={t('register_name_placeholder') || 'Your name'}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={loading}
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="register-email">{t('register_email_label') || 'Email'}</label>
              <input
                id="register-email"
                className="auth-input"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading}
                required
              />
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="register-password">{t('register_password_label') || 'Password'}</label>
              <input
                id="register-password"
                className={`auth-input ${password && password.length < 8 ? 'error' : ''}`}
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading}
                required
              />
              {password && password.length < 8 && <p className="field-hint">{t('register_min_chars') || 'At least 8 characters'}</p>}
            </div>
            <div className="auth-field">
              <label className="auth-label" htmlFor="register-confirm">{t('register_confirm_label') || 'Confirm password'}</label>
              <input
                id="register-confirm"
                className={`auth-input ${confirmPassword && confirmPassword !== password ? 'error' : ''}`}
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={loading}
                required
              />
            </div>
            {error && <div className="auth-error">{error}</div>}
            <button type="submit" className="auth-btn" disabled={loading}>
              {loading && <span className="auth-btn-spinner" />}
              <span>{loading ? (t('register_btn_loading') || 'Creating account…') : (t('register_btn') || 'Create account')}</span>
            </button>
            {successMessage && <p className="auth-success">{successMessage}</p>}
          </form>
          <hr className="auth-divider" />
          <div className="auth-footer">
            <span>{t('register_have_account') || 'Already have an account?'} </span>
            <button type="button" className="auth-back-btn" onClick={onBackToLogin} disabled={loading}>{t('register_back_signin') || 'Back to sign in'}</button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
