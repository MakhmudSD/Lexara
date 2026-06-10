import { useCallback, useEffect, useRef, useState } from 'react';
import { streamChat } from '../api/chat';

const HISTORY_LIMIT = 12;

function buildStorageKey(userId, workspaceId, jurisdiction) {
  return jurisdiction
    ? `lexara_sessions_${userId}_${workspaceId}_${jurisdiction}`
    : `lexara_sessions_${userId}_${workspaceId}`;
}

/**
 * Shared conversation-session engine for ChatPage and LegalChatPage.
 *
 * @param {object} opts
 * @param {string}   opts.workspaceId
 * @param {string}   [opts.jurisdiction]   - null for generic chat, 'KR'/'UZ' for legal chat
 * @param {function} opts.t                - i18n translation function
 * @param {function} [opts.onQuotaError]   - called with {code, message} on quota/access errors
 * @param {function} [opts.pruneSessions]  - optional (sessions, userId, workspaceId) => sessions[]
 */
export function useChatSession({ workspaceId, jurisdiction = null, t, onQuotaError, pruneSessions }) {
  const [messages, setMessages] = useState([]);
  const [history, setHistory] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const _userId = (() => {
    try { return JSON.parse(localStorage.getItem('authUser') || '{}').id || ''; } catch { return ''; }
  })();
  const userIdRef = useRef(_userId);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // Purge sessions belonging to other users on mount
  useEffect(() => {
    const uid = userIdRef.current;
    if (!uid) return;
    Object.keys(localStorage)
      .filter(k => k.startsWith('lexara_sessions_') && !k.startsWith(`lexara_sessions_${uid}_`))
      .forEach(k => localStorage.removeItem(k));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const normalizeMessages = useCallback((entries, fallbackTimestamp) => (
    (entries || []).map((entry, index) => ({
      ...entry,
      timestamp: entry.timestamp || entry.createdAt ||
        new Date((fallbackTimestamp || Date.now()) + index * 60000).toISOString(),
    }))
  ), []);

  const loadSession = useCallback((sessionId) => {
    const session = sessions.find((item) => item.id === sessionId);
    if (!session) return;
    setActiveSessionId(session.id);
    const normalized = normalizeMessages(session.messages || [], new Date(session.createdAt || Date.now()).getTime());
    setMessages(normalized);
    setHistory(
      normalized
        .filter((e) => e.role === 'user' || e.role === 'assistant')
        .map((e) => ({ role: e.role, content: e.content || '' }))
        .slice(-HISTORY_LIMIT)
    );
    setError('');
  }, [normalizeMessages, sessions]);

  const saveSession = useCallback((sessionId, newMessages) => {
    if (!sessionId || !workspaceId) return;
    setSessions((prev) => {
      const updated = prev.map((s) =>
        s.id === sessionId
          ? { ...s, messages: newMessages, title: newMessages.find((m) => m.role === 'user')?.content?.slice(0, 40) || s.title }
          : s
      );
      localStorage.setItem(buildStorageKey(_userId, workspaceId, jurisdiction), JSON.stringify(updated));
      return updated;
    });
  }, [workspaceId, _userId, jurisdiction]);

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
    localStorage.setItem(buildStorageKey(_userId, workspaceId, jurisdiction), JSON.stringify(updated));
    setActiveSessionId(newSession.id);
    setMessages([]);
    setSidebarOpen(false);
  }, [sessions, t, workspaceId, _userId, jurisdiction]);

  const deleteSession = useCallback((sessionId) => {
    const updated = sessions.filter((s) => s.id !== sessionId);
    setSessions(updated);
    localStorage.setItem(buildStorageKey(_userId, workspaceId, jurisdiction), JSON.stringify(updated));
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

  const appendHistory = useCallback((userContent, assistantContent) => {
    setHistory((prev) =>
      [...prev, { role: 'user', content: userContent }, { role: 'assistant', content: assistantContent }]
        .slice(-HISTORY_LIMIT)
    );
  }, []);

  // Load and optionally prune sessions when workspaceId / jurisdiction changes
  useEffect(() => {
    const key = buildStorageKey(_userId, workspaceId, jurisdiction);
    const raw = localStorage.getItem(key);
    let parsed = [];
    if (raw) {
      try { parsed = JSON.parse(raw); } catch { /* ignore */ }
    }
    let list = Array.isArray(parsed) ? parsed : [];
    if (pruneSessions) {
      const pruned = pruneSessions(list);
      if (pruned.length !== list.length) {
        localStorage.setItem(key, JSON.stringify(pruned));
      }
      list = pruned;
    }
    setSessions(list);
    if (list.length > 0) {
      setActiveSessionId(list[0].id);
      const normalized = normalizeMessages(list[0].messages || [], new Date(list[0].createdAt || Date.now()).getTime());
      setMessages(normalized);
      setHistory(normalized.filter((e) => e.role === 'user' || e.role === 'assistant').slice(-HISTORY_LIMIT));
    } else {
      setActiveSessionId(null);
      setMessages([]);
      setHistory([]);
    }
  }, [normalizeMessages, workspaceId, jurisdiction]); // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [input]);

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
      localStorage.setItem(buildStorageKey(_userId, workspaceId, jurisdiction), JSON.stringify(updated));
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
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, content: finalContent } : m));
      },
      (sources) => {
        finalSources = (sources || []).map((s) => ({
          ...s,
          filename: s.filename || `doc:${String(s.document_id).slice(0, 8)}`,
        }));
        setMessages((prev) => prev.map((m) => m.id === assistantId ? { ...m, sources: finalSources } : m));
      },
      (done) => {
        settled = true;
        finalMode = done?.mode || 'retrieval';
        if (finalMode === 'retrieval' && !finalContent && finalSources.length === 0) {
          finalContent = t('no_results');
        }
        setMessages((prev) => {
          const finalMessages = prev.map((m) =>
            m.id === assistantId
              ? { ...m, mode: finalMode, content: finalContent || '', sources: finalSources, isStreaming: false }
              : m
          );
          saveSession(sessionId, finalMessages);
          return finalMessages;
        });
        appendHistory(question, finalMode === 'rag' ? finalContent : '');
        try {
          const existing = JSON.parse(localStorage.getItem('lexara_stats') || '{}');
          localStorage.setItem('lexara_stats', JSON.stringify({
            total_queries: Number(existing.total_queries || 0) + 1,
            total_tokens: Number(existing.total_tokens || 0),
            total_cost: Number(existing.total_cost || 0),
          }));
        } catch { /* no-op */ }
        setIsLoading(false);
      },
      (errData) => {
        if (settled) return;
        settled = true;
        const { code = '', message = '' } = errData;
        if (onQuotaError && (code === 'monthly_quota_exceeded' || code === 'legal_quota_exceeded')) {
          onQuotaError({ code, message });
        }
        const errorMsg = code === 'legal_quota_exceeded'
          ? t('legal_quota_exceeded')
          : code === 'monthly_quota_exceeded'
          ? t('quota_exceeded')
          : message;
        setError(errorMsg);
        setMessages((prev) => prev.filter((e) => e.id !== assistantId));
        setIsLoading(false);
      },
    );
  }, [activeSessionId, appendHistory, history, isLoading, saveSession, sessions, t, workspaceId, _userId, jurisdiction, onQuotaError]);

  return {
    messages, setMessages,
    history,
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
    saveSession,
  };
}
