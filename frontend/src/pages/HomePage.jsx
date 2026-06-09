import '../styles/HomePage.css';
import { useTranslation } from '../i18n/useTranslation';

/* ── Inline SVG icons (no dependency) ── */
const FileQuestionIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <path d="M9.1 13a2 2 0 0 1 3.8 1c0 1.1-.9 1.7-1.9 2" />
    <circle cx="12" cy="18" r="0.5" fill="currentColor" />
  </svg>
);

const NetworkIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="16" y="16" width="6" height="6" rx="1" />
    <rect x="2" y="16" width="6" height="6" rx="1" />
    <rect x="9" y="2" width="6" height="6" rx="1" />
    <path d="M5 16v-4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v4" />
    <line x1="12" y1="8" x2="12" y2="11" />
  </svg>
);

const ScaleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="3" x2="12" y2="21" />
    <path d="M3 6l9-3 9 3" />
    <path d="M3 6l4 8a4 4 0 0 1-8 0l4-8" />
    <path d="M21 6l4 8a4 4 0 0 1-8 0l4-8" />
    <line x1="7" y1="21" x2="17" y2="21" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const getGreeting = (t) => {
  const hour = new Date().getHours();
  if (hour < 12) return t('home_greeting_morning');
  if (hour < 18) return t('home_greeting_afternoon');
  return t('home_greeting_evening');
};

export default function HomePage({ authUser, onSelectMode, onUpgrade }) {
  const { t } = useTranslation();

  const plan = (authUser?.plan || 'free').toLowerCase();
  const isExpired = authUser?.plan_expires_at && new Date(authUser.plan_expires_at) < new Date();
  const effectivePlan = isExpired ? 'free' : plan;
  const canResearch = effectivePlan === 'pro' || effectivePlan === 'business';
  
  const MODES = [
    {
      key: 'chat',
      name: t('mode_ask_name'),
      desc: t('mode_ask_desc'),
      uses: [t('mode_ask_use1'), t('mode_ask_use2'), t('mode_ask_use3')],
      Icon: FileQuestionIcon,
      badge: null,
    },
    {
      key: 'research',
      name: t('mode_research_name'),
      desc: t('mode_research_desc'),
      uses: [t('mode_research_use1'), t('mode_research_use2'), t('mode_research_use3')],
      Icon: NetworkIcon,
      badge: 'NEW',
    },
    {
      key: 'legal',
      name: t('mode_legal_name'),
      desc: t('mode_legal_desc'),
      uses: [t('mode_legal_use1'), t('mode_legal_use2'), t('mode_legal_use3')],
      Icon: ScaleIcon,
      badge: effectivePlan === 'business' ? 'KR+UZ' : 'KR',
      legalFreeHint: effectivePlan === 'free',
    },
  ];
  
  const rawName = authUser?.full_name?.split(' ')[0] || '';
  // If full_name is empty or looks like a username (contains underscore, all lowercase, or has numbers),
  // use a generic greeting instead
  const looksLikeUsername = rawName && (
    /^[a-z0-9_]+$/i.test(rawName) &&        // matches alphanumeric + underscore (case-insensitive)
    !/\s/.test(rawName) &&                   // confirm no spaces
    (rawName.includes('_') ||               // has underscore (typical username pattern)
     rawName === rawName.toLowerCase() ||   // all lowercase (typical username pattern)
     /\d/.test(rawName))                    // contains numbers (typical username pattern)
  );
  const displayName = looksLikeUsername ? '' : rawName;
  const greeting = displayName ? `${getGreeting(t)}, ${displayName}` : `${getGreeting(t)}!`;

  return (
    <div className="home-page">
      <header className="home-header">
        <h1 className="home-greeting">
          {greeting}
        </h1>
        <p className="home-subtitle">{t('home_subtitle')}</p>
      </header>

      <div className="home-grid" role="list">
        {MODES.map(({ key, name, desc, uses, Icon, badge, legalFreeHint }) => {
          const isLocked = key === 'research' && !canResearch;
          return (
            <button
              key={key}
              className={`mode-card${isLocked ? ' mode-card--locked' : ''}`}
              role="listitem"
              onClick={() => isLocked ? onUpgrade?.() : onSelectMode(key)}
              aria-label={isLocked ? `${name} — Pro plan required` : `${name} — ${desc}`}
            >
              <div className="mode-card-icon">
                <Icon />
              </div>

              {isLocked && (
                <span className="mode-card-badge mode-card-badge--pro" aria-label="Pro plan required">
                  Pro
                </span>
              )}

              {!isLocked && badge && (
                <span
                  className="mode-badge"
                  aria-label={badge === 'NEW' ? 'New feature' : badge === 'KR+UZ' ? 'Korean and Uzbek law' : 'Korean law'}
                >
                  {badge}
                </span>
              )}

              <h2 className="mode-card-name">{name}</h2>
              <p className="mode-card-desc">{desc}</p>
              {legalFreeHint && (
                <span className="mode-card-legal-hint">5 free queries/mo · KR law only</span>
              )}

              <div className="mode-card-uses" aria-hidden="true">
                {uses.map((use) => (
                  <span key={use} className="mode-card-use-chip">{use}</span>
                ))}
              </div>

              <span className="mode-card-arrow" aria-hidden="true">→</span>
            </button>
          );
        })}

        {authUser?.role?.toLowerCase() === 'admin' && (
          <button
            key="admin"
            className="mode-card"
            role="listitem"
            onClick={() => onSelectMode('admin')}
            aria-label={`${t('mode_admin_name')} — ${t('mode_admin_desc')}`}
          >
            <div className="mode-card-icon">
              <ShieldIcon />
            </div>

            <h2 className="mode-card-name">{t('mode_admin_name')}</h2>
            <p className="mode-card-desc">{t('mode_admin_desc')}</p>

            <div className="mode-card-uses" aria-hidden="true">
              {[t('mode_admin_use1'), t('mode_admin_use2'), t('mode_admin_use3')].map((use) => (
                <span key={use} className="mode-card-use-chip">{use}</span>
              ))}
            </div>

            <span className="mode-card-arrow" aria-hidden="true">→</span>
          </button>
        )}
      </div>
    </div>
  );
}
