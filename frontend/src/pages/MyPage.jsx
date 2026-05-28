import { useEffect, useState } from 'react';
import client from '../api/client';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/MyPage.css';

const PLAN_LIMITS = { queries: 1000, tokens: 500000 };

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

function barColor(pct) {
  if (pct > 80) return 'red';
  if (pct > 50) return 'amber';
  return 'green';
}

export default function MyPage({ onLogout }) {
  const { t, lang, setLang, languageOptions } = useTranslation();
  const user = (() => {
    try { return JSON.parse(localStorage.getItem('authUser') || '{}'); }
    catch { return {}; }
  })();
  const [stats, setStats] = useState({ total_queries: 0, total_tokens: 0, total_cost_usd: 0 });

  useEffect(() => {
    client.get('/auth/me')
      .then((res) => setStats({
        total_queries: res.data.total_queries || 0,
        total_tokens: res.data.total_tokens || 0,
        total_cost_usd: res.data.total_cost_usd || 0,
      }))
      .catch(() => {});
  }, []);

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  const handleSignOut = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('authUser');
    localStorage.removeItem('workspaceId');
    localStorage.removeItem('workspaceName');
    onLogout?.();
    window.location.reload();
  };

  const queriesPct = Math.min(100, (stats.total_queries / PLAN_LIMITS.queries) * 100);
  const tokensPct = Math.min(100, (stats.total_tokens / PLAN_LIMITS.tokens) * 100);

  const usageCards = [
    { label: t('total_queries') || 'Total queries', value: stats.total_queries, pct: queriesPct, hasBar: true },
    { label: t('tokens_used') || 'Tokens used', value: stats.total_tokens, pct: tokensPct, hasBar: true },
    { label: t('est_spend') || 'Est. spend', value: `$${Number(stats.total_cost_usd || 0).toFixed(4)}`, pct: null, hasBar: false },
  ];

  return (
    <div className="mypage-container">
      {/* Profile header */}
      <div className="mypage-card">
        <div className="mypage-profile-row">
          <div className="mypage-avatar">{initials(user.full_name || 'User')}</div>
          <div>
            <div className="mypage-name">{user.full_name || 'User'}</div>
            <div className="mypage-email">{user.email || '—'}</div>
            <span className="mypage-role-badge">{user.role || 'user'}</span>
          </div>
        </div>
      </div>

      {/* Usage stats */}
      <div className="mypage-card">
        <div className="mypage-section-title">{t('usage') || 'Usage'}</div>
        <div className="mypage-stats-grid">
          {usageCards.map((card) => (
            <div key={card.label} className="mypage-stat-card">
              <div className="mypage-stat-label">{card.label}</div>
              <div className="mypage-stat-value">{card.value}</div>
              {card.hasBar && (
                <div className="mypage-stat-bar-wrap">
                  <div
                    className={`mypage-stat-bar ${barColor(card.pct)}`}
                    style={{ width: `${card.pct}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Plan */}
      <div className="mypage-card">
        <div className="mypage-section-title">{t('plan') || 'Plan'}</div>
        <div className="mypage-plan-card">
          <div className="mypage-plan-name">{user.plan || 'Free'}</div>
          <div className="mypage-plan-desc">
            {user.plan === 'pro'
              ? '1,000 queries/mo · Unlimited documents · Streaming'
              : '50 queries/mo · 5 documents · Basic access'}
          </div>
          <button
            className="mypage-upgrade-btn"
            onClick={() => window.open('mailto:support@lexara.app?subject=Upgrade request')}
          >
            {user.plan === 'pro' ? (t('manage_plan') || 'Manage plan') : (t('upgrade') || 'Upgrade to Pro →')}
          </button>
        </div>
      </div>

      {/* Account info */}
      <div className="mypage-card">
        <div className="mypage-section-title">{t('account') || 'Account'}</div>
        <div className="mypage-info-row">
          <span>{t('member_since') || 'Member since'}</span>
          <span>{memberSince}</span>
        </div>
        <div className="mypage-info-row">
          <span>{t('sign_out') || 'Sign out'}</span>
          <button className="mypage-signout-btn" onClick={handleSignOut}>
            {t('sign_out') || 'Sign out'}
          </button>
        </div>
      </div>

      {/* Preferences */}
      <div className="mypage-card">
        <div className="mypage-section-title">{t('preferences') || 'Preferences'}</div>
        <div className="mypage-pref-row">
          <span className="mypage-pref-label">{t('language_label') || 'Language'}</span>
          <select
            className="mypage-pref-select"
            value={lang}
            onChange={(e) => setLang(e.target.value)}
          >
            {languageOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
