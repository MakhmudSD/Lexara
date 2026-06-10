import { useCallback, useEffect, useRef, useState } from 'react';
import ChatMessage from '../components/ChatMessage';
import WorkspaceSelector from '../components/WorkspaceSelector';
import { LexaraIcon } from '../assets/LexaraLogo';
import { useTranslation } from '../i18n/useTranslation';
import { uploadDocument, getDocumentStatus, deleteDocument } from '../api/upload';
import ThreeBackground from '../components/ThreeBackground';
import { useChatSession } from '../hooks/useChatSession';
import { isUsernamePattern } from '../utils/nameUtils';
import '../styles/ChatPage.css';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const RETENTION_DAYS = { free: 7, pro: null, business: null };

function pruneExpiredSessions(sessions, plan) {
  const days = RETENTION_DAYS[(plan || 'free').toLowerCase()] ?? null;
  if (days === null) return sessions;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return sessions.filter(s => !s.createdAt || new Date(s.createdAt) >= cutoff);
}

export default function ChatPage({ workspaceId, workspaceName, onChangeWorkspace, onWorkspaceNameChange, onUpgrade }) {
  const { t } = useTranslation();

  // Plan derivation — used for pruning and UI gating
  const _authUser = (() => { try { return JSON.parse(localStorage.getItem('authUser') || '{}'); } catch { return {}; } })();
  const _plan = _authUser.plan || 'free';
  const _planExpired = _authUser.plan_expires_at && new Date(_authUser.plan_expires_at) < new Date();
  const effectivePlan = _planExpired ? 'free' : _plan.toLowerCase();

  const {
    messages, setMessages,
    sessions,
    activeSessionId,
    input, setInput,
    sidebarOpen, setSidebarOpen,
    isLoading,
    error, setError,
    messagesEndRef,
    textareaRef,
    sendMessage,
    createNewSession,
    deleteSession,
    loadSession,
  } = useChatSession({
    workspaceId,
    t,
    pruneSessions: (list) => pruneExpiredSessions(list, effectivePlan),
  });

  const [connectionError, setConnectionError] = useState(false);
  const workspaceSelectorRef = useRef(null);
  const fileInputRef = useRef(null);
  const pollTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isCreatingWorkspace, setIsCreatingWorkspace] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    // Show only if: no sessions, no uploads, no workspace, and not onboarded
    const onboarded = localStorage.getItem('lexara_onboarded') === 'true';
    return !onboarded;
  });

  const retryWorkspaceCreation = useCallback(() => {
    workspaceSelectorRef.current?.retryWorkspaceCreation?.();
  }, []);

  const handleExport = useCallback(async (format) => {
    if (!activeSessionId) return;
    try {
      const token = localStorage.getItem('access_token');
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/export/conversation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ conversation_id: activeSessionId, format }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e?.error?.message || 'Export failed'); }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Export failed');
    }
  }, [activeSessionId]);

  // Clear any in-flight polling timeout and mark unmounted
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  const hasWorkspaceName = Boolean(workspaceName && workspaceName.trim() && !UUID_RE.test(workspaceName.trim()));

  // handleFileUpload is declared after hasWorkspaceName so the dep is in scope
  const handleFileUpload = useCallback(async (file) => {
    if (!file || !workspaceId || !hasWorkspaceName) return;

    // Clear any previous poll that may still be running
    if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);

    setIsUploading(true);
    setUploadStatus((t('uploading_file') || 'Uploading {name}...').replace('{name}', file.name));
    setUploadProgress(0);

    let documentId = null;
    let uploadResult = null;

    try {
      uploadResult = await uploadDocument(file, workspaceId, null, (pct) => setUploadProgress(pct));
      documentId = uploadResult?.id;
    } catch (err) {
      setUploadStatus(`✗ ${err.response?.data?.error?.message || t('upload_failed')}`);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Upload request accepted (202). Begin polling for processing status.
    const processingLabel = t('processing_document') || 'Processing document...';
    setUploadStatus(processingLabel);
    setUploadProgress(100);

    if (!documentId) {
      // Backend did not return an id — treat as immediate success (legacy behaviour)
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          role: 'system',
          content: (t('upload_success') || '{name} uploaded and indexed. Ask your first question!').replace('{name}', file.name),
          timestamp: new Date().toISOString(),
        },
      ]);
      setUploadStatus('');
      setTimeout(() => setUploadProgress(0), 2000);
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const POLL_INTERVAL_MS = 2000;
    const POLL_TIMEOUT_MS = 120000;
    const startTime = Date.now();

    const poll = async () => {
      if (!isMountedRef.current) return;


      if (Date.now() - startTime >= POLL_TIMEOUT_MS) {
        setUploadStatus(`✗ ${t('upload_timeout') || 'Processing timed out. Please try again.'}`);
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }

      try {
        const status = await getDocumentStatus(documentId);

        if (status.status === 'ready') {
          const chunkInfo = status.chunk_count != null ? ` (${status.chunk_count} chunks)` : '';
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now(),
              role: 'system',
              content: (t('upload_success') || '{name} uploaded and indexed. Ask your first question!')
                .replace('{name}', file.name) + chunkInfo,
              timestamp: new Date().toISOString(),
            },
          ]);
          setUploadedDocs((prev) => [
            ...prev,
            {
              id: documentId,
              filename: status.filename || file.name,
              chunk_count: status.chunk_count ?? 0,
              file_size_bytes: uploadResult?.file_size_bytes ?? file.size ?? 0,
              summary: status.summary || null,
            },
          ]);
          setUploadStatus('');
          setTimeout(() => setUploadProgress(0), 2000);
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        if (status.status === 'failed') {
          const reason = status.error_message || t('upload_failed') || 'Processing failed.';
          setUploadStatus(`✗ ${reason}`);
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        // Still processing — schedule the next poll
        pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      } catch (err) {
        // Network/auth error during polling — keep trying until timeout
        pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
      }
    };

    // Kick off the first poll
    pollTimeoutRef.current = setTimeout(poll, POLL_INTERVAL_MS);
  }, [workspaceId, hasWorkspaceName, t, setUploadedDocs]);

  const handleDeleteDocument = useCallback(async (docId) => {
    try {
      const doc = uploadedDocs.find((d) => d.id === docId);
      await deleteDocument(docId);
      setUploadedDocs((prev) => prev.filter((d) => d.id !== docId));
      if (doc) {
        setMessages((prev) => prev.filter((m) => !m.content?.includes(doc.filename) && !m.content?.includes(doc.filename?.replace('.pdf', ''))));
      }
    } catch {
      // silently ignore — document may already be gone
    } finally {
      setConfirmDeleteId(null);
    }
  }, []);

  const canSend = input.trim() && !isLoading && !!workspaceId && hasWorkspaceName;
  const isEmpty = messages.length === 0 && !isLoading;
  const shouldShowBanner = showOnboarding && sessions.length === 0 && uploadedDocs.length === 0 && !workspaceId;
  
  const dismissOnboarding = () => {
    localStorage.setItem('lexara_onboarded', 'true');
    setShowOnboarding(false);
  };
  
  const formatDate = (date) => {
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="chat-page">
      {isEmpty && <ThreeBackground opacity={0.15} />}
      <button className="sidebar-toggle" onClick={() => setSidebarOpen((value) => !value)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {shouldShowBanner && (
          <div className="onboarding-banner">
            <div className="onboarding-banner-title">👋 Start here</div>
            <div className="onboarding-banner-text">
              Name your first project to begin uploading docs and asking questions.
            </div>
            <button
              className="onboarding-banner-dismiss"
              onClick={dismissOnboarding}
            >
              Got it
            </button>
          </div>
        )}
        
        <div className="sidebar-section">
          <WorkspaceSelector
            ref={workspaceSelectorRef}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            onWorkspaceChange={(id) => {
              onChangeWorkspace(id);
              if (id) dismissOnboarding();
              setMessages([]);
              setError('');
              setConnectionError(false);
              setSidebarOpen(false);
            }}
            onWorkspaceNameChange={onWorkspaceNameChange}
            onConnectionError={() => setConnectionError(true)}
            onCreatingChange={setIsCreatingWorkspace}
          />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">{t('conversations')}</div>
          <button className="new-chat-btn" onClick={createNewSession}>
            + {t('new_conversation')}
          </button>
          {effectivePlan === 'free' && (
            <div className="history-retention-notice">
              Free plan: {RETENTION_DAYS.free}-day history.{' '}
              <button className="history-retention-upgrade" onClick={() => { sessionStorage.setItem('intended_plan', 'pro'); onUpgrade?.(); }}>Upgrade</button>
            </div>
          )}
          <div className="sessions-list">
            {[...sessions].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map((session) => (
              <div
                key={session.id}
                className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                onClick={() => {
                  loadSession(session.id);
                  setSidebarOpen(false);
                }}
              >
                <span className="session-title">{session.title || t('new_conversation')}</span>
                <span className="session-date">{formatDate(session.createdAt)}</span>
                <button
                  className="session-delete"
                  onClick={(event) => {
                    event.stopPropagation();
                    deleteSession(session.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      <main className="chat-main">
        <div className="chat-header">
          <div className="chat-header-left">
            <div className={`chat-status-dot ${workspaceId ? '' : 'inactive'}`} />
            <span className="chat-workspace-id">
              {workspaceName || (workspaceId ? `ws:${workspaceId.slice(0, 8)}…${workspaceId.slice(-4)}` : t('no_workspace'))}
            </span>
          </div>
          <span className="chat-mode-badge">{workspaceId ? t('ready') : t('disconnected')}</span>
          {activeSessionId && effectivePlan !== 'free' && (
            <div className="export-controls">
              <button className="export-btn" onClick={() => handleExport('pdf')} title="Export as PDF">
                ↓ PDF
              </button>
              {effectivePlan === 'business' && (
                <button className="export-btn" onClick={() => handleExport('docx')} title="Export as Word">
                  ↓ DOCX
                </button>
              )}
            </div>
          )}
        </div>

        <div className="chat-messages">
          {connectionError && (
            <div className="connection-error-state">
              <div style={{ fontSize: 32 }}>⚠️</div>
              <p>{t('connection_error')}</p>
              <button
                onClick={() => {
                  setConnectionError(false);
                  retryWorkspaceCreation();
                }}
              >
                {t('retry')}
              </button>
            </div>
          )}
          {!hasWorkspaceName && isEmpty && !isLoading && !isCreatingWorkspace && (
            <div className="workspace-name-overlay">
              <div className="workspace-name-overlay-arrow">↖</div>
              <div className="workspace-name-overlay-text">{t('no_workspace_overlay')}</div>
            </div>
          )}
          {!connectionError && isEmpty && (
            <div className="chat-empty-state">
              {/* Human greeting */}
              <div className="chat-greeting">
                {(() => {
                  try {
                    const u = JSON.parse(localStorage.getItem('authUser') || '{}');
                    const rawName = u.full_name?.split(' ')[0] || '';
                    const displayName = isUsernamePattern(rawName) ? '' : rawName;
                    const hour = new Date().getHours();
                    const tod = hour < 12 ? t('good_morning') : hour < 18 ? t('good_afternoon') : t('good_evening');
                    return displayName ? `${tod}, ${displayName} 👋` : `${tod} 👋`;
                  } catch { return '👋'; }
                })()}
              </div>
              <div className="chat-greeting-sub">
                {t('greeting_upload_prompt') || 'Upload a document to get started — then ask anything about it.'}
              </div>

              {/* No workspace: direct pointer to sidebar */}
              {!hasWorkspaceName && !isCreatingWorkspace && (
                <div className="chat-empty-no-workspace">
                  <p className="chat-empty-no-workspace-text">
                    {t('create_project_prompt') || 'Create a project on the left, upload your document, and ask anything.'}
                  </p>
                </div>
              )}

              {/* Workspace ready: AI greets back + upload CTA */}
              {hasWorkspaceName && (
                <div className="ai-welcome-bubble">
                  <div className="ai-welcome-avatar">
                    <LexaraIcon size={18} />
                  </div>
                  <div className="ai-welcome-body">
                    <p className="ai-welcome-text">
                      {(() => {
                        try {
                          const u = JSON.parse(localStorage.getItem('authUser') || '{}');
                          const rawName = u.full_name?.split(' ')[0] || '';
                          const displayName = isUsernamePattern(rawName) ? '' : rawName;
                          const base = t('ai_welcome_msg') || 'Hi{name}! Upload a document using the button below, then ask me anything about it.';
                          return base.replace('{name}', displayName ? ` ${displayName}` : '');
                        } catch { return t('ai_welcome_msg') || 'Upload a document, then ask me anything about it.'; }
                      })()}
                    </p>
                    <button
                      type="button"
                      className="chat-upload-cta"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                        <path d="M13.5 8.5l-5 5a3.5 3.5 0 01-4.95-4.95l6-6a2 2 0 012.83 2.83L6.5 11.24a.5.5 0 01-.71-.71L11.5 4.83" />
                      </svg>
                      {t('step_upload_doc') || 'Upload a document'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!connectionError && messages.map((message, index) => (
            <ChatMessage
              key={message.id || index}
              role={message.role}
              content={message.content}
              sources={message.sources}
              mode={message.mode}
              isStreaming={message.isStreaming}
              timestamp={message.timestamp}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {!connectionError && error && <div className="error-banner">{error}</div>}

        <div className="chat-input-area">
          <div className={`chat-input-wrapper ${!workspaceId || connectionError ? 'disabled' : ''}`}>
            <button
              className="attach-btn"
              type="button"
              title={t('upload_file')}
              disabled={!hasWorkspaceName || isUploading || connectionError}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13.5 8.5l-5 5a3.5 3.5 0 01-4.95-4.95l6-6a2 2 0 012.83 2.83L6.5 11.24a.5.5 0 01-.71-.71L11.5 4.83" />
              </svg>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              accept=".pdf,.txt,.docx,.md,.csv"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFileUpload(f);
              }}
            />
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder={!hasWorkspaceName ? t('query_disabled_placeholder') : (workspaceId ? t('input_placeholder_ready') : t('input_placeholder_idle'))}
              disabled={!workspaceId || isLoading || !hasWorkspaceName || connectionError}
              rows={1}
            />
            <button className="send-btn" onClick={() => sendMessage(input)} disabled={!canSend || connectionError} title={t('send')}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 14L14 8 2 2" />
                <path d="M14 8H6" />
              </svg>
            </button>
          </div>
          {isUploading && (
            <div className="upload-progress-wrap">
              <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
            </div>
          )}
          {isUploading && uploadStatus && (
            <div className="upload-status ok">{uploadStatus}</div>
          )}
          {uploadStatus && !isUploading && (
            <div className={`upload-status ${uploadStatus.startsWith('✗') ? 'err' : 'ok'}`}>{uploadStatus}</div>
          )}
          {uploadedDocs.length > 0 && (
            <div className="doc-card-list">
              {uploadedDocs.map((doc) => (
                <div key={doc.id} className="doc-card">
                  <span className="doc-card-name" title={doc.filename}>{doc.filename}</span>
                  <span className="doc-card-meta">
                    {doc.chunk_count} chunks · {doc.file_size_bytes >= 1024 * 1024
                      ? `${(doc.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`
                      : `${Math.round(doc.file_size_bytes / 1024)} KB`}
                  </span>
                  {doc.summary && (
                    <p className="doc-card-summary" title={doc.summary}>
                      {doc.summary.length > 120 ? doc.summary.slice(0, 120) + '…' : doc.summary}
                    </p>
                  )}
                  {confirmDeleteId === doc.id ? (
                    <span className="doc-card-confirm">
                      Delete?&nbsp;
                      <button className="doc-card-confirm-yes" onClick={() => handleDeleteDocument(doc.id)}>Yes</button>
                      <button className="doc-card-confirm-no" onClick={() => setConfirmDeleteId(null)}>No</button>
                    </span>
                  ) : (
                    <button className="doc-card-delete" title="Delete document" onClick={() => setConfirmDeleteId(doc.id)}>✕</button>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="input-hint">⏎ {t('send')} · ⇧⏎ {t('newline_hint')}</div>
        </div>
      </main>
    </div>
  );
}
