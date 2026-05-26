import { useCallback, useEffect, useRef, useState } from 'react';
import ChatMessage from '../components/ChatMessage';
import FileUploader from '../components/FileUploader';
import WorkspaceSelector from '../components/WorkspaceSelector';
import { useTranslation } from '../i18n/useTranslation';
import { streamChat } from '../api/chat';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const samplePrompts = [
    t('sample_prompt_topics'),
    t('sample_prompt_summary'),
    t('sample_prompt_detail'),
  ];

  const loadSession = useCallback((sessionId) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setActiveSessionId(session.id);
    setMessages(session.messages || []);
    const rebuiltHistory = (session.messages || [])
      .filter((entry) => entry.role === 'user' || entry.role === 'assistant')
      .map((entry) => ({ role: entry.role, content: entry.content || '' }))
      .slice(-HISTORY_LIMIT);
    setHistory(rebuiltHistory);
    setError('');
  }, [sessions]);

  const createNewSession = useCallback(() => {
    if (!workspaceId) return;
    const newSession = {
      id: globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`,
      title: 'New conversation',
      createdAt: new Date().toISOString(),
      messages: [],
      workspaceId,
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    localStorage.setItem(`lexara_sessions_${workspaceId}`, JSON.stringify(updated));
    setActiveSessionId(newSession.id);
    setMessages([]);
  }, [sessions, workspaceId]);

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
  }, [activeSessionId, loadSession, sessions, workspaceId]);

  const saveSession = useCallback((sessionId, newMessages) => {
    if (!sessionId || !workspaceId) return;
    setSessions((prev) => {
      const updated = prev.map((s) => (
        s.id === sessionId
          ? {
              ...s,
              messages: newMessages,
              title: newMessages.find((m) => m.role === 'user')?.content.slice(0, 40) || s.title,
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
          setMessages(parsed[0].messages || []);
          setHistory((parsed[0].messages || []).filter((entry) => entry.role === 'user' || entry.role === 'assistant').slice(-HISTORY_LIMIT));
        } else {
          setActiveSessionId(null);
          setMessages([]);
          setHistory([]);
        }
      } catch {
        setSessions([]);
        setActiveSessionId(null);
        setMessages([]);
        setHistory([]);
      }
    } else {
      setSessions([]);
      setActiveSessionId(null);
      setMessages([]);
      setHistory([]);
    }
  }, [workspaceId]);

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
        title: 'New conversation',
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

    setInput('');
    setError('');
    setIsLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: 'user', content: question },
      { id: assistantId, role: 'assistant', content: '', sources: [], mode: 'rag', isStreaming: true },
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
      <aside className="chat-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">{t('workspace')}</div>
          <WorkspaceSelector
            workspaceId={workspaceId}
            workspaceName={workspaceName}
            onWorkspaceChange={(id) => {
              onChangeWorkspace(id);
              setMessages([]);
              setHistory([]);
              setError('');
            }}
            onWorkspaceNameChange={onWorkspaceNameChange}
          />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">{t('ingest_document')}</div>
          <FileUploader
            workspaceId={hasWorkspaceName ? workspaceId : ''}
            onUploadSuccess={() => setError('')}
            onUploadError={(msg) => setError(msg)}
            disabled={!hasWorkspaceName}
          />
          {!hasWorkspaceName && <div className="input-hint">{t('upload_disabled_hint')}</div>}
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">{t('conversations')}</div>
          <button className="new-chat-btn" onClick={createNewSession}>
            + New conversation
          </button>
          <div className="sessions-list">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                onClick={() => loadSession(session.id)}
              >
                <span className="session-title">{session.title || 'New conversation'}</span>
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
          {!hasWorkspaceName && (
            <div className="workspace-name-overlay">
              <div className="workspace-name-overlay-arrow">↖</div>
              <div className="workspace-name-overlay-text">{t('no_workspace_overlay')}</div>
            </div>
          )}
          {isEmpty && (
            <div className="empty-state">
              <div className="empty-state-icon">✦</div>
              <div className="empty-state-text">
                {workspaceId ? t('workspace_active_prompt') : t('workspace_missing_prompt')}
              </div>
              {workspaceId && (
                <div className="empty-prompt-list">
                  {samplePrompts.map((prompt, index) => (
                    <button key={index} className="empty-prompt" onClick={() => sendMessage(prompt)}>
                      {prompt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((message, index) => (
            <ChatMessage
              key={message.id || index}
              role={message.role}
              content={message.content}
              sources={message.sources}
              mode={message.mode}
              isStreaming={message.isStreaming}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="chat-input-area">
          <div className={`chat-input-wrapper ${!workspaceId ? 'disabled' : ''}`}>
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
              disabled={!workspaceId || isLoading || !hasWorkspaceName}
              rows={1}
            />
            <button className="send-btn" onClick={() => sendMessage(input)} disabled={!canSend} title={t('send')}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 14L14 8 2 2" />
                <path d="M14 8H6" />
              </svg>
            </button>
          </div>
          <div className="input-hint">⏎ send · ⇧⏎ newline</div>
        </div>
      </main>
    </div>
  );
}
