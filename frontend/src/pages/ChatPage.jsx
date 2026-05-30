import { useState, useEffect, useRef, useCallback } from 'react';
import ChatMessage from '../components/ChatMessage';
import FileUploader from '../components/FileUploader';
import WorkspaceSelector from '../components/WorkspaceSelector';
import { sendChat } from '../api/chat';
import '../styles/ChatPage.css';

const SAMPLE_PROMPTS = [
  'What are the main topics in the uploaded documents?',
  'Summarize the key findings.',
  'What does the document say about…?',
];

export default function ChatPage({ workspaceId, onChangeWorkspace }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [input]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || isLoading || !workspaceId) return;
    const question = text.trim();

    setInput('');
    setError('');
    setMessages(prev => [...prev, { role: 'user', content: question }]);
    setIsLoading(true);

    try {
      const res = await sendChat(workspaceId, question);

      // Support both /chat/query (chunks[]) and /chat (answer + sources)
      const answer = res.answer
        ?? (res.chunks?.length > 0
            ? res.chunks.map(c => c.text).join('\n\n---\n\n')
            : 'No relevant content found for your query.')
        ?? 'No response.';

      const sources = res.sources
        ?? res.chunks?.map(c => ({
            chunk_id: String(c.chunk_id),
            filename: c.document_id ? `doc:${String(c.document_id).slice(0,8)}` : 'unknown',
            score: c.score,
            text: c.text,
           }))
        ?? [];

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: answer,
        sources,
      }]);
    } catch (err) {
      const msg = err.response?.data?.error?.message
        || err.response?.data?.detail
        || err.message
        || 'Request failed';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, isLoading]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const isEmpty = messages.length === 0 && !isLoading;
  const canSend = input.trim() && !isLoading && !!workspaceId;

  return (
    <div className="chat-page">
      {/* ── Sidebar ── */}
      <aside className="chat-sidebar">
        <div className="sidebar-section">
          <div className="sidebar-label">Workspace</div>
          <WorkspaceSelector
            workspaceId={workspaceId}
            onWorkspaceChange={(id) => {
              onChangeWorkspace(id);
              setMessages([]);
              setError('');
            }}
          />
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Ingest document</div>
          <FileUploader
            workspaceId={workspaceId}
            onUploadSuccess={() => setError('')}
            onUploadError={(msg) => setError(msg)}
          />
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="chat-main">
        <div className="chat-header">
          <div className="chat-header-left">
            <div className={`chat-status-dot ${workspaceId ? '' : 'inactive'}`} />
            <span className="chat-workspace-id">
              {workspaceId
                ? `ws:${workspaceId.slice(0, 8)}…${workspaceId.slice(-4)}`
                : 'no workspace'}
            </span>
          </div>
          <span className="chat-mode-badge">
            {workspaceId ? 'ready' : 'disconnected'}
          </span>
        </div>

        <div className="chat-messages">
          {isEmpty && (
            <div className="empty-state">
              <div className="empty-state-icon">{ }[]</div>
              <div className="empty-state-text">
                {workspaceId
                  ? 'Workspace active. Upload a document\nand start querying.'
                  : 'Select or generate a workspace\nto begin.'}
              </div>
              {workspaceId && (
                <div className="empty-prompt-list">
                  {SAMPLE_PROMPTS.map((p, i) => (
                    <button
                      key={i}
                      className="empty-prompt"
                      onClick={() => sendMessage(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {messages.map((msg, i) => (
            <ChatMessage
              key={i}
              role={msg.role}
              content={msg.content}
              sources={msg.sources}
            />
          ))}

          {isLoading && (
            <ChatMessage isLoading />
          )}

          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="error-banner">{error}</div>
        )}

        <div className="chat-input-area">
          <div className={`chat-input-wrapper ${!workspaceId ? 'disabled' : ''}`}>
            <textarea
              ref={textareaRef}
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                workspaceId
                  ? 'Query your documents… (⏎ to send, ⇧⏎ for newline)'
                  : 'Select a workspace to begin'
              }
              disabled={!workspaceId || isLoading}
              rows={1}
            />
            <button
              className="send-btn"
              onClick={() => sendMessage(input)}
              disabled={!canSend}
              title="Send"
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M2 14L14 8 2 2" />
                <path d="M14 8H6" />
              </svg>
            </button>
          </div>
          <div className="input-hint">
            ⏎ send &nbsp;·&nbsp; ⇧⏎ newline
          </div>
        </div>
      </main>
    </div>
  );
}
