import { useEffect, useState } from 'react';
import client from '../api/client';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  return parts.slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}

export default function MyPage({ onLogout }) {
  const user = (() => {
    try {
      return JSON.parse(localStorage.getItem('authUser') || '{}');
    } catch {
      return {};
    }
  })();
  const [stats, setStats] = useState({ total_queries: 0, total_tokens: 0, total_cost_usd: 0 });

  useEffect(() => {
    client.get('/auth/me')
      .then((response) => setStats({
        total_queries: response.data.total_queries || 0,
        total_tokens: response.data.total_tokens || 0,
        total_cost_usd: response.data.total_cost_usd || 0,
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

  return (
    <div className="my-page">
      <div className="my-card">
        <div className="my-header">
          <div className="my-avatar">{initials(user.full_name || 'User')}</div>
          <div className="my-meta">
            <h2>{user.full_name || 'User'}</h2>
            <p>{user.email || '—'}</p>
            <span className="my-role">{user.role || 'user'}</span>
          </div>
        </div>

        <div className="my-stats-grid">
          <div className="my-stat-card">
            <div className="my-stat-label">Total queries</div>
            <div className="my-stat-value">{stats.total_queries}</div>
          </div>
          <div className="my-stat-card">
            <div className="my-stat-label">Tokens used</div>
            <div className="my-stat-value">{stats.total_tokens}</div>
          </div>
          <div className="my-stat-card">
            <div className="my-stat-label">Est. spend</div>
            <div className="my-stat-value">${Number(stats.total_cost_usd || 0).toFixed(4)}</div>
          </div>
        </div>

        <div className="my-account-info">
          <h3>Account info</h3>
          <p>Member since: {memberSince}</p>
        </div>

        <button className="my-signout-btn" onClick={handleSignOut}>Sign out</button>
      </div>
    </div>
  );
}
