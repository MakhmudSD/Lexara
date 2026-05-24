import { useState, useEffect } from 'react';
import { getLogs, getRequests, getDocuments, getRetrievals, getHealth } from '../api/admin';
import '../styles/AdminPage.css';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('logs');
  const [logs, setLogs] = useState([]);
  const [requests, setRequests] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [retrievals, setRetrievals] = useState([]);
  const [health, setHealth] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    setError('');
    try {
      switch (activeTab) {
        case 'logs':
          const logsData = await getLogs();
          setLogs(logsData);
          break;
        case 'requests':
          const requestsData = await getRequests();
          setRequests(requestsData);
          break;
        case 'documents':
          const documentsData = await getDocuments();
          setDocuments(documentsData);
          break;
        case 'retrievals':
          const retrievalsData = await getRetrievals();
          setRetrievals(retrievalsData);
          break;
        case 'health':
          const healthData = await getHealth();
          setHealth(healthData);
          break;
        default:
          break;
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Failed to fetch data');
    } finally {
      setIsLoading(false);
    }
  };

  const renderLogs = () => (
    <div className="table-container">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Workspace ID</th>
            <th>Type</th>
            <th>Latency (ms)</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {logs.length === 0 ? (
            <tr>
              <td colSpan="5" className="empty-cell">No logs available</td>
            </tr>
          ) : (
            logs.map((log) => (
              <tr key={log.request_id}>
                <td className="mono">{log.request_id.substring(0, 8)}...</td>
                <td>{log.workspace_id || '-'}</td>
                <td>{log.log_type}</td>
                <td>{log.latency_ms?.toFixed(0) || '-'}</td>
                <td className="mono">{new Date(log.timestamp).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderRequests = () => (
    <div className="table-container">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Endpoint</th>
            <th>Workspace ID</th>
            <th>Status</th>
            <th>Latency (ms)</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {requests.length === 0 ? (
            <tr>
              <td colSpan="6" className="empty-cell">No requests available</td>
            </tr>
          ) : (
            requests.map((req) => (
              <tr key={req.request_id}>
                <td className="mono">{req.request_id.substring(0, 8)}...</td>
                <td>{req.endpoint}</td>
                <td>{req.workspace_id || '-'}</td>
                <td>
                  <span className={`status-badge ${req.status}`}>{req.status}</span>
                </td>
                <td>{req.latency_ms?.toFixed(0) || '-'}</td>
                <td className="mono">{new Date(req.timestamp).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderDocuments = () => (
    <div className="table-container">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Document ID</th>
            <th>Filename</th>
            <th>Workspace ID</th>
            <th>Chunks</th>
            <th>Size (KB)</th>
            <th>Uploaded</th>
          </tr>
        </thead>
        <tbody>
          {documents.length === 0 ? (
            <tr>
              <td colSpan="6" className="empty-cell">No documents available</td>
            </tr>
          ) : (
            documents.map((doc) => (
              <tr key={doc.document_id}>
                <td className="mono">{doc.document_id.substring(0, 8)}...</td>
                <td>{doc.filename}</td>
                <td>{doc.workspace_id}</td>
                <td>{doc.chunk_count}</td>
                <td>{(doc.size_bytes / 1024).toFixed(1)}</td>
                <td className="mono">{new Date(doc.created_at).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderRetrievals = () => (
    <div className="table-container">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Request ID</th>
            <th>Document ID</th>
            <th>Score</th>
            <th>Chunks Retrieved</th>
            <th>Timestamp</th>
          </tr>
        </thead>
        <tbody>
          {retrievals.length === 0 ? (
            <tr>
              <td colSpan="5" className="empty-cell">No retrievals available</td>
            </tr>
          ) : (
            retrievals.map((ret, idx) => (
              <tr key={idx}>
                <td className="mono">{ret.request_id.substring(0, 8)}...</td>
                <td className="mono">{ret.document_id.substring(0, 8)}...</td>
                <td>{(ret.score * 100).toFixed(1)}%</td>
                <td>{ret.chunk_count}</td>
                <td className="mono">{new Date(ret.timestamp).toLocaleString()}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const renderHealth = () => (
    <div className="health-container">
      {health && (
        <>
          <div className="health-card">
            <h3>Status</h3>
            <p className={`health-status ${health.status}`}>{health.status.toUpperCase()}</p>
          </div>
          <div className="health-card">
            <h3>Uptime</h3>
            <p>{(health.uptime_seconds / 60).toFixed(1)} minutes</p>
          </div>
          <div className="health-card">
            <h3>Requests Processed</h3>
            <p>{health.requests_processed}</p>
          </div>
          <div className="health-card">
            <h3>Documents Stored</h3>
            <p>{health.documents_stored}</p>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>⚙️ Admin Dashboard</h1>
      </div>

      <div className="admin-tabs">
        {['logs', 'requests', 'documents', 'retrievals', 'health'].map((tab) => (
          <button
            key={tab}
            className={`tab-button ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      <div className="admin-content">
        {error && <div className="error-banner">{error}</div>}
        {isLoading && <div className="loading">Loading...</div>}
        {!isLoading && !error && (
          <>
            {activeTab === 'logs' && renderLogs()}
            {activeTab === 'requests' && renderRequests()}
            {activeTab === 'documents' && renderDocuments()}
            {activeTab === 'retrievals' && renderRetrievals()}
            {activeTab === 'health' && renderHealth()}
          </>
        )}
      </div>
    </div>
  );
}
