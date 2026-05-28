import { Fragment, useCallback, useEffect, useState } from 'react';
import { getDocuments, getHealth, getLogs, getRequests, getRetrievals } from '../api/admin';
import { deleteUser, getConversations, getTokenSummary, getTokenUsage, getUsers, updateUserRole, updateUserStatus } from '../api/usage';
import { useTranslation } from '../i18n/useTranslation';
import '../styles/AdminPage.css';

const TABS = ['users', 'health', 'usage', 'conversations', 'documents', 'requests', 'logs'];

function formatTime(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString();
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

function HealthPanel({ data }) {
  if (!data) return null;
  const isOk = data.status === 'ok' || data.status === 'healthy';

  const cards = [
    { label: 'Status', value: (data.status || '—').toUpperCase(), cls: isOk ? 'ok' : 'err' },
    { label: 'Uptime', value: data.uptime_seconds ? `${Math.round(data.uptime_seconds)}s` : '—', cls: '' },
    { label: 'Documents', value: data.indexed_documents ?? '—', cls: 'accent' },
    { label: 'Chunks', value: data.indexed_chunks ?? '—', cls: 'accent' },
    { label: 'Requests', value: data.total_requests ?? '—', cls: '' },
    { label: 'Logs', value: data.total_logs ?? '—', cls: '' },
    { label: 'Retrievals', value: data.total_retrievals ?? '—', cls: '' },
    { label: 'Vector store', value: data.vector_backend || 'faiss', cls: '' },
    { label: 'DB backend', value: data.persistence_backend || 'postgresql', cls: '' },
    { label: 'OpenAI', value: data.openai_configured ? 'configured' : 'not set', cls: data.openai_configured ? 'ok' : 'warn' },
  ];

  return (
    <div className="health-grid">
      {cards.map((card) => (
        <div key={card.label} className="health-card">
          <div className="health-card-label">{card.label}</div>
          <div className={`health-card-value ${card.cls}`}>{String(card.value)}</div>
        </div>
      ))}
    </div>
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
            <th>{t('admin_type')}</th>
            <th>{t('admin_chunks')}</th>
            <th>{t('admin_size')}</th>
            <th>{t('admin_uploaded')}</th>
            <th>Yuklab olish</th>
          </tr>
        </thead>
        <tbody>
          {data.map((doc) => (
            <tr key={doc.document_id}>
              <td className="td-primary">{doc.filename}</td>
              <td className="td-mono">{shortId(doc.workspace_id)}</td>
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

function UsersPanel({
  users,
  onReload,
  t,
  search,
  onSearchChange,
  roleFilter,
  onRoleFilterChange,
  loading,
}) {
  const sourceUsers = Array.isArray(users) ? users : [];
  const filteredUsers = sourceUsers.filter((user) => {
    const haystack = `${user.email || ''} ${user.full_name || ''}`.toLowerCase();
    const matchesSearch = !search || haystack.includes(search.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const handleToggleRole = async (user) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    await updateUserRole(user.user_id, nextRole);
    await onReload();
  };
  const handleToggleStatus = async (user) => {
    if (user.is_active && !window.confirm('Deactivate this user?')) return;
    await updateUserStatus(user.user_id, !user.is_active);
    await onReload();
  };
  const handleDelete = async (user) => {
    if (!window.confirm(t('confirm_delete_user') || 'Permanently delete this user? This cannot be undone.')) return;
    await deleteUser(user.user_id);
    await onReload();
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
              {filteredUsers.map((user) => (
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
                  <td style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button className="user-action-btn" onClick={() => handleToggleRole(user)}>
                      {user.role === 'admin' ? t('admin_make_user') : t('admin_make_admin')}
                    </button>
                    <button className="user-action-btn secondary" onClick={() => handleToggleStatus(user)}>
                      {user.is_active ? t('admin_deactivate') : t('admin_activate')}
                    </button>
                    <button className="user-action-btn danger" onClick={() => handleDelete(user)}>
                      {t('admin_delete')}
                    </button>
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
          <div className="metric-card">
            <div className="metric-label">{t('admin_total_requests') || 'Jami so\'rovlar'}</div>
            <div className="metric-value">{totalReqs}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">{t('admin_error_rate') || 'Xato darajasi'}</div>
            <div className="metric-value" style={{ color: errorRate > 5 ? '#ef4444' : '#22c55e' }}>
              {errorRate}%
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">{t('admin_avg_response') || 'O\'rt. javob vaqti'}</div>
            <div className="metric-value">
              {avgLatency > 0 ? `${(avgLatency / 1000).toFixed(1)}s` : '—'}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">{t('admin_slow_queries') || 'Sekin so\'rovlar (>3s)'}</div>
            <div className="metric-value" style={{ color: slowReqs.length > 0 ? '#f59e0b' : '#22c55e' }}>
              {slowReqs.length}
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
                  <th>Vaqt</th>
                  <th>Xabar</th>
                  <th>So'rov ID</th>
                </tr>
              </thead>
              <tbody>
                {errorLogs.slice(0, 10).map((log, i) => (
                  <tr key={i}>
                    <td className="mono">{new Date(log.timestamp).toLocaleTimeString()}</td>
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
                  <tr><th>Yo'l</th><th>Vaqt (ms)</th><th>Status</th></tr>
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

  const tabLabels = {
    users: t('admin_users') || 'Foydalanuvchilar',
    health: t('admin_health') || 'Holat',
    usage: t('admin_usage') || 'Foydalanish',
    conversations: t('admin_conversations') || 'Suhbatlar',
    documents: t('admin_documents') || 'Hujjatlar',
    requests: t('admin_requests') || 'So\'rovlar',
    logs: t('admin_metrics') || 'Ko\'rsatkichlar',
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
                    <div style={{ minWidth: 180, padding: 14, borderRadius: 12, background: '#ecfdf5', color: '#166534' }}>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>🟢 High</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{conversationTotals.high}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{conversationPercent(conversationTotals.high)}%</div>
                    </div>
                    <div style={{ minWidth: 180, padding: 14, borderRadius: 12, background: '#fffbeb', color: '#92400e' }}>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>🟡 Medium</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{conversationTotals.medium}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{conversationPercent(conversationTotals.medium)}%</div>
                    </div>
                    <div style={{ minWidth: 180, padding: 14, borderRadius: 12, background: '#fef2f2', color: '#991b1b' }}>
                      <div style={{ fontSize: 11, opacity: 0.8 }}>🔴 Low</div>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{conversationTotals.low}</div>
                      <div style={{ fontSize: 12, opacity: 0.8 }}>{conversationPercent(conversationTotals.low)}%</div>
                      {conversationPercent(conversationTotals.low) > 20 && (
                        <div style={{ marginTop: 6, fontSize: 11, color: '#991b1b' }}>
                          ⚠ More than 20% of conversations need review
                        </div>
                      )}
                    </div>
                  </div>
                  <label style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, minWidth: 220 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Score filter</span>
                    <select
                      value={conversationScoreFilter}
                      onChange={(event) => setConversationScoreFilter(event.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#ffffff' }}
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
                t={t}
                search={userSearch}
                onSearchChange={setUserSearch}
                roleFilter={userRoleFilter}
                onRoleFilterChange={setUserRoleFilter}
                loading={loading}
              />
            )}
            {activeTab === 'documents' && <DocumentsPanel data={data.documents} t={t} />}
            {activeTab === 'requests' && <RequestsPanel data={data.requests} t={t} />}
            {activeTab === 'logs' && renderMetrics()}
            {activeTab === 'retrievals' && <RetrievalsPanel data={data.retrievals} t={t} />}
          </>
        )}
      </div>
    </div>
  );
}
