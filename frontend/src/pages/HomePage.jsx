import '../styles/HomePage.css';

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

const MODES = [
  {
    key: 'chat',
    name: 'Ask',
    desc: 'Get answers from your documents',
    uses: ['Summarise a contract', 'Find a clause', 'Compare documents'],
    Icon: FileQuestionIcon,
    badge: null,
  },
  {
    key: 'research',
    name: 'Research',
    desc: 'Plan, search, and synthesise a full report',
    uses: ['Compliance analysis', 'Due diligence', 'Market research'],
    Icon: NetworkIcon,
    badge: 'NEW',
  },
  {
    key: 'legal',
    name: 'Legal',
    desc: 'Search Korean law and regulations',
    uses: ['Find applicable statutes', 'Check compliance', 'Cite sources'],
    Icon: ScaleIcon,
    badge: 'KR',
  },
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomePage({ authUser, onSelectMode }) {
  const firstName =
    authUser?.full_name?.split(' ')[0] ||
    authUser?.email?.split('@')[0] ||
    'there';

  return (
    <div className="home-page">
      <header className="home-header">
        <h1 className="home-greeting">
          {getGreeting()}, {firstName}
        </h1>
        <p className="home-subtitle">What would you like to work on today?</p>
      </header>

      <div className="home-grid" role="list">
        {MODES.map(({ key, name, desc, uses, Icon, badge }) => (
          <button
            key={key}
            className="mode-card"
            role="listitem"
            onClick={() => onSelectMode(key)}
            aria-label={`${name} — ${desc}`}
          >
            <div className="mode-card-icon">
              <Icon />
            </div>

            {badge && (
              <span
                className="mode-badge"
                aria-label={badge === 'NEW' ? 'New feature' : 'Korean law'}
              >
                {badge}
              </span>
            )}

            <h2 className="mode-card-name">{name}</h2>
            <p className="mode-card-desc">{desc}</p>

            <div className="mode-card-uses" aria-hidden="true">
              {uses.map((use) => (
                <span key={use} className="mode-card-use-chip">{use}</span>
              ))}
            </div>

            <span className="mode-card-arrow" aria-hidden="true">→</span>
          </button>
        ))}

        {authUser?.role?.toLowerCase() === 'admin' && (
          <button
            key="admin"
            className="mode-card"
            role="listitem"
            onClick={() => onSelectMode('admin')}
            aria-label="Admin — Manage users, workspaces, and system health"
          >
            <div className="mode-card-icon">
              <ShieldIcon />
            </div>

            <h2 className="mode-card-name">Admin</h2>
            <p className="mode-card-desc">Manage users, workspaces, and system health</p>

            <div className="mode-card-uses" aria-hidden="true">
              {['User management', 'KPI dashboard', 'System logs'].map((use) => (
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
