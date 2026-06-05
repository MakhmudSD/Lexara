import { useEffect, useState } from 'react';
import client, { API_BASE_URL } from '../api/client';
import '../styles/ResearchPage.css';

const PHASES = ['Planning…', 'Searching…', 'Reflecting…', 'Writing…'];

/* ── Safe markdown renderer for the report ── */
function escHtml(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderReport(raw = '') {
  const lines = escHtml(raw).split(/\r?\n/);
  const out = [];
  let listItems = [];

  const flushList = () => {
    if (!listItems.length) return;
    out.push(`<ul>${listItems.map((li) => `<li>${li}</li>`).join('')}</ul>`);
    listItems = [];
  };

  const bold = (s) => s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flushList(); continue; }
    if (/^###\s/.test(line)) { flushList(); out.push(`<h3>${bold(line.slice(4))}</h3>`); continue; }
    if (/^##\s/.test(line))  { flushList(); out.push(`<h2>${bold(line.slice(3))}</h2>`); continue; }
    if (/^#\s/.test(line))   { flushList(); out.push(`<h1>${bold(line.slice(2))}</h1>`); continue; }
    if (/^[-*]\s/.test(line)) { listItems.push(bold(line.slice(2))); continue; }
    if (/^\d+\.\s/.test(line)) { listItems.push(bold(line.replace(/^\d+\.\s/, ''))); continue; }
    flushList();
    out.push(`<p>${bold(line)}</p>`);
  }
  flushList();
  return out.join('');
}

function getVerdict(reflection = '') {
  const l = reflection.toLowerCase();
  if (l.includes('sufficient') || l.includes('comprehensive') || l.includes('complete') || l.includes('adequate') || l.includes('well covered'))
    return 'pass';
  if (l.includes('gap') || l.includes('missing') || l.includes('insufficient') || l.includes('limited') || l.includes('revise'))
    return 'revise';
  return null;
}

export default function ResearchPage({ workspaceId, workspaceName, onBack, onChangeWorkspace, onWorkspaceNameChange }) {
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('general_research');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('plan');
  const [error, setError] = useState('');
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  /* Advance loading phase indicator while request is in-flight */
  useEffect(() => {
    if (!loading) { setPhaseIndex(0); return; }
    const id = setInterval(() => {
      setPhaseIndex((p) => Math.min(p + 1, PHASES.length - 1));
    }, 2800);
    return () => clearInterval(id);
  }, [loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!topic.trim() || !workspaceId) return;
    setLoading(true);
    setResult(null);
    setError('');
    setActiveTab('plan');

    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${API_BASE_URL}/research`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          topic: topic.trim(),
          workspace_id: workspaceId,
          include_web: mode === 'general_research',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.detail || body?.message || `Error ${res.status}`);
      }

      const data = await res.json();
      setResult(data);
      setActiveTab('plan');
    } catch (err) {
      setError(err.message || 'Research failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyReport = () => {
    if (!result?.report) return;
    navigator.clipboard.writeText(result.report).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const verdict = result ? getVerdict(result.reflection || '') : null;

  return (
    <div className="research-page">
      <div className="research-inner">
        {/* Page header */}
        <div className="research-page-header">
          <h1 className="research-title">Research</h1>
          {workspaceName && (
            <span className="research-workspace-badge">{workspaceName}</span>
          )}
        </div>

        {/* No workspace warning */}
        {!workspaceId && (
          <div className="research-no-workspace">
            <p>No workspace selected.</p>
            <p style={{ marginTop: 4, fontSize: 12 }}>
              Visit <strong>Ask</strong> first and select a workspace, then come back.
            </p>
          </div>
        )}

        {/* Input form */}
        {workspaceId && (
          <form className="research-form" onSubmit={handleSubmit}>
            <textarea
              className="research-topic-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Describe what you want to research…"
              rows={3}
              disabled={loading}
              aria-label="Research topic"
            />

            <div className="research-mode-row">
              <span className="research-mode-label">Mode</span>
              <div className="research-mode-group" role="group" aria-label="Research mode">
                <button
                  type="button"
                  className={`research-mode-btn${mode === 'general_research' ? ' active' : ''}`}
                  onClick={() => setMode('general_research')}
                  aria-pressed={mode === 'general_research'}
                >
                  Research
                </button>
                <button
                  type="button"
                  className={`research-mode-btn${mode === 'document_lookup' ? ' active' : ''}`}
                  onClick={() => setMode('document_lookup')}
                  aria-pressed={mode === 'document_lookup'}
                >
                  Document lookup
                </button>
              </div>
            </div>

            <div className="research-form-footer">
              <button
                type="submit"
                className="research-submit-btn"
                disabled={loading || !topic.trim()}
              >
                {loading ? 'Running…' : 'Run research'}
              </button>
            </div>
          </form>
        )}

        {/* Error */}
        {error && <div className="research-error" role="alert">{error}</div>}

        {/* Loading phase display */}
        {loading && (
          <div className="research-loading" role="status" aria-live="polite">
            <div className="research-phase-dots" aria-hidden="true">
              <div className="research-phase-dot" />
              <div className="research-phase-dot" />
              <div className="research-phase-dot" />
            </div>
            <span className="research-phase-label">{PHASES[phaseIndex]}</span>
            <div className="research-phases-track" aria-hidden="true">
              {PHASES.map((phase, i) => (
                <span
                  key={phase}
                  className={`research-phase-step${
                    i === phaseIndex ? ' active' : i < phaseIndex ? ' done' : ''
                  }`}
                >
                  {phase}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="research-results">
            <div className="research-tabs" role="tablist">
              {[
                { id: 'plan', label: 'PLAN' },
                { id: 'searches', label: 'SEARCHES' },
                { id: 'report', label: 'REPORT' },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  className={`research-tab${activeTab === id ? ' active' : ''}`}
                  role="tab"
                  aria-selected={activeTab === id}
                  onClick={() => setActiveTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* ── PLAN tab ── */}
            {activeTab === 'plan' && (
              <div className="research-tab-panel" role="tabpanel">
                <p className="research-plan-text">
                  {result.plan || 'No plan generated.'}
                </p>
              </div>
            )}

            {/* ── SEARCHES tab ── */}
            {activeTab === 'searches' && (
              <div className="research-tab-panel" role="tabpanel">
                {(result.searches || []).length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>No searches recorded.</p>
                ) : (
                  (result.searches || []).map((s, i) => (
                    <div key={i} className="research-search-row">
                      <span className="research-search-index">{i + 1}</span>
                      <span className="research-search-query">{s.query}</span>
                      <div className="research-search-hits">
                        {s.doc_hits > 0 && (
                          <span className="research-hit-badge doc">{s.doc_hits} DOC</span>
                        )}
                        {s.web_hits > 0 && (
                          <span className="research-hit-badge web">{s.web_hits} WEB</span>
                        )}
                        {s.doc_hits === 0 && s.web_hits === 0 && (
                          <span className="research-hit-badge web">0 hits</span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── REPORT tab ── */}
            {activeTab === 'report' && (
              <div className="research-tab-panel" role="tabpanel">
                <div className="research-report-toolbar">
                  <div>
                    {verdict && (
                      <span className={`research-verdict-badge ${verdict}`}>
                        {verdict === 'pass' ? '✓ Sufficient' : '⚠ Gaps noted'}
                      </span>
                    )}
                  </div>
                  <button
                    className="research-copy-btn"
                    onClick={copyReport}
                    aria-label="Copy report to clipboard"
                  >
                    {copied ? 'Copied!' : 'Copy report'}
                  </button>
                </div>

                <div
                  className="research-report-body"
                  dangerouslySetInnerHTML={{ __html: renderReport(result.report || '') }}
                />

                {result.reflection && (
                  <div className="research-reflection-note">
                    <div className="research-reflection-label">Reflection</div>
                    <div className="research-reflection-text">{result.reflection}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
