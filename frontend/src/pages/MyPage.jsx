import { useEffect, useRef, useState } from 'react';
import client from '../api/client';
import { createCheckout } from '../api/billing';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/MyPage.css';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return parts.slice(0, 2).map((p) => p[0].toUpperCase()).join('');
}

function getBarColor(pct) {
  if (pct >= 80) return '#ef4444';
  if (pct >= 50) return '#f59e0b';
  return '#22c55e';
}

const PLAN_LIMITS = {
  free:     { queries: 50,    workspaces: 1,  label: 'Free' },
  pro:      { queries: 1000,  workspaces: 5,  label: 'Pro' },
  business: { queries: 5000,  workspaces: 999, label: 'Business' },
};

const PLAN_GRADIENTS = {
  free:     'linear-gradient(135deg, #6b6860 0%, #9d9b96 100%)',
  pro:      'linear-gradient(135deg, #2356d8 0%, #1a42b0 100%)',
  business: 'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
};

const PLAN_FEATURES_KEYS = {
  free:     ['plan_free_f1', 'plan_free_f2', 'plan_free_f3'],
  pro:      ['plan_pro_f1', 'plan_pro_f2', 'plan_pro_f3', 'plan_pro_f4'],
  business: ['plan_business_f1', 'plan_business_f2', 'plan_business_f3', 'plan_business_f4'],
};

const PLAN_FEATURES_DEFAULTS = {
  free:     ['50 queries/month', '1 workspace', '5 documents'],
  pro:      ['1,000 queries/month', '5 workspaces', 'Unlimited documents', 'Usage analytics'],
  business: ['5,000 queries/month', 'Unlimited workspaces', 'All Pro features', 'Priority support'],
};

function SupportTab({ t }) {
  const [tickets, setTickets] = useState([]);
  const [faq, setFaq] = useState([]);
  const [question, setQuestion] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const MAX = 1000;

  const loadTickets = () => {
    client.get('/support/tickets').then((r) => setTickets(r.data)).catch(() => {});
    client.get('/support/faq').then((r) => setFaq(r.data)).catch(() => {});
  };

  useEffect(() => { loadTickets(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!question.trim()) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await client.post('/support/tickets', { question: question.trim() });
      setQuestion('');
      setSuccess('Your question was submitted. We\'ll respond soon!');
      loadTickets();
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to submit. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mypage-section-card">
      <div className="mypage-section-title">Ask a Question</div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <textarea
          className="mypage-support-textarea"
          placeholder="Describe your question or issue..."
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, MAX))}
          rows={4}
          required
        />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 11, color: question.length >= MAX * 0.9 ? '#ef4444' : 'var(--color-text-muted)' }}>
            {question.length}/{MAX}
          </span>
          <button type="submit" className="mypage-btn-primary" disabled={submitting || !question.trim()}>
            {submitting ? 'Submitting…' : 'Submit Question'}
          </button>
        </div>
        {error && <div style={{ fontSize: 12, color: '#ef4444' }}>{error}</div>}
        {success && <div style={{ fontSize: 12, color: '#22c55e' }}>{success}</div>}
      </form>

      {tickets.length > 0 && (
        <>
          <div className="mypage-divider" style={{ margin: '20px 0' }} />
          <div className="mypage-section-title">My Tickets</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {tickets.map((ticket) => (
              <div key={ticket.id} className="mypage-support-ticket">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ fontSize: 13, color: 'var(--color-text-primary)', flex: 1 }}>{ticket.question}</div>
                  <span className={`mypage-support-badge ${ticket.status === 'answered' ? 'answered' : 'pending'}`}>
                    {ticket.status === 'answered' ? 'Answered' : 'Pending'}
                  </span>
                </div>
                {ticket.answer && (
                  <div className="mypage-support-answer">
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>Response:</div>
                    <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{ticket.answer}</div>
                  </div>
                )}
                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                  {new Date(ticket.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {faq.length > 0 && (
        <>
          <div className="mypage-divider" style={{ margin: '20px 0' }} />
          <div className="mypage-section-title">Community FAQ</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {faq.map((item) => (
              <div key={item.id} className="mypage-support-ticket">
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text-primary)', marginBottom: 6 }}>
                  Q: {item.question}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  A: {item.answer}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function MyPage({ onLogout }) {
  const { t, lang, setLang, languageOptions } = useTranslation();
  const [activeTab, setActiveTab] = useState('info');
  const [stats, setStats] = useState({ total_queries: 0, total_tokens: 0, total_cost_usd: 0 });
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(null);
  const [upgradeError, setUpgradeError] = useState('');

  const PLAN_FEATURES = {
    free:     PLAN_FEATURES_KEYS.free.map((k, i) => t(k) || PLAN_FEATURES_DEFAULTS.free[i]),
    pro:      PLAN_FEATURES_KEYS.pro.map((k, i) => t(k) || PLAN_FEATURES_DEFAULTS.pro[i]),
    business: PLAN_FEATURES_KEYS.business.map((k, i) => t(k) || PLAN_FEATURES_DEFAULTS.business[i]),
  };

  const user = (() => {
    try { return JSON.parse(localStorage.getItem('authUser') || '{}'); }
    catch { return {}; }
  })();

  const plan = user.plan || 'free';
  const planLimits = PLAN_LIMITS[plan] || PLAN_LIMITS.free;
  const queriesPct = Math.min(100, Math.round((stats.total_queries / planLimits.queries) * 100));
  const queriesLeft = Math.max(0, planLimits.queries - stats.total_queries);

  const referralCode = user.id
    ? `LEX-${user.id.toString().replace(/-/g,'').substring(0,6).toUpperCase()}`
    : 'LEX-XXXXXX';
  const referralLink = `${window.location.origin}?ref=${referralCode}`;

  useEffect(() => {
    client.get('/auth/me')
      .then((r) => setStats({
        total_queries: r.data.total_queries || 0,
        total_tokens: r.data.total_tokens || 0,
        total_cost_usd: r.data.total_cost_usd || 0,
      }))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (window.Paddle && import.meta.env.VITE_PADDLE_CLIENT_TOKEN) {
      window.Paddle.Initialize({
        token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN,
      });
    }
  }, []);

  const handleUpgrade = async (plan) => {
    try {
      setUpgradeLoading(plan);
      const { checkout_url, transaction_id } = await createCheckout(plan);

      if (window.Paddle) {
        window.Paddle.Checkout.open({
          transactionId: transaction_id,
          settings: {
            displayMode: 'overlay',
            theme: 'light',
            locale: lang === 'uz' ? 'uz' : lang === 'ru' ? 'ru' : 'en',
          },
          eventCallback: (event) => {
            if (event.name === 'checkout.completed') {
              let attempts = 0;
              const poll = setInterval(async () => {
                attempts++;
                try {
                  const res = await client.get('/auth/me');
                  if (res.data.plan !== 'free' || attempts > 10) {
                    clearInterval(poll);
                    const stored = JSON.parse(localStorage.getItem('authUser') || '{}');
                    stored.plan = res.data.plan;
                    stored.plan_expires_at = res.data.plan_expires_at;
                    localStorage.setItem('authUser', JSON.stringify(stored));
                    window.dispatchEvent(new Event('auth:change'));
                    setStats({
                      total_queries: res.data.total_queries || 0,
                      total_tokens: res.data.total_tokens || 0,
                      total_cost_usd: res.data.total_cost_usd || 0,
                    });
                    setUpgradeLoading(null);
                  }
                } catch {
                  clearInterval(poll);
                  setUpgradeLoading(null);
                }
              }, 3000);
            }
          },
        });
      } else {
        window.open(checkout_url, '_blank');
      }
    } catch (err) {
      console.error('Checkout error:', err);
      setUpgradeError(t('checkout_error') || 'Could not open checkout. Please try again.');
      setTimeout(() => setUpgradeError(''), 6000);
    } finally {
      if (!window.Paddle) setUpgradeLoading(null);
    }
  };

  const memberSince = user.created_at
    ? new Date(user.created_at).toLocaleDateString(lang === 'uz' ? 'uz-UZ' : lang, { year: 'numeric', month: 'long' })
    : '—';

  const tabs = [
    { id: 'info', label: t('tab_my_info') || 'Ma\'lumotlarim' },
    { id: 'subscription', label: t('tab_subscription') || 'Obuna' },
    { id: 'promo', label: t('tab_promo') || 'Promo' },
    { id: 'support', label: t('tab_support') || 'Support' },
  ];

  if (loading) {
    return (
      <div className="mypage-wrap">
        <div className="mypage-skeleton-card" />
        <div className="mypage-skeleton-card mypage-skeleton-short" />
        <div className="mypage-skeleton-card" />
      </div>
    );
  }

  return (
    <div className="mypage-wrap">
      {/* Header */}
      <div className="mypage-header-card">
        <div className="mypage-avatar-row">
          <div className="mypage-avatar">{initials(user.full_name || user.email || 'U')}</div>
          <div>
            <div className="mypage-name">{user.full_name || user.email || 'Foydalanuvchi'}</div>
            <div className="mypage-email">{user.email}</div>
            <span className="mypage-role-badge">{user.role || 'member'}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="mypage-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`mypage-tab-btn ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* TAB: Ma'lumotlarim */}
      {activeTab === 'info' && (
        <div className="mypage-section-card">
          <div className="mypage-section-title">{t('usage_title') || 'Foydalanish'}</div>

          <div className="mypage-stat-block">
            <div className="mypage-stat-row">
              <span className="mypage-stat-label">{t('total_queries_label') || 'Total queries'}</span>
              <span className="mypage-stat-value">{stats.total_queries}</span>
            </div>
            {stats.total_queries === 0 ? (
              <div className="mypage-stat-empty">
                {t('no_queries_yet') || 'No queries yet — ask your first question in the chat.'}
              </div>
            ) : (
              <>
                <div className="mypage-bar-wrap">
                  <div
                    className="mypage-bar-fill"
                    style={{ width: `${queriesPct}%`, background: getBarColor(queriesPct) }}
                  />
                </div>
                <div className="mypage-stat-sub">
                  {`${queriesLeft} ${t('queries_remaining') || 'remaining'} / ${planLimits.queries} ${t('per_month') || 'per month'}`}
                </div>
              </>
            )}
          </div>

          <div className="mypage-stat-block" style={{ marginTop: 12 }}>
            <div className="mypage-stat-row">
              <span className="mypage-stat-label">{t('tokens_label') || 'Tokenlar'}</span>
              <span className="mypage-stat-value">{stats.total_tokens.toLocaleString()}</span>
            </div>
          </div>

          <div className="mypage-divider" />

          <div className="mypage-section-title">{t('account_label') || 'Hisob'}</div>
          <div className="mypage-info-row">
            <span className="mypage-info-key">{t('member_since_label') || 'A\'zo bo\'lgan sana'}</span>
            <span className="mypage-info-val">{memberSince}</span>
          </div>

          <div className="mypage-divider" />

          <div className="mypage-section-title">{t('preferences_label') || 'Sozlamalar'}</div>
          <div className="mypage-info-row">
            <span className="mypage-info-key">{t('language_label') || 'Til'}</span>
            <select
              className="mypage-lang-select"
              value={lang}
              onChange={(e) => setLang(e.target.value)}
            >
              {languageOptions.map((o) => (
                <option key={o.code} value={o.code}>{o.label}</option>
              ))}
            </select>
          </div>

          <div className="mypage-divider" />
          <button className="mypage-signout-btn" onClick={onLogout}>
            {t('sign_out') || 'Chiqish'}
          </button>
        </div>
      )}

      {/* TAB: Obuna */}
      {activeTab === 'subscription' && (
        <div>
          <div
            className="mypage-plan-card"
            style={{ background: PLAN_GRADIENTS[plan] }}
          >
            <div className="mypage-plan-badge">{t('current_plan_label') || 'Joriy reja'}</div>
            <div className="mypage-plan-name">{PLAN_LIMITS[plan]?.label || 'Free'}</div>
            <div className="mypage-plan-features">
              {(PLAN_FEATURES[plan] || PLAN_FEATURES.free).map((f) => (
                <div key={f} className="mypage-plan-feature">✓ {f}</div>
              ))}
            </div>
          </div>

          {plan === 'free' && (
            <div className="mypage-upgrade-grid">
              <div className="mypage-upgrade-card">
                <div className="mypage-upgrade-card-header" style={{ background: PLAN_GRADIENTS.pro }}>
                  <div className="mypage-upgrade-plan-name">Pro</div>
                  <div className="mypage-upgrade-price">$19<span>/oy</span></div>
                </div>
                <div className="mypage-upgrade-features">
                  {PLAN_FEATURES.pro.map((f) => (
                    <div key={f} className="mypage-upgrade-feature">✓ {f}</div>
                  ))}
                </div>
                <button
                  className="mypage-upgrade-btn pro"
                  onClick={() => handleUpgrade('pro')}
                  disabled={upgradeLoading === 'pro'}
                >
                  {upgradeLoading === 'pro' ? '...' : (t('upgrade_to_pro') || 'Upgrade to Pro →')}
                </button>
              </div>

              <div className="mypage-upgrade-card">
                <div className="mypage-upgrade-card-header" style={{ background: PLAN_GRADIENTS.business }}>
                  <div className="mypage-upgrade-plan-name">Business</div>
                  <div className="mypage-upgrade-price">$49<span>/oy</span></div>
                </div>
                <div className="mypage-upgrade-features">
                  {PLAN_FEATURES.business.map((f) => (
                    <div key={f} className="mypage-upgrade-feature">✓ {f}</div>
                  ))}
                </div>
                <button
                  className="mypage-upgrade-btn business"
                  onClick={() => handleUpgrade('business')}
                  disabled={upgradeLoading === 'business'}
                >
                  {upgradeLoading === 'business' ? '...' : (t('upgrade_to_business') || 'Upgrade to Business →')}
                </button>
              </div>
            </div>
          )}

          {plan !== 'free' && (
            <div className="mypage-section-card" style={{ marginTop: 12 }}>
              <div className="mypage-info-row">
                <span className="mypage-info-key">{t('plan_expires_label') || 'Tugash sanasi'}</span>
                <span className="mypage-info-val">{user.plan_expires_at ? new Date(user.plan_expires_at).toLocaleDateString() : '—'}</span>
              </div>
              {upgradeError && (
                <div className="mypage-error-banner">{upgradeError}</div>
              )}
              <button
                className="mypage-signout-btn"
                style={{ marginTop: 12 }}
                onClick={() => window.open('mailto:support@lexara.app?subject=Plan management request')}
              >
                {t('email_support_to_change_plan') || 'Email us to change plan'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB: Promo */}
      {activeTab === 'promo' && (
        <div className="mypage-section-card">
          <div className="mypage-promo-hero">
            <div className="mypage-promo-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{color:'var(--color-accent)'}}>
                <polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>
              </svg>
            </div>
            <div className="mypage-promo-title">
              {t('promo_headline') || 'Do\'stingizni taklif qiling'}
            </div>
            <div className="mypage-promo-sub">
              {t('promo_desc') || 'Har bir do\'stingiz Lexara\'ga qo\'shilsa, siz 1 oy Pro bepul olasiz!'}
            </div>
          </div>

          <div className="mypage-divider" />

          <div className="mypage-section-title">{t('your_referral_link') || 'Sizning havola'}</div>
          <div className="mypage-referral-row">
            <input
              className="mypage-referral-input"
              value={referralLink}
              readOnly
            />
            <button
              className="mypage-referral-copy-btn"
              onClick={() => { navigator.clipboard.writeText(referralLink); }}
            >
              {t('copy') || 'Nusxa'}
            </button>
          </div>

          <div className="mypage-divider" />

          <div className="mypage-section-title">{t('how_it_works') || 'Qanday ishlaydi'}</div>
          <div className="mypage-steps">
            {[
              t('promo_step1') || 'Havolani do\'stlaringizga yuboring',
              t('promo_step2') || 'Ular ro\'yxatdan o\'tadi va 5 so\'rov yuboradi',
              t('promo_step3') || 'Siz 1 oy Pro bepul olasiz',
            ].map((step, i) => (
              <div key={i} className="mypage-step">
                <div className="mypage-step-num">{i + 1}</div>
                <div className="mypage-step-text">{step}</div>
              </div>
            ))}
          </div>

          <div className="mypage-promo-note">
            {t('promo_note') || '* Mukofot hozircha qo\'lda beriladi. Tez orada avtomatik bo\'ladi.'}
          </div>
        </div>
      )}

      {/* TAB: Support */}
      {activeTab === 'support' && <SupportTab t={t} />}
    </div>
  );
}
