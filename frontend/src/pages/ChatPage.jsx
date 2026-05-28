import { useCallback, useEffect, useRef, useState } from 'react';
import ChatMessage from '../components/ChatMessage';
import WorkspaceSelector from '../components/WorkspaceSelector';
import { LexaraIcon } from '../assets/LexaraLogo';
import { useTranslation } from '../i18n/useTranslation';
import { streamChat } from '../api/chat';
import { uploadDocument } from '../api/upload';
import '../styles/ChatPage.css';

const HISTORY_LIMIT = 12;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ChatPage({ workspaceId, workspaceName, onChangeWorkspace, onWorkspaceNameChange }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [connectionError, setConnectionError] = useState(false);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const workspaceSelectorRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState('');

  const normalizeMessages = useCallback((entries, fallbackTimestamp) => (
    (entries || []).map((entry, index) => ({
      ...entry,
      timestamp: entry.timestamp || entry.createdAt || new Date((fallbackTimestamp || Date.now()) + index * 60000).toISOString(),
    }))
  ), []);

  const retryWorkspaceCreation = useCallback(() => {
    workspaceSelectorRef.current?.retryWorkspaceCreation?.();
  }, []);

  const loadSession = useCallback((sessionId) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setActiveSessionId(session.id);
    const normalizedMessages = normalizeMessages(session.messages || [], new Date(session.createdAt || Date.now()).getTime());
    setMessages(normalizedMessages);
    const rebuiltHistory = normalizedMessages
      .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
      .map((entry) => ({ role: entry.role, content: entry.content || '' }))
      .slice(-HISTORY_LIMIT);
    setHistory(rebuiltHistory);
    setError('');
    setConnectionError(false);
  }, [normalizeMessages, sessions]);

  const createNewSession = useCallback(() => {
    if (!workspaceId) return;
    const newSession = {
      id: globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`,
      title: t('new_conversation'),
      createdAt: new Date().toISOString(),
      messages: [],
      workspaceId,
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    localStorage.setItem(`lexara_sessions_${workspaceId}`, JSON.stringify(updated));
    setActiveSessionId(newSession.id);
    setMessages([]);
    setSidebarOpen(false);
    setConnectionError(false);
  }, [sessions, t, workspaceId]);

  const deleteSession = useCallback((sessionId) => {
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    localStorage.setItem(`lexara_sessions_${workspaceId}`, JSON.stringify(updated));
    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        loadSession(updated[0].id);
      } else {
        setActiveSessionId(null);
        setMessages([]);
      }
    }
    setSidebarOpen(false);
  }, [activeSessionId, loadSession, sessions, workspaceId]);

  const saveSession = useCallback((sessionId, newMessages) => {
    if (!sessionId || !workspaceId) return;
    setSessions((prev) => {
      const updated = prev.map((s) => (
        s.id === sessionId
          ? {
              ...s,
              messages: newMessages,
              title: newMessages.find((m) => m.role === 'user')?.content?.slice(0, 40) || s.title,
            }
          : s
      ));
      localStorage.setItem(`lexara_sessions_${workspaceId}`, JSON.stringify(updated));
      return updated;
    });
  }, [workspaceId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!workspaceId) return;
    const raw = localStorage.getItem(`lexara_sessions_${workspaceId}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setSessions(Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
          const normalizedMessages = normalizeMessages(parsed[0].messages || [], new Date(parsed[0].createdAt || Date.now()).getTime());
          setMessages(normalizedMessages);
          setHistory(normalizedMessages.filter((entry) => entry.role === 'user' || entry.role === 'assistant').slice(-HISTORY_LIMIT));
          setConnectionError(false);
        } else {
          setActiveSessionId(null);
          setMessages([]);
          setHistory([]);
          setConnectionError(false);
        }
      } catch {
        setSessions([]);
        setActiveSessionId(null);
        setMessages([]);
        setHistory([]);
        setConnectionError(false);
      }
    } else {
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      setHistory([]);
      setConnectionError(false);
    }
  }, [normalizeMessages, workspaceId]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [input]);

  const appendHistory = useCallback((userContent, assistantContent) => {
    setHistory((prev) => (
      [
        ...prev,
        { role: 'user', content: userContent },
        { role: 'assistant', content: assistantContent },
      ].slice(-HISTORY_LIMIT)
    ));
  }, []);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading || !workspaceId) return;
    const question = text.trim();
    let sessionId = activeSessionId;
    if (!sessionId) {
      const newSession = {
        id: globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`,
        title: t('new_conversation'),
        createdAt: new Date().toISOString(),
        messages: [],
        workspaceId,
      };
      const updated = [newSession, ...sessions];
      setSessions(updated);
      localStorage.setItem(`lexara_sessions_${workspaceId}`, JSON.stringify(updated));
      setActiveSessionId(newSession.id);
      sessionId = newSession.id;
    }
    const historyForRequest = history.slice(-HISTORY_LIMIT);
    const assistantId = `assistant-${Date.now()}`;
    const sentAt = new Date().toISOString();

    setInput('');
    setError('');
    setConnectionError(false);
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question, timestamp: sentAt },
      { id: assistantId, role: 'assistant', content: '', sources: [], mode: 'rag', isStreaming: true, timestamp: sentAt },
    ]);

    let finalContent = '';
    let finalMode = 'retrieval';
    let finalSources = [];
    let settled = false;

    await streamChat(
      workspaceId,
      question,
      historyForRequest,
      (delta) => {
        finalContent += delta;
        setMessages((prev) => prev.map((message) => (
          message.id === assistantId ? { ...message, content: finalContent } : message
        )));
      },
      (sources) => {
        finalSources = (sources || []).map((source) => ({
          ...source,
          filename: source.filename || `doc:${String(source.document_id).slice(0, 8)}`,
        }));
        setMessages((prev) => prev.map((message) => (
          message.id === assistantId ? { ...message, sources: finalSources } : message
        )));
      },
      (done) => {
        settled = true;
        finalMode = done?.mode || 'retrieval';
        if (finalMode === 'retrieval' && !finalContent && finalSources.length === 0) {
          finalContent = t('no_results');
        }
        setMessages((prev) => {
          const finalMessages = prev.map((message) => (
            message.id === assistantId
              ? {
                  ...message,
                  mode: finalMode,
                  content: finalMode === 'rag' ? finalContent : (finalContent || ''),
                  sources: finalSources,
                  isStreaming: false,
                }
              : message
          ));
          saveSession(sessionId, finalMessages);
          return finalMessages;
        });
        appendHistory(question, finalMode === 'rag' ? finalContent : '');
        try {
          const existing = JSON.parse(localStorage.getItem('lexara_stats') || '{}');
          const next = {
            total_queries: Number(existing.total_queries || 0) + 1,
            total_tokens: Number(existing.total_tokens || 0),
            total_cost: Number(existing.total_cost || 0),
          };
          localStorage.setItem('lexara_stats', JSON.stringify(next));
        } catch {
          // no-op
        }
        setIsLoading(false);
      },
      (message) => {
        if (settled) return;
        settled = true;
        setError(message);
        setMessages((prev) => prev.filter((entry) => entry.id !== assistantId));
        setIsLoading(false);
      },
    );
  }, [activeSessionId, appendHistory, history, isLoading, saveSession, sessions, t, workspaceId]);

  const hasWorkspaceName = Boolean(workspaceName && workspaceName.trim() && !UUID_RE.test(workspaceName.trim()));

  // handleFileUpload is declared after hasWorkspaceName so the dep is in scope
  const handleFileUpload = useCallback(async (file) => {
    if (!file || !workspaceId || !hasWorkspaceName) return;
    setIsUploading(true);
    setUploadProgress(0);
    setUploadStatus('');
    try {
      await uploadDocument(file, workspaceId, null, (pct) => setUploadProgress(pct));
      setUploadStatus(t('upload_success'));
    } catch (err) {
      setUploadStatus(`✗ ${err.response?.data?.error?.message || t('upload_failed')}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [workspaceId, hasWorkspaceName, t]);

  const canSend = input.trim() && !isLoading && !!workspaceId && hasWorkspaceName;
  const isEmpty = messages.length === 0 && !isLoading;
  const formatDate = (date) => {
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return '';
    }
  };

  return (
    <div className="chat-page">
      <button className="sidebar-toggle" onClick={() => setSidebarOpen((value) => !value)}>
        {sidebarOpen ? '✕' : '☰'}
      </button>
      <div className={`sidebar-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />
      <aside className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-section">
          <div className="sidebar-label">{t('workspace')}</div>
          <WorkspaceSelector
            ref={workspaceSelectorRef}
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            onWorkspaceChange={(id) => {
              onChangeWorkspace(id);
              setMessages([]);
              setHistory([]);
              setError('');
              setConnectionError(false);
              setSidebarOpen(false);
            }}
            onWorkspaceNameChange={onWorkspaceNameChange}
            onConnectionError={() => setConnectionError(true)}
          />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">{t('conversations')}</div>
          <button className="new-chat-btn" onClick={createNewSession}>
            + {t('new_conversation')}
          </button>
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
          {!hasWorkspaceName && (
            <div className="workspace-name-overlay">
              <div className="workspace-name-overlay-arrow">↖</div>
              <div className="workspace-name-overlay-text">{t('no_workspace_overlay')}</div>
            </div>
          )}
          {!connectionError && isEmpty && (
            <div className="chat-empty-state">
              <LexaraIcon size={56} style={{ opacity: 0.4 }} />
              <div className="chat-empty-copy">
                <h2 className="chat-empty-headline">
                  {hasWorkspaceName ? `${t('ask_about')} ${workspaceName}` : t('name_project_prompt')}
                </h2>
                <p className="chat-empty-subhead">
                  {hasWorkspaceName ? t('upload_prompt') : t('create_project_prompt')}
                </p>
              </div>
              {hasWorkspaceName && (
                <div className="chat-empty-chips">
                  {[t('suggested_q1'), t('suggested_q2'), t('suggested_q3')].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="chat-empty-chip"
                      onClick={() => setInput(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
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
          {uploadStatus && !isUploading && (
            <div className={`upload-status ${uploadStatus.startsWith('✗') ? 'err' : 'ok'}`}>{uploadStatus}</div>
          )}
          <div className="input-hint">⏎ {t('send')} · ⇧⏎ {t('newline_hint')}</div>
        </div>
      </main>
    </div>
  );
}
