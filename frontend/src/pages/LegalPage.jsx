import { useEffect, useState } from 'react';
import client from '../api/client';
import '../styles/LegalPage.css';
import { useTranslation } from '../i18n/useTranslation';

const formatDocName = (filename) =>
  filename
    .replace(/\.(txt|pdf|docx)$/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

const formatLegalWorkspaceName = (name) =>
  name
    .replace(/\s*(Database|DB|Workspace)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

function splitDocs(documents = []) {
  const koreanDocs = documents.filter((d) => {
    const f = d.filename.toLowerCase();
    return (
      !f.includes('uzbek') &&
      !f.includes('labour_code') &&
      !f.includes('civil_code_of_uzbek') &&
      !f.includes('criminal_code_of_uzbek') &&
      !f.includes('constitution_of_uzbek')
    );
  });
  const uzbekDocs = documents.filter((d) => {
    const f = d.filename.toLowerCase();
    return f.includes('uzbek') || f.includes('labour_code');
  });
  return { koreanDocs, uzbekDocs };
}

function JurisdictionCard({ ws, docs, badge, expandKey, expanded, onToggle, onAsk, t }) {
  return (
    <div className="legal-card">
      <div className="legal-card-jurisdiction">{badge}</div>
      <h2 className="legal-card-title">{formatLegalWorkspaceName(ws.name)}</h2>
      <p className="legal-card-description">{ws.description}</p>
      {docs.length > 0 && (
        <span className="legal-card-badge">
          {(t('legal_documents') || '{n} documents').replace('{n}', docs.length)}
        </span>
      )}
      {docs.length > 0 && (
        <button
          className="legal-card-expand-btn"
          onClick={() => onToggle(expandKey)}
        >
          {expanded ? `▲ ${t('legal_hide_laws') || 'Hide laws'}` : `▼ ${t('legal_show_laws') || 'Show laws'}`}
        </button>
      )}
      {expanded && docs.length > 0 && (
        <ul className="legal-card-doc-list">
          {docs.map((doc) => (
            <li key={doc.id} className="legal-card-doc-item">
              📄 {formatDocName(doc.filename)}
            </li>
          ))}
        </ul>
      )}
      <button className="legal-card-cta" onClick={() => onAsk(ws)}>
        {t('legal_ask_btn') || 'Ask a question'}
      </button>
    </div>
  );
}

export default function LegalPage({ onAskQuestion }) {
  const { t } = useTranslation();
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [askError, setAskError] = useState('');
  const [expanded, setExpanded] = useState({});

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

  const handleToggle = (key) =>
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));

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
          {t('legal_subtitle') ||
            'Korean & Uzbek law research. Ask any legal question, get answers with source references.'}
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
            {workspaces.map((ws) => {
              const { koreanDocs, uzbekDocs } = splitDocs(ws.documents || []);
              const hasBoth = koreanDocs.length > 0 && uzbekDocs.length > 0;

              if (hasBoth) {
                return (
                  <div key={ws.id} className="legal-jurisdiction-pair">
                    <JurisdictionCard
                      ws={ws}
                      docs={koreanDocs}
                      badge="KR"
                      expandKey={`${ws.id}_kr`}
                      expanded={!!expanded[`${ws.id}_kr`]}
                      onToggle={handleToggle}
                      onAsk={handleAsk}
                      t={t}
                    />
                    <JurisdictionCard
                      ws={ws}
                      docs={uzbekDocs}
                      badge="UZ"
                      expandKey={`${ws.id}_uz`}
                      expanded={!!expanded[`${ws.id}_uz`]}
                      onToggle={handleToggle}
                      onAsk={handleAsk}
                      t={t}
                    />
                  </div>
                );
              }

              const badge = uzbekDocs.length > 0 ? 'UZ' : 'KR';
              const docs = uzbekDocs.length > 0 ? uzbekDocs : koreanDocs;
              return (
                <JurisdictionCard
                  key={ws.id}
                  ws={ws}
                  docs={docs}
                  badge={badge}
                  expandKey={ws.id}
                  expanded={!!expanded[ws.id]}
                  onToggle={handleToggle}
                  onAsk={handleAsk}
                  t={t}
                />
              );
            })}
          </div>
        </>
      )}

      <div className="legal-disclaimer">
        {t('legal_disclaimer') ||
          'For informational purposes only. Not legal advice. Always consult a qualified attorney.'}
      </div>
    </div>
  );
}
