import { useCallback, useEffect, useRef, useState } from 'react';
import ChatMessage from '../components/ChatMessage';
import { LexaraIcon } from '../assets/LexaraLogo';
import { useTranslation } from '../i18n/useTranslation';
import { streamChat } from '../api/chat';
import '../styles/ChatPage.css';
import '../styles/LegalChatPage.css';

const HISTORY_LIMIT = 12;

export default function LegalChatPage({ workspaceId, workspaceName, jurisdiction = 'KR', onBack }) {
  const { t } = useTranslation();
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Derive userId once at mount — component is re-keyed on user change so this is always fresh
  const _userId = (() => { try { return JSON.parse(localStorage.getItem('authUser') || '{}').id || ''; } catch { return ''; } })();
  const userIdRef = useRef(_userId);

  // Purge sessions belonging to other users — runs once on mount (safe side-effect location)
  useEffect(() => {
    const uid = userIdRef.current;
    if (!uid) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith('lexara_sessions_') && !k.startsWith(`lexara_sessions_${uid}_`))
      .forEach(k => localStorage.removeItem(k));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const normalizeMessages = useCallback((entries, fallbackTimestamp) => (
    (entries || []).map((entry, index) => ({
      ...entry,
      timestamp: entry.timestamp || entry.createdAt || new Date((fallbackTimestamp || Date.now()) + index * 60000).toISOString(),
    }))
  ), []);

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
  }, [normalizeMessages, sessions]);

  const createNewSession = useCallback(() => {
    const newSession = {
      id: globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`,
      title: t('new_conversation'),
      createdAt: new Date().toISOString(),
      messages: [],
      workspaceId,
    };
    const updated = [newSession, ...sessions];
    setSessions(updated);
    localStorage.setItem(`lexara_sessions_${_userId}_${workspaceId}_${jurisdiction}`, JSON.stringify(updated));
    setActiveSessionId(newSession.id);
    setMessages([]);
    setSidebarOpen(false);
  }, [sessions, t, workspaceId, _userId, jurisdiction]);

  const deleteSession = useCallback((sessionId) => {
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    localStorage.setItem(`lexara_sessions_${_userId}_${workspaceId}_${jurisdiction}`, JSON.stringify(updated));
    if (activeSessionId === sessionId) {
      if (updated.length > 0) {
        loadSession(updated[0].id);
      } else {
        setActiveSessionId(null);
        setMessages([]);
      }
    }
    setSidebarOpen(false);
  }, [activeSessionId, loadSession, sessions, workspaceId, _userId, jurisdiction]);

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
      localStorage.setItem(`lexara_sessions_${_userId}_${workspaceId}_${jurisdiction}`, JSON.stringify(updated));
      return updated;
    });
  }, [workspaceId, _userId, jurisdiction]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const raw = localStorage.getItem(`lexara_sessions_${_userId}_${workspaceId}_${jurisdiction}`);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setSessions(Array.isArray(parsed) ? parsed : []);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setActiveSessionId(parsed[0].id);
          const normalizedMessages = normalizeMessages(parsed[0].messages || [], new Date(parsed[0].createdAt || Date.now()).getTime());
          setMessages(normalizedMessages);
          setHistory(normalizedMessages.filter((entry) => entry.role === 'user' || entry.role === 'assistant').slice(-HISTORY_LIMIT));
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
  }, [normalizeMessages, workspaceId, jurisdiction]);

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
    if (!text.trim() || isLoading) return;
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
      localStorage.setItem(`lexara_sessions_${_userId}_${workspaceId}_${jurisdiction}`, JSON.stringify(updated));
      setActiveSessionId(newSession.id);
      sessionId = newSession.id;
    }
    const historyForRequest = history.slice(-HISTORY_LIMIT);
    const assistantId = `assistant-${Date.now()}`;
    const sentAt = new Date().toISOString();

    setInput('');
    setError('');
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
      (errData) => {
        if (settled) return;
        settled = true;
        const code = typeof errData === 'object' ? errData.code : '';
        const message = typeof errData === 'object' ? errData.message : (errData || '');
        const errorMsg = code === 'legal_quota_exceeded'
          ? t('legal_quota_exceeded')
          : code === 'monthly_quota_exceeded' ? t('quota_exceeded') : message;
        setError(errorMsg);
        setMessages((prev) => prev.filter((entry) => entry.id !== assistantId));
        setIsLoading(false);
      },
    );
  }, [activeSessionId, appendHistory, history, isLoading, saveSession, sessions, t, workspaceId, _userId, jurisdiction]);

  const canSend = input.trim() && !isLoading;
  const isEmpty = messages.length === 0 && !isLoading;
  const displayTitle = jurisdiction === 'UZ'
    ? (t('uzbek_law') || 'Uzbek Law')
    : (t('korean_law') || 'Korean Law');
  const emptyStateText = jurisdiction === 'UZ'
    ? (t('legal_uz_empty') || 'Ask about Uzbek statutes — Labour Code, Civil Code, Criminal Code, and the Constitution.')
    : (t('legal_kr_empty') || 'Ask about Korean statutes — Personal Information Protection Act, Labor Standards Act, Civil Act, Criminal Act, and the Constitution.');
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
        <div className="legal-chat-header">
          <div className="legal-chat-header-ws">
            <span className="legal-chat-badge">{jurisdiction}</span>
            <div className="chat-status-dot" />
            <span className="legal-chat-ws-name">{displayTitle}</span>
          </div>
          <button type="button" className="legal-chat-back" onClick={onBack}>
            {t('legal_back') || '← All databases'}
          </button>
        </div>

        <div className="chat-messages">
          {isEmpty && (
            <div className="legal-chat-empty">
              <LexaraIcon size={32} />
              <p>{emptyStateText}</p>
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
              timestamp={message.timestamp}
            />
          ))}

          <div ref={messagesEndRef} />
        </div>

        {error && <div className="error-banner">{error}</div>}

        <div className="chat-input-area">
          <div className="chat-input-wrapper">
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
              placeholder="Ask a legal question…"
              disabled={isLoading}
              rows={1}
            />
            <button className="send-btn" onClick={() => sendMessage(input)} disabled={!canSend} title={t('send')}>
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 14L14 8 2 2" />
                <path d="M14 8H6" />
              </svg>
            </button>
          </div>
          <div className="input-hint">⏎ Send · ⇧⏎ New line</div>
        </div>
      </main>
    </div>
  );
}
