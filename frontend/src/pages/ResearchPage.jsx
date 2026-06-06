import { useEffect, useState, useRef } from 'react';
import client, { API_BASE_URL } from '../api/client';
import { useTranslation } from '../i18n/useTranslation';
import WorkspaceSelector from '../components/WorkspaceSelector';
import { uploadDocument, getDocumentStatus } from '../api/upload';
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
  const { t } = useTranslation();
  const workspaceSelectorRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const [topic, setTopic] = useState('');
  const [mode, setMode] = useState('general_research');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [activeTab, setActiveTab] = useState('plan');
  const [error, setError] = useState('');
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedDocs, setUploadedDocs] = useState([]);

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
      setActiveTab('report');
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !workspaceId) return;

    setIsUploading(true);
    setUploadProgress(0);

    let documentId = null;
    try {
      const result = await uploadDocument(file, workspaceId, null, (pct) => setUploadProgress(pct));
      documentId = result?.id;
    } catch {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!documentId) {
      setUploadedDocs(prev => [...prev, { id: Date.now(), filename: file.name }]);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const poll = async () => {
      try {
        const status = await getDocumentStatus(documentId);
        if (status.status === 'ready') {
          setUploadedDocs(prev => [...prev, {
            id: documentId,
            filename: status.filename || file.name,
          }]);
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else if (status.status === 'failed') {
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
        } else {
          pollTimeoutRef.current = setTimeout(poll, 2000);
        }
      } catch {
        pollTimeoutRef.current = setTimeout(poll, 2000);
      }
    };
    pollTimeoutRef.current = setTimeout(poll, 2000);
  };

  useEffect(() => {
    return () => {
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  const verdict = result ? getVerdict(result.reflection || '') : null;

  return (
    <div className="research-page">
      <div className="research-inner">
        {/* Page header */}
        <div className="research-page-header">
          <h1 className="research-title">{t('research_title')}</h1>
          {workspaceName && (
            <span className="research-workspace-badge">{workspaceName}</span>
          )}
        </div>

        {/* Workspace selector (when no workspace selected) */}
        {!workspaceId && (
          <div className="research-workspace-setup">
            <p className="research-workspace-setup-label">
              {t('research_select_workspace') || 'Select a workspace to search your documents.'}
            </p>
            <WorkspaceSelector
              ref={workspaceSelectorRef}
              workspaceId={workspaceId}
              workspaceName={workspaceName}
              onWorkspaceChange={(id) => onChangeWorkspace?.(id)}
              onWorkspaceNameChange={(name) => onWorkspaceNameChange?.(name)}
              onConnectionError={() => {}}
              onCreatingChange={() => {}}
            />
          </div>
        )}

        {/* Document upload — shown when workspace is selected */}
        {workspaceId && (
          <div className="research-upload-area">
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.txt"
              aria-label="Upload document"
            />
            <button
              className="research-upload-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading
                ? `Uploading… ${uploadProgress}%`
                : '+ Upload document'}
            </button>
            {uploadedDocs.length > 0 && (
              <div className="research-doc-list">
                {uploadedDocs.map((doc) => (
                  <div key={doc.id} className="research-doc-chip">
                    📄 {doc.filename}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Input form */}
        {workspaceId && (
          <form className="research-form" onSubmit={handleSubmit}>
            <textarea
              className="research-topic-input"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder={t('research_topic_placeholder') || "Describe what you want to research…"}
              rows={3}
              disabled={loading}
              aria-label={t('research_topic_label')}
            />

            <div className="research-mode-row">
              <span className="research-mode-label">{t('research_topic_label')}</span>
              <div className="research-mode-group" role="group" aria-label={t('research_topic_label')}>
                <button
                  type="button"
                  className={`research-mode-btn${mode === 'general_research' ? ' active' : ''}`}
                  onClick={() => setMode('general_research')}
                  aria-pressed={mode === 'general_research'}
                >
                  {t('research_mode_web')}
                </button>
                <button
                  type="button"
                  className={`research-mode-btn${mode === 'document_lookup' ? ' active' : ''}`}
                  onClick={() => setMode('document_lookup')}
                  aria-pressed={mode === 'document_lookup'}
                >
                  {t('research_mode_doc')}
                </button>
              </div>
            </div>

            <div className="research-form-footer">
              <button
                type="submit"
                className="research-submit-btn"
                disabled={loading || !topic.trim()}
              >
                {loading ? 'Running…' : t('research_run')}
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
            {activeTab === 'plan' && result?.plan && (
              <div className="research-tab-panel" role="tabpanel">
                <div className="research-plan">
                  <div className="research-plan-question">
                    <div className="research-plan-label">Main Question</div>
                    <p className="research-plan-value">{result.plan.main_question}</p>
                  </div>

                  {result.plan.sub_questions?.length > 0 && (
                    <div className="research-plan-section">
                      <div className="research-plan-label">Sub-questions</div>
                      <ul className="research-plan-list">
                        {result.plan.sub_questions.map((q, i) => (
                          <li key={i} className="research-plan-list-item">{q}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {result.plan.report_sections?.length > 0 && (
                    <div className="research-plan-section">
                      <div className="research-plan-label">Report Sections</div>
                      <div className="research-plan-chips">
                        {result.plan.report_sections.map((s, i) => (
                          <span key={i} className="research-plan-chip">{s}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── SEARCHES tab ── */}
            {activeTab === 'searches' && (
              <div className="research-tab-panel" role="tabpanel">
                {result?.searches?.length > 0 ? (
                  <div className="research-searches">
                    {result.searches.map((s, i) => {
                      const isDoc = s.query?.startsWith('[DOC]');
                      const query = isDoc ? s.query.replace('[DOC]', '').trim() : s.query;
                      const kb = s.chars ? `${(s.chars / 1000).toFixed(1)}k chars` : '';
                      return (
                        <div key={i} className="research-search-row">
                          <span className="research-search-round">R{s.round || 1}</span>
                          <span className={`research-search-badge ${isDoc ? 'doc' : 'web'}`}>
                            {isDoc ? 'DOC' : 'WEB'}
                          </span>
                          <span className="research-search-query">{query}</span>
                          {kb && <span className="research-search-size">{kb}</span>}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="research-empty-tab">No searches recorded.</div>
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
