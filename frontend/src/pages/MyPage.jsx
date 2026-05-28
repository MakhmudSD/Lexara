import { useEffect, useState } from 'react';
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

const PLAN_FEATURES = {
  free: [
    '50 so\'rov/oy',
    '1 ish maydoni',
    '5 hujjat',
    'Asosiy kirish',
  ],
  pro: [
    '1,000 so\'rov/oy',
    '5 ish maydoni',
    'Cheksiz hujjatlar',
    'Suhbat xotirasi',
    'Streaming javoblar',
  ],
  business: [
    '5,000 so\'rov/oy',
    'Cheksiz ish maydonlari',
    'Barcha Pro xususiyatlari',
    'Ustuvor qo\'llab-quvvatlash',
    'Tahlil paneli',
  ],
};

export default function MyPage({ onLogout }) {
  const { t, lang, setLang, languageOptions } = useTranslation();
  const [activeTab, setActiveTab] = useState('info');
  const [stats, setStats] = useState({ total_queries: 0, total_tokens: 0, total_cost_usd: 0 });
  const [loading, setLoading] = useState(true);
  const [upgradeLoading, setUpgradeLoading] = useState(null);

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
      const { checkout_url } = await createCheckout(plan);

      if (window.Paddle) {
        window.Paddle.Checkout.open({
          url: checkout_url,
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
      alert(t('checkout_error') || 'Could not open checkout. Please try again.');
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
  ];

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
              <span className="mypage-stat-label">{t('total_queries_label') || 'Jami so\'rovlar'}</span>
              <span className="mypage-stat-value">{loading ? '—' : stats.total_queries}</span>
            </div>
            <div className="mypage-bar-wrap">
              <div
                className="mypage-bar-fill"
                style={{ width: `${queriesPct}%`, background: getBarColor(queriesPct) }}
              />
            </div>
            <div className="mypage-stat-sub">
              {loading ? '—' : `${queriesLeft} so'rov qoldi (${planLimits.queries} dan)`}
            </div>
          </div>

          <div className="mypage-stat-block" style={{ marginTop: 12 }}>
            <div className="mypage-stat-row">
              <span className="mypage-stat-label">{t('tokens_label') || 'Tokenlar'}</span>
              <span className="mypage-stat-value">{loading ? '—' : stats.total_tokens.toLocaleString()}</span>
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
              <button
                className="mypage-signout-btn"
                style={{ marginTop: 12 }}
                onClick={() => window.open('mailto:support@lexara.app?subject=Reja boshqaruvi')}
              >
                {t('manage_plan') || 'Rejani boshqarish'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* TAB: Promo */}
      {activeTab === 'promo' && (
        <div className="mypage-section-card">
          <div className="mypage-promo-hero">
            <div className="mypage-promo-icon">🎁</div>
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
    </div>
  );
}
