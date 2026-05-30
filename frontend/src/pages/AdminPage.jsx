import { useState, useEffect } from 'react';
import { getLogs, getRequests, getDocuments, getRetrievals, getHealth } from '../api/admin';
import '../styles/AdminPage.css';

const TABS = ['health', 'documents', 'requests', 'logs', 'retrievals'];

function formatTime(ts) {
  if (!ts) return '—';
  try { return new Date(ts).toLocaleTimeString(); } catch { return ts; }
}

function shortId(id = '') {
  if (!id) return '—';
  const s = String(id);
  return s.length > 12 ? `${s.slice(0, 8)}…` : s;
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
    <div>
      <div className="health-grid">
        {cards.map(c => (
          <div key={c.label} className="health-card">
            <div className="health-card-label">{c.label}</div>
            <div className={`health-card-value ${c.cls}`}>{String(c.value)}</div>
          </div>
        ))}
      </div>
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
          {data.map(d => (
            <tr key={d.document_id}>
              <td className="td-primary">{d.filename}</td>
              <td className="td-mono">{shortId(d.workspace_id)}</td>
              <td className="td-mono">{d.content_type?.split('/')[1] ?? d.content_type}</td>
              <td className="td-mono">{d.chunk_count}</td>
              <td className="td-mono">{d.file_size ? `${(d.file_size/1024).toFixed(1)}k` : d.size_bytes ? `${(d.size_bytes/1024).toFixed(1)}k` : '—'}</td>
              <td className="td-mono">{formatTime(d.upload_time ?? d.created_at)}</td>
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
          {data.map(r => (
            <tr key={r.request_id}>
              <td className="td-mono">{shortId(r.request_id)}</td>
              <td className="td-mono">{r.method}</td>
              <td className="td-primary">{r.path || r.endpoint}</td>
              <td>
                <span className={`badge ${r.status_code < 400 ? 'badge-ok' : 'badge-err'}`}>
                  {r.status_code || r.status}
                </span>
              </td>
              <td className="td-mono">{r.duration_ms != null ? `${Math.round(r.duration_ms)}ms` : r.latency_ms != null ? `${Math.round(r.latency_ms)}ms` : '—'}</td>
              <td className="td-mono">{formatTime(r.timestamp)}</td>
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
          {data.map((l, i) => (
            <tr key={i}>
              <td className="td-mono">{formatTime(l.timestamp)}</td>
              <td>
                <span className={`badge ${l.level === 'ERROR' ? 'badge-err' : l.level === 'WARNING' ? 'badge-warn' : 'badge-ok'}`}>
                  {l.level}
                </span>
              </td>
              <td className="td-mono">{l.stage}</td>
              <td className="td-primary">{l.message}</td>
              <td className="td-mono">{shortId(l.request_id)}</td>
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
          {data.map((r, i) => (
            <tr key={i}>
              <td className="td-primary" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {r.question}
              </td>
              <td className="td-mono">{r.top_k}</td>
              <td>
                <div className="score-cell">
                  <span className="td-mono">{r.results?.length ?? '—'}</span>
                  {r.results?.[0]?.score != null && (
                    <>
                      <div className="score-bar-bg">
                        <div className="score-bar-fill" style={{ width: `${Math.round(r.results[0].score * 100)}%` }} />
                      </div>
                      <span className="td-mono">{Math.round(r.results[0].score * 100)}%</span>
                    </>
                  )}
                </div>
              </td>
              <td className="td-mono">{r.latency_ms != null ? `${Math.round(r.latency_ms)}ms` : '—'}</td>
              <td className="td-mono">{formatTime(r.timestamp)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('health');
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTab = async (tab) => {
    setLoading(true);
    setError('');
    try {
      const fetchers = {
        health: getHealth,
        documents: getDocuments,
        requests: getRequests,
        logs: getLogs,
        retrievals: getRetrievals,
      };
      const result = await fetchers[tab]();
      setData(prev => ({ ...prev, [tab]: result }));
    } catch (err) {
      setError(err.response?.data?.error?.message || err.message || 'Fetch failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTab(activeTab); }, [activeTab]);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setError('');
  };

  const counts = {
    documents: data.documents?.length,
    requests: data.requests?.length,
    logs: data.logs?.length,
    retrievals: data.retrievals?.length,
  };

  return (
    <div className="admin-page">
      <div className="admin-tabs">
        {TABS.map(tab => (
          <button
            key={tab}
            className={`admin-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => switchTab(tab)}
          >
            {tab}
            {counts[tab] != null && (
              <span className="tab-count">{counts[tab]}</span>
            )}
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
          <div className="admin-loading">
            <div className="admin-loading-dot" />
            loading {activeTab}…
          </div>
        ) : (
          <>
            {activeTab === 'health'      && <HealthPanel data={data.health} />}
            {activeTab === 'documents'   && <DocumentsPanel data={data.documents} />}
            {activeTab === 'requests'    && <RequestsPanel data={data.requests} />}
            {activeTab === 'logs'        && <LogsPanel data={data.logs} />}
            {activeTab === 'retrievals'  && <RetrievalsPanel data={data.retrievals} />}
          </>
        )}
      </div>
    </div>
  );
}
