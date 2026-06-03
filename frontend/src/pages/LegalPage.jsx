import { useEffect, useState } from 'react';
import client from '../api/client';
import '../styles/LegalPage.css';

const ICONS = {
  default: '⚖️',
  uzbek: '🏛️',
  korean: '🇰🇷',
};

function getIcon(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('uzbek')) return ICONS.uzbek;
  if (lower.includes('korean') || lower.includes('korea')) return ICONS.korean;
  return ICONS.default;
}

export default function LegalPage({ onAskQuestion }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      onAskQuestion(ws);
    }
  };

  return (
    <div className="legal-page">
      <section className="legal-hero">
        <h1>Lexara Legal</h1>
        <p>
          AI-powered Korean &amp; Uzbek law research. Ask any legal question, get cited answers.
        </p>
      </section>

      {loading && (
        <div className="legal-empty">Loading legal databases…</div>
      )}

      {!loading && error && (
        <div className="legal-empty">{error}</div>
      )}

      {!loading && !error && workspaces.length === 0 && (
        <div className="legal-empty">No legal databases available yet.</div>
      )}

      {!loading && !error && workspaces.length > 0 && (
        <div className="legal-cards-grid">
          {workspaces.map((ws) => (
            <div key={ws.id} className="legal-card">
              <div className="legal-card-icon">{getIcon(ws.name)}</div>
              <h2 className="legal-card-title">{ws.name}</h2>
              <p className="legal-card-description">{ws.description}</p>
              {ws.document_count != null && (
                <span className="legal-card-badge">{ws.document_count} documents</span>
              )}
              <button
                className="legal-card-cta"
                onClick={() => handleAsk(ws)}
              >
                Ask a question
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="legal-disclaimer">
        For informational purposes only. Not legal advice. Always consult a qualified attorney.
      </div>
    </div>
  );
}
