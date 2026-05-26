import { Fragment, useEffect, useState } from 'react';
import { getDocuments, getHealth, getLogs, getRequests, getRetrievals } from '../api/admin';
import { getConversations, getTokenSummary, getTokenUsage, getUsers, updateUserRole, updateUserStatus } from '../api/usage';
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

function DocumentsPanel({ data }) {
  if (!data?.length) return <div className="admin-empty">no documents indexed</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Filename</th>
            <th>Workspace</th>
            <th>Type</th>
            <th>Chunks</th>
            <th>Size</th>
            <th>Uploaded</th>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RequestsPanel({ data }) {
  if (!data?.length) return <div className="admin-empty">no requests yet</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Method</th>
            <th>Path</th>
            <th>Status</th>
            <th>Duration</th>
            <th>Time</th>
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

function LogsPanel({ data }) {
  if (!data?.length) return <div className="admin-empty">no logs yet</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Level</th>
            <th>Stage</th>
            <th>Message</th>
            <th>Request</th>
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

function RetrievalsPanel({ data }) {
  if (!data?.length) return <div className="admin-empty">no retrievals yet</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Question</th>
            <th>Top-K</th>
            <th>Results</th>
            <th>Latency</th>
            <th>Time</th>
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

function UsagePanel({ summary, usage }) {
  if ((summary?.total_requests ?? 0) === 0) {
    return <div className="admin-empty">No queries yet. Make your first query to see usage data.</div>;
  }
  const summaryCards = [
    { label: 'Total Requests', value: summary?.total_requests ?? 0 },
    { label: 'Total Tokens', value: summary?.total_tokens ?? 0 },
    { label: 'Est. Cost (USD)', value: formatCost(summary?.total_cost_usd ?? 0) },
    { label: 'Avg Latency', value: `${Math.round(summary?.avg_latency_ms ?? 0)}ms` },
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
                <th>Time</th>
                <th>Workspace</th>
                <th>Model</th>
                <th>Prompt tok</th>
                <th>Completion tok</th>
                <th>Total tok</th>
                <th>Cost ($)</th>
                <th>Latency</th>
                <th>Mode</th>
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

function UsersPanel({ users, onReload }) {
  if (!users?.length) return <div className="admin-empty">No users registered yet.</div>;
  const handleToggleRole = async (user) => {
    const nextRole = user.role === 'admin' ? 'user' : 'admin';
    await updateUserRole(user.user_id, nextRole);
    onReload();
  };
  const handleToggleStatus = async (user) => {
    if (user.is_active && !window.confirm('Deactivate this user?')) return;
    await updateUserStatus(user.user_id, !user.is_active);
    onReload();
  };
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.user_id}>
              <td>{user.email}</td>
              <td>{user.full_name}</td>
              <td>
                <span className={`user-role-badge ${user.role === 'admin' ? 'admin' : 'user'}`}>
                  {user.role}
                </span>
              </td>
              <td>
                <span className="user-status">
                  <span className={`user-status-dot ${user.is_active ? 'active' : 'inactive'}`} />
                  {user.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className="td-mono">{formatTime(user.created_at)}</td>
              <td style={{ display: 'flex', gap: 8 }}>
                <button className="user-action-btn" onClick={() => handleToggleRole(user)}>
                  {user.role === 'admin' ? 'Make user' : 'Make admin'}
                </button>
                <button className="user-action-btn" onClick={() => handleToggleStatus(user)}>
                  {user.is_active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConversationsPanel({ data, expandedRow, onToggleRow }) {
  if (!data?.length) return <div className="admin-empty">no conversations yet</div>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Workspace</th>
            <th>Question</th>
            <th>Answer preview</th>
            <th>Mode</th>
            <th>Sources</th>
            <th>Score</th>
            <th>Turns</th>
            <th>Latency</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item, index) => (
            <Fragment key={`${item.request_id}-${index}`}>
              <tr onClick={() => onToggleRow(item.request_id)} style={{ cursor: 'pointer' }}>
                  <td className="td-mono">{formatTime(item.timestamp)}</td>
                  <td className="td-mono">{shortId(item.workspace_id)}</td>
                  <td>{truncate(item.question, 80)}</td>
                  <td>{truncate(item.answer || '', 60)}</td>
                  <td><span className={`badge ${item.mode === 'rag' ? 'badge-ok' : 'badge-warn'}`}>{item.mode}</span></td>
                  <td className="td-mono">{item.sources?.length ?? 0}</td>
                  <td className="td-mono">{item.top_score != null ? item.top_score.toFixed(3) : '—'}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('users');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedRow, setExpandedRow] = useState('');

  useEffect(() => {
    const fetchTab = async () => {
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
          users: getUsers,
          documents: getDocuments,
          requests: getRequests,
          logs: getLogs,
          retrievals: getRetrievals,
        };
        const result = await fetchers[activeTab]();
        if (activeTab === 'users') {
          const users = Array.isArray(result) ? result : result?.users || result?.data || [];
          setData((prev) => ({ ...prev, users }));
        } else {
          setData((prev) => ({ ...prev, [activeTab]: result }));
        }
      } catch (err) {
        setError(err.response?.data?.error?.message || err.message || 'Fetch failed');
      } finally {
        setLoading(false);
      }
    };

    fetchTab();
  }, [activeTab]);

  const counts = {
    usage: data.usage?.usage?.length,
    documents: data.documents?.length,
    requests: data.requests?.length,
    logs: data.logs?.length,
    retrievals: data.retrievals?.length,
    conversations: data.conversations?.length,
    users: data.users?.length,
  };

  return (
    <div className="admin-page">
      <div className="admin-tabs">
        {TABS.map((tab) => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab);
              setError('');
            }}
          >
            {t(tab)}
            {counts[tab] != null && <span className="tab-count">{counts[tab]}</span>}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {error && (
          <div style={{ marginBottom: 16, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--error)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>⚠</span> {error}
          </div>
        )}

        {loading ? (
          <div className="admin-skeleton-wrap">
            <div className="admin-skeleton-row" />
            <div className="admin-skeleton-row" />
            <div className="admin-skeleton-row" />
            <div className="admin-skeleton-row" />
          </div>
        ) : (
          <>
            {activeTab === 'health' && <HealthPanel data={data.health} />}
            {activeTab === 'usage' && <UsagePanel summary={data.usage?.summary} usage={data.usage?.usage} />}
            {activeTab === 'conversations' && (
              <ConversationsPanel
                data={data.conversations}
                expandedRow={expandedRow}
                onToggleRow={(id) => setExpandedRow((prev) => (prev === id ? '' : id))}
              />
            )}
            {activeTab === 'users' && (
              <UsersPanel
                users={data.users}
                onReload={async () => {
                  const response = await getUsers();
                  const users = Array.isArray(response) ? response : response?.users || response?.data || [];
                  setData((prev) => ({ ...prev, users }));
                }}
              />
            )}
            {activeTab === 'documents' && <DocumentsPanel data={data.documents} />}
            {activeTab === 'requests' && <RequestsPanel data={data.requests} />}
            {activeTab === 'logs' && <LogsPanel data={data.logs} />}
            {activeTab === 'retrievals' && <RetrievalsPanel data={data.retrievals} />}
          </>
        )}
      </div>
    </div>
  );
}
