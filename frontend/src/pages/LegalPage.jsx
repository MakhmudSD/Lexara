import { useEffect, useState } from 'react';
import client from '../api/client';
import '../styles/LegalPage.css';
import { useTranslation } from '../i18n/useTranslation';

function getJurisdiction(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('uzbek')) return 'UZ';
  if (lower.includes('korean') || lower.includes('korea')) return 'KR';
  return 'LAW';
}

export default function LegalPage({ onAskQuestion }) {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [askError, setAskError] = useState('');
  const [expanded, setExpanded] = useState({});

  const formatLegalWorkspaceName = (name) => {
    return name
      .replace(/\s*(Database|DB|Workspace)\s*/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const formatDocName = (filename) => {
    return filename
      .replace(/\.(txt|pdf|docx)$/i, '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase());
  };

  useEffect(() => {
    setLoading(true);
    client
      .get('/legal/workspaces')
      .then((res) => {
        setWorkspaces(Array.isArray(res.data) ? res.data : []);
        setError('');
      })
      .catch((err) => {
        setError(err.message || 'Failed to load legal workspaces');
        setWorkspaces([]);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleAsk = (ws) => {
    if (typeof onAskQuestion === 'function') {
      setAskError('');
      onAskQuestion(ws);
    } else {
      setAskError('Navigation unavailable — please reload the page.');
    }
  };

  return (
    <div className="legal-page">
      <section className="legal-hero">
        <h1>{t('legal_title') || 'Lexara Legal'}</h1>
        <p>
          {t('legal_subtitle') || 'Korean & Uzbek law research. Ask any legal question, get answers with source references.'}
        </p>
      </section>

      {loading && (
        <div className="legal-loading" role="status" aria-label="Loading legal databases">
          <div className="legal-loading-bar" />
          <div className="legal-loading-bar" />
          <div className="legal-loading-bar" />
        </div>
      )}

      {!loading && error && (
        <div className="legal-error" role="alert">{error}</div>
      )}

      {!loading && !error && workspaces.length === 0 && (
        <div className="legal-empty">{t('legal_no_databases') || 'No legal databases available yet.'}</div>
      )}

      {!loading && !error && workspaces.length > 0 && (
        <>
        {askError && <div className="legal-error" role="alert">{askError}</div>}
        <div className="legal-cards-grid">
          {workspaces.map((ws) => (
            <div key={ws.id} className="legal-card">
              <div className="legal-card-jurisdiction">{getJurisdiction(ws.name)}</div>
              <h2 className="legal-card-title">{formatLegalWorkspaceName(ws.name)}</h2>
              <p className="legal-card-description">{ws.description}</p>
              {ws.document_count != null && (
                <span className="legal-card-badge">{t('legal_documents').replace('{n}', ws.document_count || 0)}</span>
              )}
              <button
                className="legal-card-expand-btn"
                onClick={() => setExpanded(prev => ({...prev, [ws.id]: !prev[ws.id]}))}
              >
                {expanded[ws.id] ? '▲ Hide laws' : '▼ Show laws'}
              </button>

              {expanded[ws.id] && ws.documents && ws.documents.length > 0 && (
                <ul className="legal-card-doc-list">
                  {ws.documents.map(doc => (
                    <li key={doc.id} className="legal-card-doc-item">
                      📄 {formatDocName(doc.filename)}
                    </li>
                  ))}
                </ul>
              )}
              <button
                className="legal-card-cta"
                onClick={() => handleAsk(ws)}
              >
                {t('legal_ask_btn') || 'Ask a question'}
              </button>
            </div>
          ))}
        </div>
        </>
      )}

      <div className="legal-disclaimer">
        {t('legal_disclaimer') || 'For informational purposes only. Not legal advice. Always consult a qualified attorney.'}
      </div>
    </div>
  );
}
