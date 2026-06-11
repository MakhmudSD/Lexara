import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { getDocuments, getHealth, getLogs, getRequests, getRetrievals } from '../api/admin';
import { deleteUser, getConversations, getTokenSummary, getTokenUsage, getUsers, updateUserRole, updateUserStatus } from '../api/usage';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/AdminPage.css';

function CountUp({ target, duration = 800 }) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        if (prefersReducedMotion || typeof target !== 'number') { setValue(target); return; }
        const start = performance.now();
        const tick = (now) => {
          const p = Math.min((now - start) / duration, 1);
          const eased = 1 - Math.pow(1 - p, 3);
          setValue(Math.round(eased * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  if (typeof target !== 'number') return <span>{target}</span>;
  return <span ref={ref}>{value.toLocaleString()}</span>;
}

function DeleteConfirmModal({ user, onConfirm, onCancel }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      <div
        style={{
          background: 'var(--color-surface)', borderRadius: 16,
          padding: '28px 32px', maxWidth: 400, width: '90%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
          border: '1px solid var(--color-border)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--color-text-primary)' }}>
          Delete user permanently?
        </h3>
        <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
          This will permanently delete <strong>{user.email}</strong> and all their data, including documents, conversations, and workspaces. This cannot be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 13 }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            style={{ padding: '8px 18px', borderRadius: 8, border: 'none', background: '#dc2626', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Delete permanently
          </button>
        </div>
      </div>
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

function shortId(id = '') {
  if (!id) return '—';
  const s = String(id);
  return s.length > 12 ? `${s.slice(0, 8)}…` : s;
}

function getScoreTier(value) {
  if (value == null) return 'none';
  if (value >= 0.75) return 'high';
  if (value >= 0.55) return 'medium';
  return 'low';
}

function formatJoinedDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

function formatCost(value) {
  const numeric = Number(value || 0);
  return `$${numeric.toFixed(4)}`;
}

function truncate(text = '', max = 80) {
  if (!text) return '—';
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

const HEALTH_DESCRIPTIONS = {
  Status: 'Current system health',
  Uptime: 'Time since last restart',
  Documents: 'Total indexed documents',
  Chunks: 'Total indexed text segments',
  Requests: 'Total HTTP requests served',
  Logs: 'Total log entries recorded',
  Retrievals: 'Total vector search queries',
  'Vector store': 'Embedding search backend',
  'DB backend': 'Persistent storage backend',
  OpenAI: 'LLM API configuration status',
};

function HealthPanel({ data }) {
  const gridRef = useRef(null);
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const cards = grid.querySelectorAll('.health-card');
    gsap.fromTo(cards,
      { opacity: 0, y: 20 },
      { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out', stagger: 0.05 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!data) return null;
  const isOk = data.status === 'ok' || data.status === 'healthy';

  const cards = [
    { label: 'Status', value: (data.status || '—').toUpperCase(), cls: isOk ? 'ok' : 'err', raw: null },
    { label: 'Uptime', value: data.uptime_seconds ? `${Math.round(data.uptime_seconds)}s` : '—', cls: '', raw: null },
    { label: 'Documents', value: data.indexed_documents ?? '—', cls: 'accent', raw: data.indexed_documents },
    { label: 'Chunks', value: data.indexed_chunks ?? '—', cls: 'accent', raw: data.indexed_chunks },
    { label: 'Requests', value: data.total_requests ?? '—', cls: '', raw: data.total_requests },
    { label: 'Logs', value: data.total_logs ?? '—', cls: '', raw: data.total_logs },
    { label: 'Retrievals', value: data.total_retrievals ?? '—', cls: '', raw: data.total_retrievals },
    { label: 'Vector store', value: data.vector_backend || 'faiss', cls: '', raw: null },
    { label: 'DB backend', value: data.persistence_backend || 'postgresql', cls: '', raw: null },
    { label: 'OpenAI', value: data.openai_configured ? 'configured' : 'not set', cls: data.openai_configured ? 'ok' : 'warn', raw: null },
  ];

  const numericCards = cards.filter((c) => typeof c.raw === 'number' && c.raw > 0);
  const barMax = numericCards.length > 0 ? Math.max(...numericCards.map((c) => c.raw)) : 1;

  return (
    <>
      <div ref={gridRef} className="health-grid">
        {cards.map((card) => (
          <div key={card.label} className="health-card health-card--glass">
            <div className="health-card-label">{card.label}</div>
            <div className={`health-card-value ${card.cls}`}>
              {typeof card.raw === 'number' ? <CountUp target={card.raw} /> : String(card.value)}
            </div>
            <div className="health-card-desc">{HEALTH_DESCRIPTIONS[card.label] || ''}</div>
          </div>
        ))}
      </div>

      {numericCards.length > 0 && (
        <div className="health-bar-chart">
          <div className="health-bar-chart-title">Relative volumes</div>
          {numericCards.map((card) => (
            <div key={card.label} className="health-bar-row">
              <div className="health-bar-name">{card.label}</div>
              <div className="health-bar-track">
                <div
                  className="health-bar-fill"
                  style={{ '--bar-pct': `${Math.round((card.raw / barMax) * 100)}%` }}
                />
              </div>
              <div className="health-bar-val">{card.raw.toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function EmptyUsersState({ message }) {
  return (
    <div className="admin-empty-state">
      <div className="admin-empty-icon">◌</div>
      <div className="admin-empty-message">{message}</div>
    </div>
  );
}

function DocumentsPanel({ data, t }) {
  if (!data?.length) return <div className="admin-empty">{t('admin_no_documents') || 'no documents indexed'}</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin_filename')}</th>
            <th>{t('admin_workspace')}</th>
            <th>User ID</th>
            <th>{t('admin_type')}</th>
            <th>{t('admin_chunks')}</th>
            <th>{t('admin_size')}</th>
            <th>{t('admin_uploaded')}</th>
            <th>Download</th>
          </tr>
        </thead>
        <tbody>
          {data.map((doc) => (
            <tr key={doc.document_id}>
              <td className="td-primary">{doc.filename}</td>
              <td className="td-mono">{shortId(doc.workspace_id)}</td>
              <td className="td-mono">{shortId(doc.user_id || doc.owner_id)}</td>
              <td className="td-mono">{doc.content_type?.split('/')[1] ?? doc.content_type}</td>
              <td className="td-mono">{doc.chunk_count}</td>
              <td className="td-mono">{doc.file_size ? `${(doc.file_size / 1024).toFixed(1)}k` : doc.size_bytes ? `${(doc.size_bytes / 1024).toFixed(1)}k` : '—'}</td>
              <td className="td-mono">{formatTime(doc.upload_time ?? doc.created_at)}</td>
              <td>
                <a
                  href={`${import.meta.env.VITE_API_URL}/documents/${doc.document_id}/download`}
                  download={doc.filename}
                  className="admin-download-link"
                  target="_blank"
                  rel="noreferrer"
                  title={doc.storage_path?.startsWith('r2://') ? 'Download from R2 storage' : 'Download file'}
                >
                  ↓
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestsPanel({ data, t }) {
  if (!data?.length) return <div className="admin-empty">{t('admin_no_requests') || 'no requests yet'}</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin_id') || 'ID'}</th>
            <th>{t('admin_method')}</th>
            <th>{t('admin_path')}</th>
            <th>{t('admin_status_code')}</th>
            <th>{t('admin_duration')}</th>
            <th>{t('admin_time')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((request) => (
            <tr key={request.request_id}>
              <td className="td-mono">{shortId(request.request_id)}</td>
              <td className="td-mono">{request.method}</td>
              <td className="td-primary">{request.path || request.endpoint}</td>
              <td>
                <span className={`badge ${request.status_code < 400 ? 'badge-ok' : 'badge-err'}`}>
                  {request.status_code || request.status}
                </span>
              </td>
              <td className="td-mono">{request.duration_ms != null ? `${Math.round(request.duration_ms)}ms` : request.latency_ms != null ? `${Math.round(request.latency_ms)}ms` : '—'}</td>
              <td className="td-mono">{formatTime(request.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LogsPanel({ data, t }) {
  if (!data?.length) return <div className="admin-empty">{t('admin_no_logs') || 'no logs yet'}</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin_time')}</th>
            <th>{t('admin_level') || 'Level'}</th>
            <th>{t('admin_stage') || 'Stage'}</th>
            <th>{t('admin_message')}</th>
            <th>{t('admin_request')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((log, index) => (
            <tr key={index}>
              <td className="td-mono">{formatTime(log.timestamp)}</td>
              <td>
                <span className={`badge ${log.level === 'ERROR' ? 'badge-err' : log.level === 'WARNING' ? 'badge-warn' : 'badge-ok'}`}>
                  {log.level}
                </span>
              </td>
              <td className="td-mono">{log.stage}</td>
              <td className="td-primary">{log.message}</td>
              <td className="td-mono">{shortId(log.request_id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RetrievalsPanel({ data, t }) {
  if (!data?.length) return <div className="admin-empty">{t('admin_no_retrievals') || 'no retrievals yet'}</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin_question')}</th>
            <th>{t('admin_top_k')}</th>
            <th>{t('admin_results')}</th>
            <th>{t('admin_latency')}</th>
            <th>{t('admin_time')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((retrieval, index) => (
            <tr key={index}>
              <td className="td-primary" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {retrieval.question}
              </td>
              <td className="td-mono">{retrieval.top_k}</td>
              <td>
                <div className="score-cell">
                  <span className="td-mono">{retrieval.results?.length ?? '—'}</span>
                  {retrieval.results?.[0]?.score != null && (
                    <>
                      <div className="score-bar-bg">
                        <div className="score-bar-fill" style={{ width: `${Math.round(retrieval.results[0].score * 100)}%` }} />
                      </div>
                      <span className="td-mono">{Math.round(retrieval.results[0].score * 100)}%</span>
                    </>
                  )}
                </div>
              </td>
              <td className="td-mono">{retrieval.latency_ms != null ? `${Math.round(retrieval.latency_ms)}ms` : '—'}</td>
              <td className="td-mono">{formatTime(retrieval.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsagePanel({ summary, usage, t }) {
  if ((summary?.total_requests ?? 0) === 0) {
    return <div className="admin-empty">{t('admin_no_queries') || 'No queries yet. Make your first query to see usage data.'}</div>;
  }
  const summaryCards = [
    { label: t('admin_requests') || 'Total Requests', value: summary?.total_requests ?? 0 },
    { label: t('admin_total_tokens') || 'Total Tokens', value: summary?.total_tokens ?? 0 },
    { label: t('admin_cost') || 'Est. Cost (USD)', value: formatCost(summary?.total_cost_usd ?? 0) },
    { label: t('admin_latency') || 'Avg Latency', value: `${Math.round(summary?.avg_latency_ms ?? 0)}ms` },
  ];

  return (
    <div>
        <div className="health-grid">
        {summaryCards.map((card) => (
          <div key={card.label} className="health-card">
            <div className="health-card-label">{card.label}</div>
            <div className="health-card-value accent">{String(card.value)}</div>
          </div>
        ))}
      </div>

      {!usage?.length ? (
        <div className="admin-empty">Query history will appear here.</div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin_time')}</th>
                <th>{t('admin_workspace')}</th>
                <th>{t('admin_model')}</th>
                <th>{t('admin_prompt_tokens')}</th>
                <th>{t('admin_completion_tokens')}</th>
                <th>{t('admin_total_tokens')}</th>
                <th>{t('admin_cost')}</th>
                <th>{t('admin_latency')}</th>
                <th>{t('admin_mode') || 'Mode'}</th>
              </tr>
            </thead>
            <tbody>
              {usage.map((item, index) => (
                <tr key={`${item.request_id}-${index}`}>
                  <td className="td-mono">{formatTime(item.timestamp)}</td>
                  <td className="td-mono">{shortId(item.workspace_id)}</td>
                  <td className="td-mono">{item.model}</td>
                  <td className="td-mono">{item.prompt_tokens}</td>
                  <td className="td-mono">{item.completion_tokens}</td>
                  <td className="td-mono">{item.total_tokens}</td>
                  <td className="td-mono">{formatCost(item.estimated_cost_usd)}</td>
                  <td className="td-mono">{Math.round(item.latency_ms)}ms</td>
                  <td>
                    <span className={`badge ${item.mode === 'rag' ? 'badge-ok' : 'badge-warn'}`}>
                      {item.mode}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const USERS_PER_PAGE = 10;

function UsersPanel({
  users,
  onReload,
  onDeleteUser,
  t,
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  sortBy,
  onSortByChange,
  page,
  onPageChange,
  loading,
}) {
  const [deleteTarget, setDeleteTarget] = useState(null);
  const sourceUsers = Array.isArray(users) ? users : [];

  const filteredUsers = sourceUsers
    .filter((user) => {
      const haystack = `${user.email || ''} ${user.full_name || ''}`.toLowerCase();
      const matchesSearch = !search || haystack.includes(search.toLowerCase());
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      return matchesSearch && matchesRole;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'email_asc':  return (a.email || '').localeCompare(b.email || '');
        case 'email_desc': return (b.email || '').localeCompare(a.email || '');
        case 'name_asc':   return (a.full_name || '').localeCompare(b.full_name || '');
        case 'name_desc':  return (b.full_name || '').localeCompare(a.full_name || '');
        case 'joined_asc': return new Date(a.created_at) - new Date(b.created_at);
        case 'joined_desc':
        default:           return new Date(b.created_at) - new Date(a.created_at);
      }
    });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / USERS_PER_PAGE));
  const safePage = Math.min(page, totalPages);
  const pageUsers = filteredUsers.slice((safePage - 1) * USERS_PER_PAGE, safePage * USERS_PER_PAGE);

  const handleToggleRole = async (user) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    await updateUserRole(user.user_id, nextRole);
    await onReload();
  };
  const handleToggleStatus = async (user) => {
    await updateUserStatus(user.user_id, !user.is_active);
    await onReload();
  };
  const handleDelete = async () => {
    if (!deleteTarget) return;
    const targetId = deleteTarget.user_id;
    setDeleteTarget(null);
    // optimistic removal — disappears instantly
    onDeleteUser(targetId);
    try {
      await deleteUser(targetId);
    } catch {
      await onReload();
    }
  };

  if (loading) {
    return (
      <div className="admin-skeleton-wrap">
        <div className="admin-skeleton-row" />
        <div className="admin-skeleton-row" />
        <div className="admin-skeleton-row" />
        <div className="admin-skeleton-row" />
      </div>
    );
  }

  return (
    <div>
      {deleteTarget && (
        <DeleteConfirmModal
          user={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
      <div className="users-toolbar">
        <input
          type="search"
          className="users-search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={t('admin_search_placeholder')}
        />
        <label className="users-role-filter">
          <span>{t('admin_role')}</span>
          <select value={roleFilter} onChange={(event) => onRoleFilterChange(event.target.value)}>
            <option value="all">{t('admin_filter_all')}</option>
            <option value="admin">{t('admin_filter_admin')}</option>
            <option value="user">{t('admin_filter_user')}</option>
          </select>
        </label>
        <label className="users-role-filter">
          <span>Sort</span>
          <select value={sortBy} onChange={(event) => onSortByChange(event.target.value)}>
            <option value="joined_desc">Joined ↓</option>
            <option value="joined_asc">Joined ↑</option>
            <option value="email_asc">Email A–Z</option>
            <option value="email_desc">Email Z–A</option>
            <option value="name_asc">Name A–Z</option>
            <option value="name_desc">Name Z–A</option>
          </select>
        </label>
      </div>

      {!sourceUsers.length ? (
        <EmptyUsersState message={t('admin_no_users')} />
      ) : !filteredUsers.length ? (
        <EmptyUsersState message={t('admin_no_users_match')} />
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{t('admin_email')}</th>
                <th>{t('admin_name')}</th>
                <th>{t('admin_role')}</th>
                <th>{t('admin_status')}</th>
                <th>{t('admin_joined')}</th>
                <th>{t('admin_actions')}</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.map((user) => (
                <tr key={user.user_id}>
                  <td>{user.email}</td>
                  <td>{user.full_name}</td>
                  <td>
                    <span className={`user-role-badge ${user.role === 'admin' ? 'admin' : 'user'}`}>
                      {user.role === 'admin' ? t('admin_filter_admin') : t('admin_filter_user')}
                    </span>
                  </td>
                  <td>
                    <span className="user-status">
                      <span className={`user-status-dot ${user.is_active ? 'active' : 'inactive'}`} />
                      {user.is_active ? t('admin_active') : t('admin_inactive')}
                    </span>
                  </td>
                  <td className="td-mono">{formatJoinedDate(user.created_at)}</td>
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <button className="user-action-btn" onClick={() => handleToggleRole(user)}>
                      {user.role === 'admin' ? t('admin_make_user') : t('admin_make_admin')}
                    </button>
                    <button
                      className={`user-action-btn secondary ${user.is_active ? 'deactivate' : 'activate'}`}
                      onClick={() => handleToggleStatus(user)}
                      title={user.is_active ? 'Temporarily block this user from logging in. Data is preserved.' : 'Re-enable this user\'s access.'}
                    >
                      {user.is_active ? t('admin_deactivate') : t('admin_activate')}
                    </button>
                    <button
                      className="user-action-btn danger"
                      onClick={() => setDeleteTarget(user)}
                      title="Permanently delete user and all their data. Cannot be undone."
                    >
                      {t('admin_delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {totalPages > 1 && (
            <div className="admin-pagination">
              <button
                className="admin-page-btn"
                disabled={safePage <= 1}
                onClick={() => onPageChange(safePage - 1)}
              >
                ‹
              </button>
              <span className="admin-page-info">{safePage} / {totalPages}</span>
              <button
                className="admin-page-btn"
                disabled={safePage >= totalPages}
                onClick={() => onPageChange(safePage + 1)}
              >
                ›
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConversationsPanel({ data, expandedRow, onToggleRow, t }) {
  if (!data?.length) return <div className="admin-empty">{t('admin_no_conversations') || 'no conversations yet'}</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin_time')}</th>
            <th>{t('admin_workspace')}</th>
            <th>{t('admin_question')}</th>
            <th>{t('admin_answer_preview')}</th>
            <th>{t('admin_mode') || 'Mode'}</th>
            <th>{t('admin_score') || 'Top score'}</th>
            <th>{t('admin_sources')}</th>
            <th>{t('admin_turns')}</th>
            <th>{t('admin_latency')}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => {
            const tier = getScoreTier(item.top_score);
            const color = tier === 'high' ? '#16a34a' : tier === 'medium' ? '#d97706' : tier === 'low' ? '#dc2626' : 'inherit';
            return (
              <Fragment key={`${item.request_id}-${index}`}>
                <tr onClick={() => onToggleRow(item.request_id)} style={{ cursor: 'pointer' }}>
                  <td className="td-mono">{formatTime(item.timestamp)}</td>
                  <td className="td-mono">{shortId(item.workspace_id)}</td>
                  <td>{truncate(item.question, 80)}</td>
                  <td>{truncate(item.answer || '', 60)}</td>
                  <td><span className={`badge ${item.mode === 'rag' ? 'badge-ok' : 'badge-warn'}`}>{item.mode}</span></td>
                  <td className="td-mono" style={{ color }}>
                    {item.top_score != null ? item.top_score.toFixed(3) : '—'}
                    {tier === 'low' && <span style={{ marginLeft: 6 }}>⚠ Needs review</span>}
                  </td>
                  <td className="td-mono">{item.sources?.length ?? 0}</td>
                  <td className="td-mono">{item.history_turns}</td>
                  <td className="td-mono">{item.latency_ms != null ? `${Math.round(item.latency_ms)}ms` : '—'}</td>
                </tr>
                {expandedRow === item.request_id && (
                  <tr>
                    <td colSpan={9}>
                      <div><strong>Q:</strong> {item.question}</div>
                      <div><strong>A:</strong> {item.answer || '—'}</div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage({ onGoChat }) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('users');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userSortBy, setUserSortBy] = useState('joined_desc');
  const [userPage, setUserPage] = useState(1);
  const [conversationScoreFilter, setConversationScoreFilter] = useState('all');

  const loadUsers = useCallback(async () => {
    const response = await getUsers();
    const users = Array.isArray(response)
      ? response
      : Array.isArray(response?.users)
        ? response.users
        : Array.isArray(response?.data)
          ? response.data
          : [];
    setData((prev) => ({ ...prev, users }));
    return users;
  }, []);

  const loadActiveTab = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const fetchers = {
        health: getHealth,
        usage: async () => ({
          summary: await getTokenSummary(),
          usage: await getTokenUsage(),
        }),
        conversations: getConversations,
        users: loadUsers,
        documents: getDocuments,
        requests: getRequests,
        logs: getLogs,
        retrievals: getRetrievals,
        support: async () => null,
      };

      if (activeTab === 'logs') {
        const [logsRes, reqsRes] = await Promise.all([
          fetchers.logs ? fetchers.logs() : Promise.resolve([]),
          fetchers.requests(),
        ]);
        setData((prev) => ({ ...prev, logs: logsRes, requests: reqsRes }));
      } else {
        const result = await fetchers[activeTab]();
        if (activeTab !== 'users') {
          setData((prev) => ({ ...prev, [activeTab]: result }));
        }
      }
    } catch (err) {
      setError(activeTab === 'users'
        ? t('connection_error')
        : err.response?.data?.error?.message || err.message || t('connection_error'));
    } finally {
      setLoading(false);
    }
  }, [activeTab, loadUsers]);

  useEffect(() => {
    loadActiveTab();
  }, [activeTab, loadActiveTab]);

  const conversations = Array.isArray(data.conversations) ? data.conversations : [];
  const conversationTotals = conversations.reduce(
    (totals, item) => {
      const tier = getScoreTier(item.top_score);
      if (tier === 'high') totals.high += 1;
      if (tier === 'medium') totals.medium += 1;
      if (tier === 'low') totals.low += 1;
      return totals;
    },
    { high: 0, medium: 0, low: 0 },
  );
  const conversationTotal = conversations.length;
  const conversationPercent = (value) => (conversationTotal ? Math.round((value * 100) / conversationTotal) : 0);
  const filteredConversations = conversations.filter((item) => {
    if (conversationScoreFilter === 'all') return true;
    const tier = getScoreTier(item.top_score);
    return conversationScoreFilter === tier;
  });

  const counts = {
    usage: data.usage?.usage?.length,
    documents: data.documents?.length,
    requests: data.requests?.length,
    logs: data.logs?.length,
    retrievals: data.retrievals?.length,
    conversations: conversations.length,
    users: data.users?.length,
  };

  const renderMetrics = () => {
    const requests = Array.isArray(data.requests) ? data.requests : [];
    const logs = Array.isArray(data.logs) ? data.logs : [];
    const totalReqs = requests.length;
    const errorReqs = requests.filter((r) =>
      r.status_code >= 400 || r.status === 'error'
    ).length;
    const errorRate = totalReqs > 0
      ? Math.round((errorReqs / totalReqs) * 100)
      : 0;
    const avgLatency = totalReqs > 0
      ? Math.round(requests.reduce((s, r) => s + (r.duration_ms || r.latency_ms || 0), 0) / totalReqs)
      : 0;
    const slowReqs = requests.filter((r) => (r.duration_ms || r.latency_ms || 0) > 3000);
    const errorLogs = logs.filter((l) => l.level === 'ERROR' || l.level === 'error');

    return (
      <div>
        <div className="metrics-grid">
          <div className="metric-card metric-card--glass">
            <div className="metric-label">{t('admin_total_requests') || 'Total Requests'}</div>
            <div className="metric-value"><CountUp target={totalReqs} /></div>
            <div className="metric-bar-wrap">
              <div className="metric-bar-fill" style={{ width: '100%', background: '#2356d8' }} />
            </div>
          </div>
          <div className="metric-card metric-card--glass">
            <div className="metric-label">{t('admin_error_rate') || 'Error Rate'}</div>
            <div className="metric-value" style={{
              color: errorRate > 5 ? '#ef4444' : errorRate >= 1 ? '#f59e0b' : '#22c55e'
            }}>
              {errorRate}%
            </div>
            <div className="metric-bar-wrap">
              <div className="metric-bar-fill" style={{
                width: `${Math.min(errorRate * 10, 100)}%`,
                background: errorRate > 5 ? '#ef4444' : errorRate >= 1 ? '#f59e0b' : '#22c55e',
              }} />
            </div>
            <div className="metric-bar-legend">
              <span style={{ color: '#22c55e' }}>● &lt;1% OK</span>
              <span style={{ color: '#f59e0b' }}>● 1–5% warn</span>
              <span style={{ color: '#ef4444' }}>● &gt;5% critical</span>
            </div>
          </div>
          <div className="metric-card metric-card--glass">
            <div className="metric-label">{t('admin_avg_response') || 'Avg Response'}</div>
            <div className="metric-value" style={{
              color: avgLatency > 3000 ? '#ef4444' : avgLatency > 1000 ? '#f59e0b' : '#22c55e'
            }}>
              {avgLatency > 0 ? `${(avgLatency / 1000).toFixed(1)}s` : '—'}
            </div>
            <div className="metric-bar-wrap">
              <div className="metric-bar-fill" style={{
                width: `${Math.min((avgLatency / 5000) * 100, 100)}%`,
                background: avgLatency > 3000 ? '#ef4444' : avgLatency > 1000 ? '#f59e0b' : '#22c55e',
              }} />
            </div>
          </div>
          <div className="metric-card metric-card--glass">
            <div className="metric-label">{t('admin_slow_queries') || 'Slow Queries (&gt;3s)'}</div>
            <div className="metric-value" style={{ color: slowReqs.length > 0 ? '#f59e0b' : '#22c55e' }}>
              <CountUp target={slowReqs.length} />
            </div>
            <div className="metric-bar-wrap">
              <div className="metric-bar-fill" style={{
                width: totalReqs > 0 ? `${Math.min((slowReqs.length / totalReqs) * 100 * 5, 100)}%` : '0%',
                background: slowReqs.length > 0 ? '#f59e0b' : '#22c55e',
              }} />
            </div>
          </div>
        </div>

        <div className="metrics-section-title">{t('admin_recent_errors') || 'So\'nggi xatolar'}</div>
        {errorLogs.length === 0 ? (
          <div className="metrics-empty">
            <span style={{ color: '#22c55e' }}>✓</span> {t('admin_no_errors') || 'Xatolar yo\'q'}
          </div>
        ) : (
          <div className="table-container">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{t('admin_metric_time') || 'Time'}</th>
                  <th>{t('admin_metric_message') || 'Message'}</th>
                  <th>{t('admin_metric_request_id') || 'Request ID'}</th>
                </tr>
              </thead>
              <tbody>
                {errorLogs.slice(0, 10).map((log, i) => (
                  <tr key={i}>
                    <td className="mono">{formatTime(log.timestamp)}</td>
                    <td style={{ color: '#b91c1c' }}>{log.message}</td>
                    <td className="mono">{(log.request_id || '').substring(0, 8)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {slowReqs.length > 0 && (
          <>
            <div className="metrics-section-title" style={{ marginTop: 16 }}>
              {t('admin_slow_queries') || 'Sekin so\'rovlar'}
            </div>
            <div className="table-container">
              <table className="admin-table">
                <thead>
                  <tr><th>{t('admin_metric_path') || 'Path'}</th><th>{t('admin_metric_time_ms') || 'Time (ms)'}</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {slowReqs.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td>{r.path || r.endpoint || '—'}</td>
                      <td style={{ color: '#f59e0b' }}>
                        {Math.round(r.duration_ms || r.latency_ms || 0)}ms
                      </td>
                      <td>{r.status_code || r.status || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

      </div>
    );
  };

  const renderMetricsChart = () => {
    const requests = Array.isArray(data.requests) ? data.requests : [];
    const logs = Array.isArray(data.logs) ? data.logs : [];
    const slowReqs = requests.filter((r) => (r.duration_ms || r.latency_ms || 0) > 3000);
    const errorLogs = logs.filter((l) => l.level === 'ERROR' || l.level === 'error');
    const chartData = [
      { name: 'Requests', value: requests.length },
      { name: 'Documents', value: data.documents?.length ?? 0 },
      { name: 'Logs', value: logs.length },
      { name: 'Slow', value: slowReqs.length },
      { name: 'Errors', value: errorLogs.length },
    ];
    return (
      <div style={{ marginTop: 24 }}>
        <div className="metrics-section-title">System activity overview</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, fontSize: 12 }}
              labelStyle={{ color: 'var(--color-text-primary)' }}
              itemStyle={{ color: 'var(--color-text-secondary)' }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={800}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={index >= 3 ? '#ef4444' : '#6366f1'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const tabLabels = {
    users: t('admin_users') || 'Foydalanuvchilar',
    health: t('admin_health') || 'Holat',
    usage: t('admin_usage') || 'Foydalanish',
    conversations: t('admin_conversations') || 'Suhbatlar',
    documents: t('admin_documents') || 'Hujjatlar',
    requests: t('admin_requests') || 'So\'rovlar',
    logs: t('admin_metrics') || 'Ko\'rsatkichlar',
    support: t('admin_support') || 'Questions',
  };
  const tabs = Object.keys(tabLabels);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <div className="admin-header-row">
          <button className="admin-back-btn" onClick={onGoChat} aria-label="Back to chat">
            ← Chat
          </button>
          <h1>Admin dashboard</h1>
        </div>
      </div>
      <div className="admin-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab);
              setError('');
            }}
          >
            {tabLabels[tab] || tab}
            {tab === 'users' && <span className="tab-count">{counts.users != null ? counts.users : 0}</span>}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {error && (
          <div style={{ marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--error)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span>⚠</span>
            <span>{error}</span>
            {activeTab === 'users' && (
              <button
                type="button"
                onClick={loadActiveTab}
                style={{
                  border: '1px solid rgba(0,0,0,0.12)',
                  background: '#fff',
                  borderRadius: 8,
                  padding: '6px 10px',
                  cursor: 'pointer',
                }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {loading && activeTab !== 'users' ? (
          <div className="admin-skeleton-wrap">
            <div className="admin-skeleton-row" />
            <div className="admin-skeleton-row" />
            <div className="admin-skeleton-row" />
            <div className="admin-skeleton-row" />
          </div>
        ) : (
          <>
            {activeTab === 'health' && <HealthPanel data={data.health} />}
            {activeTab === 'usage' && <UsagePanel summary={data.usage?.summary} usage={data.usage?.usage} t={t} />}
            {activeTab === 'conversations' && (
              <>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 180, padding: 14, borderRadius: 12, background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.20)', color: '#22c55e' }}>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>🟢 High</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{conversationTotals.high}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{conversationPercent(conversationTotals.high)}%</div>
                    </div>
                    <div style={{ minWidth: 180, padding: 14, borderRadius: 12, background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.20)', color: '#f59e0b' }}>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>🟡 Medium</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{conversationTotals.medium}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{conversationPercent(conversationTotals.medium)}%</div>
                    </div>
                    <div style={{ minWidth: 180, padding: 14, borderRadius: 12, background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.20)', color: '#ef4444' }}>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>🔴 Low</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{conversationTotals.low}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{conversationPercent(conversationTotals.low)}%</div>
                      {conversationPercent(conversationTotals.low) > 20 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#ef4444' }}>
                          ⚠ More than 20% of conversations need review
                        </div>
                      )}
                    </div>
                  </div>
                  <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
                    <span style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>Score filter</span>
                    <select
                      value={conversationScoreFilter}
                      onChange={(event) => setConversationScoreFilter(event.target.value)}
                      className="conversation-score-filter"
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)' }}
                    >
                      <option value="all">All scores</option>
                      <option value="high">High (≥75%)</option>
                      <option value="medium">Medium (55–74%)</option>
                      <option value="low">Low (&lt;55%)</option>
                    </select>
                  </label>
                </div>
                <ConversationsPanel
                  data={filteredConversations}
                  expandedRow={expandedRow}
                  onToggleRow={(id) => setExpandedRow((prev) => (prev === id ? '' : id))}
                  t={t}
                />
              </>
            )}
            {activeTab === 'users' && !error && (
              <UsersPanel
                users={data.users}
                onReload={loadActiveTab}
                onDeleteUser={(userId) =>
                  setData((prev) => ({
                    ...prev,
                    users: (Array.isArray(prev.users) ? prev.users : []).filter(
                      (u) => u.user_id !== userId
                    ),
                  }))
                }
                t={t}
                search={userSearch}
                onSearchChange={(v) => { setUserSearch(v); setUserPage(1); }}
                roleFilter={userRoleFilter}
                onRoleFilterChange={(v) => { setUserRoleFilter(v); setUserPage(1); }}
                sortBy={userSortBy}
                onSortByChange={(v) => { setUserSortBy(v); setUserPage(1); }}
                page={userPage}
                onPageChange={setUserPage}
                loading={loading}
              />
            )}
            {activeTab === 'documents' && <DocumentsPanel data={data.documents} t={t} />}
            {activeTab === 'requests' && <RequestsPanel data={data.requests} t={t} />}
            {activeTab === 'logs' && <>{renderMetrics()}{renderMetricsChart()}</>}
            {activeTab === 'retrievals' && <RetrievalsPanel data={data.retrievals} t={t} />}
            {activeTab === 'support' && <AdminSupportPanel />}
          </>
        )}
      </div>
    </div>
  );
}

function AdminSupportPanel() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [answeringId, setAnsweringId] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    import('../api/client').then(({ default: client }) => {
      client.get('/admin/support/tickets')
        .then((r) => setTickets(Array.isArray(r.data) ? r.data : []))
        .catch(() => setTickets([]))
        .finally(() => setLoading(false));
    });
  };

  useEffect(() => { load(); }, []);

  const handleAnswer = async (ticketId) => {
    if (!answerText.trim()) return;
    setSubmitting(true);
    const { default: client } = await import('../api/client');
    try {
      await client.patch(`/admin/support/tickets/${ticketId}/answer`, {
        answer: answerText.trim(),
        is_public: isPublic,
      });
      setAnsweringId(null);
      setAnswerText('');
      setIsPublic(false);
      load();
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  const handleTogglePublish = async (ticketId) => {
    const { default: client } = await import('../api/client');
    try {
      await client.patch(`/admin/support/tickets/${ticketId}/publish`);
      load();
    } catch {
      // ignore
    }
  };

  const unanswered = tickets.filter((t) => !t.answer).length;
  const avg = tickets.length
    ? tickets
        .filter((t) => t.answered_at && t.created_at)
        .reduce((sum, t) => sum + (new Date(t.answered_at) - new Date(t.created_at)), 0) /
      Math.max(1, tickets.filter((t) => t.answered_at).length) / 3600000
    : 0;

  if (loading) return <div style={{ padding: 24, color: 'var(--color-text-muted)', fontSize: 13 }}>Loading tickets…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[
          ['Total', tickets.length],
          ['Unanswered', unanswered],
          ['Avg response', `${avg.toFixed(1)}h`],
        ].map(([label, value]) => (
          <div key={label} style={{
            padding: '10px 18px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--color-elevated)',
            border: '1px solid var(--color-border)',
            minWidth: 100,
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text-primary)' }}>{value}</div>
            <div style={{ fontSize: 11, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Question</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <Fragment key={ticket.id}>
                <tr>
                  <td style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{ticket.user_email || ticket.user_id.slice(0, 8)}</td>
                  <td style={{ fontSize: 13, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ticket.question}</td>
                  <td>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '2px 8px',
                      borderRadius: 999,
                      background: ticket.answer ? 'rgba(34,197,94,0.12)' : 'rgba(245,158,11,0.12)',
                      color: ticket.answer ? '#22c55e' : '#f59e0b',
                      textTransform: 'uppercase',
                    }}>
                      {ticket.answer ? (ticket.is_public ? 'FAQ' : 'Answered') : 'Pending'}
                    </span>
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ display: 'flex', gap: 6 }}>
                    {!ticket.answer && (
                      <button
                        onClick={() => { setAnsweringId(ticket.id); setAnswerText(''); setIsPublic(false); }}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: 'var(--color-accent)', cursor: 'pointer' }}
                      >
                        Answer
                      </button>
                    )}
                    {ticket.answer && (
                      <button
                        onClick={() => handleTogglePublish(ticket.id)}
                        style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'transparent', color: ticket.is_public ? '#22c55e' : 'var(--color-text-muted)', cursor: 'pointer' }}
                      >
                        {ticket.is_public ? 'Unpublish' : 'Publish FAQ'}
                      </button>
                    )}
                  </td>
                </tr>
                {answeringId === ticket.id && (
                  <tr>
                    <td colSpan={5} style={{ padding: '8px 12px', background: 'var(--color-elevated)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>Q: {ticket.question}</div>
                        <textarea
                          rows={3}
                          value={answerText}
                          onChange={(e) => setAnswerText(e.target.value)}
                          placeholder="Write your answer…"
                          style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--color-border)', background: 'var(--color-surface)', color: 'var(--color-text-primary)', fontSize: 13, fontFamily: 'inherit', resize: 'vertical' }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                            Publish as FAQ
                          </label>
                          <button
                            onClick={() => handleAnswer(ticket.id)}
                            disabled={submitting || !answerText.trim()}
                            style={{ padding: '6px 14px', borderRadius: 6, background: 'var(--color-accent)', color: '#fff', border: 'none', fontSize: 12, cursor: 'pointer', opacity: submitting ? 0.6 : 1 }}
                          >
                            {submitting ? 'Saving…' : 'Submit Answer'}
                          </button>
                          <button
                            onClick={() => setAnsweringId(null)}
                            style={{ padding: '6px 14px', borderRadius: 6, background: 'transparent', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)', fontSize: 12, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
